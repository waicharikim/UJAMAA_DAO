#!/bin/bash
#
# set-webhook.sh — register (or inspect) the Telegram webhook for a deployed box.
#
# The prod counterpart to ngrok-sync.sh: instead of detecting an ngrok tunnel,
# it reads the public BASE_URL straight from an env file and points the bot's
# webhook there. A deployed box has a stable domain, so this is normally a
# set-once step — re-run only after moving boxes (e.g. DNS repoint) or rotating
# the bot token / webhook secret.
#
# Usage (run from backend/, or anywhere):
#   ./scripts/set-webhook.sh                 # use docker/.env.prod, register
#   ./scripts/set-webhook.sh --info          # just show the current webhook
#   ./scripts/set-webhook.sh ../docker/.env  # point at a different env file (e.g. dev)
#   ENV_FILE=/path/.env.prod ./scripts/set-webhook.sh
#
# Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and BASE_URL from the env
# file (grep-based — tolerant of the comments/blank lines in a real .env).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WEBHOOK_PATH="/api/v1/integration/telegram/webhook"

MODE="set"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/docker/.env.prod}"
for arg in "$@"; do
  case "$arg" in
    --info) MODE="info" ;;
    -*) echo "unknown flag: $arg" >&2; exit 1 ;;
    *) ENV_FILE="$arg" ;;
  esac
done

G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; B='\033[0;36m'; N='\033[0m'
info() { echo -e "${B}›${N} $*"; }
ok()   { echo -e "${G}✓${N} $*"; }
warn() { echo -e "${Y}!${N} $*"; }
die()  { echo -e "${R}✗${N} $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "env file not found: $ENV_FILE"
# Tolerant read: a missing key returns empty rather than aborting under `set -e`
# (grep exits non-zero on no match, which pipefail would otherwise propagate).
readvar() {
  local v
  v="$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r')" || true
  printf '%s' "$v"
}
TOKEN="$(readvar TELEGRAM_BOT_TOKEN)"
SECRET="$(readvar TELEGRAM_WEBHOOK_SECRET)"
BASE_URL="$(readvar BASE_URL)"
[ -n "$TOKEN" ] || die "TELEGRAM_BOT_TOKEN not set in $ENV_FILE"

# Parse a JSON string field out of a Telegram response (empty if absent).
# Tolerant of no-match so it doesn't abort under `set -e` (grep exits non-zero).
jsonstr() {
  local v
  v="$(echo "$1" | grep -oE "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4)" || true
  printf '%s' "$v"
}

if [ "$MODE" = "info" ]; then
  resp="$(curl -s --max-time 10 "https://api.telegram.org/bot${TOKEN}/getWebhookInfo")" || true
  [ -n "$resp" ] || die "no response from Telegram (network?)"
  url="$(jsonstr "$resp" url)"
  pending="$(echo "$resp" | grep -oE '"pending_update_count":[0-9]+' | head -1 | cut -d: -f2 || true)"
  err="$(jsonstr "$resp" last_error_message)"
  info "Webhook URL:     ${url:-<none>}"
  info "Pending updates: ${pending:-0}"
  if [ -n "$err" ]; then warn "last error from Telegram: $err"; fi
  exit 0
fi

[ -n "$BASE_URL" ] || die "BASE_URL not set in $ENV_FILE (needed to build the webhook URL)"
HOOK="${BASE_URL%/}${WEBHOOK_PATH}"
info "Registering webhook → $HOOK"
resp="$(curl -s --max-time 15 "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  --data-urlencode "url=${HOOK}" \
  ${SECRET:+--data-urlencode "secret_token=${SECRET}"} \
  --data-urlencode 'allowed_updates=["message"]' \
  --data-urlencode "drop_pending_updates=false")" || true
if echo "$resp" | grep -q '"ok":true'; then
  ok "Telegram webhook set to $HOOK"
else
  die "Telegram rejected the update: ${resp:-<no response>}"
fi

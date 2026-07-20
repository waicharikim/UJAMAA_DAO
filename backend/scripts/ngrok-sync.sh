#!/bin/bash
#
# ngrok-sync.sh — re-point the Telegram webhook at the current ngrok tunnel.
#
# ngrok's free tier rotates the public URL on every reconnect. Whenever that
# happens the Telegram bot stops receiving updates until its webhook is
# re-registered. This script grabs the live ngrok URL and re-registers it.
#
# Usage:
#   ./scripts/ngrok-sync.sh                 # auto-detect URL from ngrok, sync once
#   ./scripts/ngrok-sync.sh https://abc.ngrok-free.app   # use a URL you paste in
#   ./scripts/ngrok-sync.sh --watch         # keep running, auto re-sync on URL change
#   ./scripts/ngrok-sync.sh --info          # just show the current Telegram webhook
#
# Reads TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET from docker/.env.
# ngrok must already be tunnelling :4000 (its local API lives at :4040).

set -euo pipefail

# ── paths ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/docker/.env"

NGROK_API="http://localhost:4040/api/tunnels"
WEBHOOK_PATH="/api/v1/integration/telegram/webhook"

# ── colours ──────────────────────────────────────────────────────────────
G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; B='\033[0;36m'; N='\033[0m'
info() { echo -e "${B}›${N} $*"; }
ok()   { echo -e "${G}✓${N} $*"; }
warn() { echo -e "${Y}!${N} $*"; }
die()  { echo -e "${R}✗${N} $*" >&2; exit 1; }

# ── load creds ─────────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || die "docker/.env not found at $ENV_FILE"
TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r')"
SECRET="$(grep -E '^TELEGRAM_WEBHOOK_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r')"
[ -n "$TOKEN" ] || die "TELEGRAM_BOT_TOKEN not set in docker/.env"

# ── helpers ────────────────────────────────────────────────────────────────
# Read the current https tunnel URL from ngrok's local API.
detect_url() {
  local body
  body="$(curl -s --max-time 5 "$NGROK_API" 2>/dev/null)" || return 1
  echo "$body" | grep -oE '"public_url":"https://[^"]+"' | head -1 | cut -d'"' -f4
}

show_info() {
  local resp desc url
  resp="$(curl -s --max-time 10 "https://api.telegram.org/bot${TOKEN}/getWebhookInfo")"
  url="$(echo "$resp" | grep -oE '"url":"[^"]*"' | head -1 | cut -d'"' -f4)"
  desc="$(echo "$resp" | grep -oE '"last_error_message":"[^"]*"' | head -1 | cut -d'"' -f4)"
  info "Telegram currently points at: ${url:-<none>}"
  [ -n "$desc" ] && warn "last error from Telegram: $desc"
}

# Register a URL with Telegram. Returns 0 on {"ok":true}.
sync_url() {
  local public_url="$1" hook resp
  hook="${public_url%/}${WEBHOOK_PATH}"
  info "Registering webhook → $hook"
  resp="$(curl -s --max-time 15 "https://api.telegram.org/bot${TOKEN}/setWebhook" \
    --data-urlencode "url=${hook}" \
    ${SECRET:+--data-urlencode "secret_token=${SECRET}"} \
    --data-urlencode "drop_pending_updates=false")"
  if echo "$resp" | grep -q '"ok":true'; then
    ok "Telegram webhook updated."
    return 0
  fi
  warn "Telegram rejected the update: $resp"
  return 1
}

# ── modes ──────────────────────────────────────────────────────────────────
case "${1:-}" in
  --info)
    show_info
    exit 0
    ;;
  --watch)
    info "Watch mode — polling ngrok every 5s, re-syncing on URL change. Ctrl+C to stop."
    last=""
    while true; do
      cur="$(detect_url || true)"
      if [ -z "$cur" ]; then
        warn "ngrok not reachable on :4040 — is the tunnel up? retrying…"
      elif [ "$cur" != "$last" ]; then
        info "Detected ngrok URL: $cur"
        if sync_url "$cur"; then last="$cur"; fi
      fi
      sleep 5
    done
    ;;
  http*://*)
    # Manual URL pasted in.
    sync_url "$1"
    show_info
    ;;
  "")
    # Auto-detect once.
    url="$(detect_url || true)"
    [ -n "$url" ] || die "Could not read ngrok URL from $NGROK_API — is ngrok running? (ngrok http 4000)"
    info "Detected ngrok URL: $url"
    sync_url "$url"
    show_info
    ;;
  *)
    die "Unknown argument: $1  (use a https URL, --watch, or --info)"
    ;;
esac

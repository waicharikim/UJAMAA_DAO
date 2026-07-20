#!/usr/bin/env bash
#
# dev-stack.sh — one-command orchestration of the whole local dev system.
#
#   up      compose up → wait for /health → ensure ngrok tunnel → sync Telegram
#           webhook → launch the webhook watcher in the background → print status
#   down    stop watcher → stop ngrok → compose down
#   status  show containers, API health, ngrok URL, watcher state
#
# ngrok binary is expected on PATH (installed at ~/.local/bin/ngrok). Override
# with NGROK_BIN=/path/to/ngrok if needed.

set -uo pipefail

# ── paths / config ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE="docker compose -f $REPO_ROOT/docker/docker-compose.yml"
SYNC="$SCRIPT_DIR/ngrok-sync.sh"

NGROK_PORT=4000
NGROK_BIN="${NGROK_BIN:-$(command -v ngrok || echo "$HOME/.local/bin/ngrok")}"
NGROK_API="http://localhost:4040/api/tunnels"
HEALTH_URL="http://localhost:${NGROK_PORT}/health"

RUNDIR="$HOME/.cache/ujamaa-dev"
NGROK_PIDFILE="$RUNDIR/ngrok.pid"
WATCH_PIDFILE="$RUNDIR/ngrok-watch.pid"
mkdir -p "$RUNDIR"

# ── colours ─────────────────────────────────────────────────────────────────
G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; B='\033[0;36m'; N='\033[0m'
info() { echo -e "${B}›${N} $*"; }
ok()   { echo -e "${G}✓${N} $*"; }
warn() { echo -e "${Y}!${N} $*"; }
die()  { echo -e "${R}✗${N} $*" >&2; exit 1; }

# ── helpers ─────────────────────────────────────────────────────────────────
ngrok_url() { curl -s --max-time 5 "$NGROK_API" 2>/dev/null \
  | grep -oE '"public_url":"https://[^"]+"' | head -1 | cut -d'"' -f4; }

pid_alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

wait_for_health() {
  info "Waiting for API health at $HEALTH_URL …"
  for _ in $(seq 1 40); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null)" = "200" ] && { ok "API healthy."; return 0; }
    sleep 2
  done
  warn "API did not report healthy within ~80s — check 'docker logs ujamaa_web'."
  return 1
}

ensure_ngrok() {
  if [ -n "$(ngrok_url)" ]; then ok "ngrok already tunnelling (port $NGROK_PORT)."; return 0; fi
  [ -x "$NGROK_BIN" ] || die "ngrok binary not found at '$NGROK_BIN'. Install it or set NGROK_BIN."
  info "Starting ngrok → :$NGROK_PORT (binary: $NGROK_BIN)"
  nohup "$NGROK_BIN" http "$NGROK_PORT" --log=stdout > "$RUNDIR/ngrok.log" 2>&1 &
  echo $! > "$NGROK_PIDFILE"
  for _ in $(seq 1 15); do [ -n "$(ngrok_url)" ] && { ok "ngrok up: $(ngrok_url)"; return 0; }; sleep 1; done
  die "ngrok started but no tunnel URL appeared — see $RUNDIR/ngrok.log"
}

start_watcher() {
  if [ -f "$WATCH_PIDFILE" ] && pid_alive "$(cat "$WATCH_PIDFILE" 2>/dev/null)"; then
    ok "Webhook watcher already running (pid $(cat "$WATCH_PIDFILE"))."; return 0
  fi
  info "Launching webhook watcher in background …"
  nohup "$SYNC" --watch > "$RUNDIR/ngrok-watch.log" 2>&1 &
  echo $! > "$WATCH_PIDFILE"
  ok "Watcher running (pid $(cat "$WATCH_PIDFILE")) — log: $RUNDIR/ngrok-watch.log"
}

stop_pidfile() {  # $1=pidfile $2=label
  local pid; pid="$(cat "$1" 2>/dev/null || true)"
  if pid_alive "$pid"; then info "Stopping $2 (pid $pid)"; kill "$pid" 2>/dev/null || true; fi
  rm -f "$1"
}

# ── commands ────────────────────────────────────────────────────────────────
cmd_up() {
  info "Bringing up the dev stack …"
  $COMPOSE up -d || die "compose up failed"
  wait_for_health || true
  ensure_ngrok
  info "Syncing Telegram webhook to current ngrok URL …"
  "$SYNC" >/dev/null && ok "Telegram webhook synced." || warn "Webhook sync reported an issue (run 'ujamaa-ngrok' to retry)."
  start_watcher
  echo; cmd_status
}

cmd_down() {
  info "Tearing down the dev stack …"
  stop_pidfile "$WATCH_PIDFILE" "webhook watcher"
  stop_pidfile "$NGROK_PIDFILE" "ngrok"
  # catch an ngrok we didn't start (e.g. one launched manually)
  pkill -f "ngrok http $NGROK_PORT" 2>/dev/null && info "Stopped stray ngrok on :$NGROK_PORT" || true
  $COMPOSE down || die "compose down failed"
  ok "Dev stack stopped."
}

cmd_status() {
  echo -e "${B}── UjamaaDAO dev status ──${N}"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'NAMES|ujamaa' || true
  echo
  local h url wpid
  h="$(curl -s --max-time 5 "$HEALTH_URL" 2>/dev/null)"
  [ -n "$h" ] && ok "API: $HEALTH_URL → $h" || warn "API: not responding on $HEALTH_URL"
  url="$(ngrok_url)"
  [ -n "$url" ] && ok "ngrok: $url  →  :$NGROK_PORT" || warn "ngrok: no tunnel on :4040"
  wpid="$(cat "$WATCH_PIDFILE" 2>/dev/null || true)"
  if pid_alive "$wpid"; then ok "webhook watcher: running (pid $wpid)"; else warn "webhook watcher: not running"; fi
  echo -e "${B}frontend${N} http://localhost:3000   ${B}MailHog${N} http://localhost:8025   ${B}ngrok UI${N} http://localhost:4040"
}

# ── Guard: never orchestrate the LOCAL dev stack on the prod droplet ──────────
if [ -z "${UJAMAA_FORCE_DEV:-}" ] && hostname -I 2>/dev/null | grep -qw "167.71.55.51"; then
  die "Refusing to run on the prod droplet (167.71.55.51). Use prod tooling, or set UJAMAA_FORCE_DEV=1."
fi

case "${1:-}" in
  up)     cmd_up ;;
  down)   cmd_down ;;
  status) cmd_status ;;
  *)      die "Usage: dev-stack.sh {up|down|status}" ;;
esac

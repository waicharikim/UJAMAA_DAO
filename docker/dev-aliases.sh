#!/usr/bin/env bash
# UjamaaDAO local dev aliases (laptop / dev machine — NOT the droplet).
# Prod counterpart: docker/server-aliases.sh (uj-* prefix).
#
# Usage: add this line to ~/.bashrc and/or ~/.zshrc:
#   source ~/UJAMAA_DAO/docker/dev-aliases.sh

# ── Guard: never load dev aliases on the production droplet ───────────────────
# Dev aliases drive the LOCAL working-tree compose stack. On the prod droplet
# that would point `ujamaa`/`ujamaa-up` at the dev compose against production.
# Bail out if we detect the prod host. Override with UJAMAA_FORCE_DEV=1.
if [ -z "${UJAMAA_FORCE_DEV:-}" ] && hostname -I 2>/dev/null | grep -qw "167.71.55.51"; then
  echo "⚠️  UjamaaDAO dev aliases NOT loaded — this looks like the prod droplet (167.71.55.51)."
  echo "    Use docker/server-aliases.sh here. (Set UJAMAA_FORCE_DEV=1 to override.)"
  return 0 2>/dev/null || exit 0
fi

UJAMAA_DIR="$HOME/UJAMAA_DAO/backend"
COMPOSE="docker compose -f $HOME/UJAMAA_DAO/docker/docker-compose.yml"

# ── Orchestration (whole system: compose + ngrok + webhook watcher) ──────────
alias ujamaa-up="$UJAMAA_DIR/scripts/dev-stack.sh up"        # bring up EVERYTHING
alias ujamaa-down="$UJAMAA_DIR/scripts/dev-stack.sh down"    # tear down EVERYTHING
alias ujamaa-status="$UJAMAA_DIR/scripts/dev-stack.sh status"

# ── Lifecycle (Docker stack only) ────────────────────────────────────────────
alias ujamaa="$COMPOSE up -d"                       # start full dev stack (detached)
alias ujamaa-dev="$COMPOSE up --build"              # rebuild + start in foreground
alias ujamaa-stop="$COMPOSE down"                   # stop docker only
alias ujamaa-restart="$COMPOSE restart web worker"  # restart app processes only

# ── Logs ─────────────────────────────────────────────────────────────────────
alias ujamaa-logs="docker logs -f ujamaa_web"
alias ujamaa-logs-worker="docker logs -f ujamaa_worker"
alias ujamaa-logs-frontend="docker logs -f ujamaa_frontend"

# ── Status ───────────────────────────────────────────────────────────────────
alias ujamaa-ps="docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'NAMES|ujamaa'"
alias ujamaa-health="curl -s http://localhost:4000/health; echo"

# ── ngrok (re-point the Telegram webhook after a tunnel reconnect) ────────────
alias ujamaa-ngrok="$UJAMAA_DIR/scripts/ngrok-sync.sh"            # auto-detect URL + sync once
alias ujamaa-ngrok-watch="$UJAMAA_DIR/scripts/ngrok-sync.sh --watch"  # auto re-sync on every change
alias ujamaa-ngrok-info="$UJAMAA_DIR/scripts/ngrok-sync.sh --info"    # show current Telegram webhook

# ── Shell / DB access ────────────────────────────────────────────────────────
alias ujamaa-shell="docker exec -it ujamaa_web sh"
alias ujamaa-db="docker exec -it ujamaa_postgres psql -U \${POSTGRES_USER:-ujamaa_user} -d \${POSTGRES_DB:-ujamaa_db}"
alias ujamaa-redis="docker exec -it ujamaa_redis redis-cli"

# ── Maintenance ──────────────────────────────────────────────────────────────
alias ujamaa-migrate="cd $UJAMAA_DIR && make db-migrate"
alias ujamaa-disk="df -h / && docker system df"

echo "✅  UjamaaDAO dev aliases loaded. Type 'ujamaa<tab>' to see all commands."

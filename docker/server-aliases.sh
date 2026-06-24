#!/usr/bin/env bash
# UjamaaDAO server aliases
# Usage: add this line to ~/.bashrc on the droplet:
#   source ~/UJAMAA_DAO/docker/server-aliases.sh

UJAMAA_DIR="$HOME/UJAMAA_DAO/backend"

# ── Lifecycle ────────────────────────────────────────────────────────────────
alias uj-up="cd $UJAMAA_DIR && make prod"
alias uj-down="cd $UJAMAA_DIR && make prod-down"
alias uj-restart="cd $UJAMAA_DIR && make prod-down && make prod"

# ── Deploy (pull prebuilt images from GHCR — preferred path) ──────────────────
# Images are built by GitHub Actions; the droplet pulls instead of compiling.
alias uj-pull="cd $UJAMAA_DIR && make prod-pull"
alias uj-deploy="cd $HOME/UJAMAA_DAO && git pull origin develop && cd backend && make prod-deploy"
alias uj-deploy-web="cd $HOME/UJAMAA_DAO && git pull origin develop && cd backend && make prod-deploy-web"
alias uj-deploy-worker="cd $HOME/UJAMAA_DAO && git pull origin develop && cd backend && make prod-deploy-worker"
alias uj-deploy-frontend="cd $HOME/UJAMAA_DAO && git pull origin develop && cd backend && make prod-deploy-frontend"

# ── Local build (fallback — compiles on the droplet; slow, RAM-heavy) ─────────
alias uj-build="cd $UJAMAA_DIR && make prod-build"
alias uj-build-web="cd $UJAMAA_DIR && make prod-rebuild-web"
alias uj-build-worker="cd $UJAMAA_DIR && make prod-rebuild-worker"
alias uj-build-frontend="cd $UJAMAA_DIR && make prod-rebuild-frontend"
alias uj-seed="cd $UJAMAA_DIR && make prod-seed"
# Direct exec shortcut (if make is unavailable)
alias uj-seed-direct="docker exec -e FORCE_SEED=true ujamaa_web node dist/core/database/seed.js"

# ── Logs ─────────────────────────────────────────────────────────────────────
alias uj-logs="cd $UJAMAA_DIR && make prod-logs"
alias uj-logs-web="cd $UJAMAA_DIR && make prod-logs-web"
alias uj-logs-worker="docker logs -f ujamaa_worker"
alias uj-logs-frontend="docker logs -f ujamaa_frontend"
alias uj-logs-traefik="docker logs -f ujamaa_traefik"

# ── Status ───────────────────────────────────────────────────────────────────
alias uj-ps="docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'NAMES|ujamaa'"
alias uj-health="curl -s https://api.ujamaadao.org/health | python3 -m json.tool"

# ── Shell access ─────────────────────────────────────────────────────────────
alias uj-shell="docker exec -it ujamaa_web sh"
alias uj-db="docker exec -it ujamaa_postgres psql -U \${POSTGRES_USER:-ujamaa_user} -d \${POSTGRES_DB:-ujamaa_db}"
alias uj-redis="docker exec -it ujamaa_redis redis-cli"

# ── Maintenance ───────────────────────────────────────────────────────────────
alias uj-prune="docker system prune -af && docker volume prune -f"
alias uj-disk="df -h / && docker system df"
alias uj-migrate="docker exec ujamaa_web npx prisma migrate deploy"
alias uj-backup="cd $UJAMAA_DIR && make prod-backup"
alias uj-backup-cron="cd $UJAMAA_DIR && make prod-backup-cron"
alias uj-make-admin='f() { cd ~/UJAMAA_DAO/backend && make prod-make-admin EMAIL="$1"; }; f'

echo "✅  UjamaaDAO aliases loaded. Type 'uj-<tab>' to see all commands."

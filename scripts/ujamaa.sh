#!/bin/bash
# ~/ujamaa-start.sh — UJAMAADAO ONE COMMAND TO RULE THEM ALL — 2025 ETERNAL

set -e

PROJECT_DIR="$HOME/UJAMAA_DAO"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.yml"
SWITCH_SCRIPT="$PROJECT_DIR/backend/scripts/db/switch-db.sh"

echo "UJAMAADAO — Starting the revolution..."

# 1. Make switch-db.sh executable
chmod +x "$SWITCH_SCRIPT" 2>/dev/null || true

# 2. Add permanent aliases (only once) — FIXED SYNTAX
for rcfile in ~/.bashrc ~/.zshrc; do
  if ! grep -q "UJAMAADAO — ETERNAL ALIASES" "$rcfile" 2>/dev/null; then
    cat >> "$rcfile" << 'EOF'

# UJAMAADAO — ETERNAL ALIASES (2025 FOREVER)
alias ujamaa="docker compose -f ~/UJAMAA_DAO/docker/docker-compose.yml up -d backend-dev"
alias ujamaa-dev="docker compose -f ~/UJAMAA_DAO/docker/docker-compose.yml up backend-dev --build"
alias ujamaa-main="~/UJAMAA_DAO/backend/scripts/db/switch-db.sh main"
alias ujamaa-test="~/UJAMAA_DAO/backend/scripts/db/switch-db.sh test"
alias ujamaa-current="~/UJAMAA_DAO/backend/scripts/db/db-current.sh"

alias ujamaa-status="docker ps --filter name=ujamaa_backend_dev"


alias ujamaa-logs="docker logs -f ujamaa_backend_dev"
alias ujamaa-stop="docker compose -f ~/UJAMAA_DAO/docker/docker-compose.yml down"
EOF
    echo "Aliases added to $rcfile"
  fi
done

# 3. Reload shell
source ~/.bashrc 2>/dev/null || true
source ~/.zshrc 2>/dev/null || true

# 4. Start the system
echo "Starting UJAMAADAO (main database)..."
docker compose -f "$COMPOSE_FILE" up -d backend-dev

echo ""
echo "UJAMAADAO IS ALIVE"
echo ""
echo "Commands ready (in any terminal, forever):"
echo "   ujamaa        → start / restart"
echo "   ujamaa-dev    → rebuild & start"
echo "   ujamaa-test   → switch to test DB"
echo "   ujamaa-main   → switch to main DB"
echo "   ujamaa-logs   → view logs"
echo "   ujamaa-stop   → stop everything"
echo ""
echo "Just open a new terminal and type: ujamaa"

# Show logs
docker logs -f ujamaa_backend_dev 2>/dev/null || true
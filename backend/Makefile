.PHONY: help dev dev-up dev-down dev-status ngrok-sync ngrok-watch prod prod-pull prod-deploy prod-deploy-web prod-deploy-worker prod-deploy-frontend prod-seed prod-set-webhook prod-webhook-info prod-rebuild-web prod-rebuild-worker prod-rebuild-frontend prod-backup prod-backup-cron up down restart logs clean backup setup-configs enable-observability check-configs

# Compose file location (relative to backend/)
COMPOSE_FILE := ../docker/docker-compose.yml
COMPOSE_PROD := ../docker/docker-compose.prod.yml
ENV_FILE     := ../docker/.env.prod

# Build cache toggle for prod builds. Default is a clean --no-cache build.
# Pass CACHE=1 for a fast cached rebuild (reuses completed layers — handy after
# a cancelled build, e.g. `make prod-rebuild-web CACHE=1`).
BUILD_FLAGS := $(if $(CACHE),,--no-cache)

# Default target
help:
	@echo "Ujamaa DAO - Docker Management"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev          - Start development environment (Version A)"
	@echo "  make logs         - View logs (all services)"
	@echo "  make logs-web     - View web server logs"
	@echo "  make logs-worker  - View worker logs"
	@echo "  make restart      - Restart all services"
	@echo "  make down         - Stop all services"
	@echo "  make clean        - Stop and remove volumes (DANGEROUS)"
	@echo ""
	@echo "Build Commands:"
	@echo "  make build        - Build images"
	@echo "  make build-nc     - Build images (no cache)"
	@echo ""
	@echo "Upgrade to Version B (Observability):"
	@echo "  make check-configs       - Check which observability services are configured"
	@echo "  make setup-configs       - Copy ALL config templates (one-time setup)"
	@echo "  make enable-monitoring   - Enable Prometheus + Grafana"
	@echo "  make enable-logging      - Enable Loki + Fluent-bit"
	@echo "  make enable-tracing      - Enable Jaeger"
	@echo "  make enable-service-mesh - Enable Envoy sidecars"
	@echo "  make enable-all          - Enable full Version B stack"
	@echo "  make disable-observability - Revert to Version A"
	@echo ""
	@echo "Database Commands:"
	@echo "  make db-shell     - Access PostgreSQL shell"
	@echo "  make db-migrate   - Run Prisma migrations"
	@echo "  make db-push      - Push schema changes"
	@echo "  make db-studio    - Open Prisma Studio"
	@echo "  make db-reset     - Reset database (DANGEROUS)"
	@echo "  make backup       - Create database backup"
	@echo ""
	@echo "Production Commands:"
	@echo "  make prod                  - Start production environment"
	@echo "  make prod-seed             - Force-seed database (one-time use)"
	@echo "  make prod-make-admin EMAIL=x - Grant super_admin role to a user"
	@echo ""
	@echo "  Deploy (pull prebuilt images from GHCR — preferred):"
	@echo "  make prod-deploy           - Pull + restart all services"
	@echo "  make prod-deploy-web       - Pull + restart web only"
	@echo "  make prod-deploy-worker    - Pull + restart worker only"
	@echo "  make prod-deploy-frontend  - Pull + restart frontend only"
	@echo "  make prod-backup           - Backup the prod DB (gzip + off-box if configured)"
	@echo "  make prod-backup-cron      - Install the daily 02:00 backup cron"
	@echo "  make prod-set-webhook      - Point the Telegram bot's webhook at this box"
	@echo "  make prod-webhook-info     - Show the bot's current Telegram webhook"
	@echo ""
	@echo "  Local build (fallback — compiles on this box):"
	@echo "  make prod-build            - Rebuild all production images"
	@echo "  make prod-rebuild-web      - Rebuild + restart web (API) only"
	@echo "  make prod-rebuild-worker   - Rebuild + restart worker only"
	@echo "  make prod-rebuild-frontend - Rebuild + restart frontend only"
	@echo ""

# Development
dev:
	@echo "Starting development environment (Version A - Simple)..."
	@docker compose -f $(COMPOSE_FILE) up -d
	@echo ""
	@echo "✅ Services started!"
	@echo "   API: http://localhost:4000"
	@echo "   Traefik: http://localhost:8080"
	@echo ""
	@echo "💡 Want observability? Run: make check-configs"

# Orchestrate the whole local dev system: compose up -> wait health -> ngrok ->
# sync Telegram webhook -> background webhook watcher. (Local working tree only.)
dev-up:
	@./scripts/dev-stack.sh up

# Tear it all down: stop watcher + ngrok + compose down.
dev-down:
	@./scripts/dev-stack.sh down

# Show containers, API health, ngrok URL, and watcher state.
dev-status:
	@./scripts/dev-stack.sh status

# Re-point the Telegram webhook at the current ngrok tunnel (auto-detects the URL).
# Pass URL=https://xxx.ngrok-free.app to feed one in manually instead.
ngrok-sync:
	@./scripts/ngrok-sync.sh $(URL)

# Keep running: auto re-syncs the webhook whenever ngrok's URL changes.
ngrok-watch:
	@./scripts/ngrok-sync.sh --watch

# Production
prod:
	@echo "Starting production environment..."
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d

prod-down:
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) down

prod-logs:
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) logs -f

prod-logs-web:
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) logs -f web

prod-seed:
	@echo "Force-seeding production database (one-time use)..."
	@docker exec -e FORCE_SEED=true ujamaa_web node dist/core/database/seed.js

prod-make-admin:
	@test -n "$(EMAIL)" || (echo "Usage: make prod-make-admin EMAIL=user@example.com" && exit 1)
	@docker exec ujamaa_postgres psql -U $${POSTGRES_USER:-ujamaa_user} -d $${POSTGRES_DB:-ujamaa_db} -c \
		"INSERT INTO user_roles (id, \"userId\", \"roleId\") \
		 SELECT gen_random_uuid(), u.id, r.id \
		 FROM users u, roles r \
		 WHERE u.email = '$(EMAIL)' AND r.name = 'system:super_admin' \
		 ON CONFLICT DO NOTHING; \
		 INSERT INTO audit_logs (id, \"userId\", action, \"entityType\", \"entityId\", metadata) \
		 SELECT gen_random_uuid(), u.id, 'ROLE_ASSIGNED', 'User', u.id, \
		   '{\"role\":\"system:super_admin\",\"grantedBy\":\"ops:prod-make-admin\",\"method\":\"manual-sql\"}'::jsonb \
		 FROM users u WHERE u.email = '$(EMAIL)'; \
		 SELECT u.email, r.name FROM users u \
		 JOIN user_roles ur ON ur.\"userId\" = u.id \
		 JOIN roles r ON r.id = ur.\"roleId\" \
		 WHERE u.email = '$(EMAIL)';"

# ── Telegram webhook (prod) ───────────────────────────────────────────────────
# Point the prod bot's webhook at this box. The URL is derived from BASE_URL in
# .env.prod, so it follows the domain — a stable prod domain makes this a
# set-once step; re-run only after moving boxes (DNS repoint) or rotating the
# token/secret. Dev uses `make ngrok-sync` instead (ngrok's URL rotates).
prod-set-webhook:
	@./scripts/set-webhook.sh

prod-webhook-info:
	@./scripts/set-webhook.sh --info

prod-build:
	@echo "Building production images... (CACHE=1 for a cached build)"
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) build $(BUILD_FLAGS)

prod-rebuild-web:
	@echo "Rebuilding and restarting web service... (CACHE=1 for a cached build)"
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) build $(BUILD_FLAGS) web
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d web

prod-rebuild-worker:
	@echo "Rebuilding and restarting worker service... (CACHE=1 for a cached build)"
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) build $(BUILD_FLAGS) worker
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d worker

prod-rebuild-frontend:
	@echo "Rebuilding and restarting frontend service... (CACHE=1 for a cached build)"
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) build $(BUILD_FLAGS) frontend
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d frontend

# ── Pull-based deploys ────────────────────────────────────────────────────────
# Images are built by GitHub Actions and pushed to GHCR, so the droplet pulls
# instead of compiling (the backend build alone wants 3 GB heap and OOMs here).
# Use these for normal deploys; the prod-rebuild-* targets above stay as a
# local-build fallback.
prod-pull:
	@echo "Pulling prebuilt images from GHCR..."
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) pull

prod-deploy:
	@echo "Deploying (pull + restart all)..."
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) pull
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d

prod-deploy-web:
	@echo "Deploying web (pull + restart)..."
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) pull web
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d web

prod-deploy-worker:
	@echo "Deploying worker (pull + restart)..."
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) pull worker
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d worker

prod-deploy-frontend:
	@echo "Deploying frontend (pull + restart)..."
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) pull frontend
	@docker compose -f $(COMPOSE_PROD) --env-file $(ENV_FILE) up -d frontend

# Production database backup (timestamped, gzip, retention + optional off-box).
prod-backup:
	@ENV_FILE=$(ENV_FILE) bash ../docker/backup-db.sh

# Install the daily 02:00 backup cron (idempotent — re-running just updates it).
prod-backup-cron:
	@SCRIPT="$$(cd ../docker && pwd)/backup-db.sh"; \
	LOGDIR="$${BACKUP_DIR:-$$HOME/ujamaa-backups}"; \
	mkdir -p "$$LOGDIR"; \
	LINE="0 2 * * * $$SCRIPT >> $$LOGDIR/backup.log 2>&1"; \
	( crontab -l 2>/dev/null | grep -v 'backup-db.sh'; echo "$$LINE" ) | crontab -; \
	echo "Installed daily 02:00 backup cron:"; crontab -l | grep 'backup-db.sh'

# Common operations
up:
	@docker compose -f $(COMPOSE_FILE) up -d

down:
	@docker compose -f $(COMPOSE_FILE) down

restart:
	@docker compose -f $(COMPOSE_FILE) restart

logs:
	@docker compose -f $(COMPOSE_FILE) logs -f

logs-web:
	@docker compose -f $(COMPOSE_FILE) logs -f web

logs-worker:
	@docker compose -f $(COMPOSE_FILE) logs -f worker

logs-monitoring:
	@docker compose -f $(COMPOSE_FILE) logs -f prometheus grafana loki

# Build commands
build:
	@echo "Building images..."
	@docker compose -f $(COMPOSE_FILE) build

build-nc:
	@echo "Building images (no cache)..."
	@docker compose -f $(COMPOSE_FILE) build --no-cache

clean:
	@echo "WARNING: This will delete all volumes and data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose -f $(COMPOSE_FILE) down -v; \
		echo "Cleaned!"; \
	fi

# Check current observability configuration
check-configs:
	@echo "Checking observability configuration..."
	@echo ""
	@echo "Config directories (relative to project root):"
	@[ -d "../envoy" ] && echo "  ✅ envoy/" || echo "  ❌ envoy/ (not configured)"
	@[ -d "../fluent-bit" ] && echo "  ✅ fluent-bit/" || echo "  ❌ fluent-bit/ (not configured)"
	@[ -d "../prometheus" ] && echo "  ✅ prometheus/" || echo "  ❌ prometheus/ (not configured)"
	@[ -d "../grafana" ] && echo "  ✅ grafana/" || echo "  ❌ grafana/ (not configured)"
	@[ -d "../loki" ] && echo "  ✅ loki/" || echo "  ❌ loki/ (not configured)"
	@[ -d "../jaeger" ] && echo "  ✅ jaeger/" || echo "  ❌ jaeger/ (not configured)"
	@[ -d "../statsd" ] && echo "  ✅ statsd/" || echo "  ❌ statsd/ (not configured)"
	@echo ""
	@echo "Docker Compose profile status:"
	@grep -q "COMPOSE_PROFILES=monitoring" .env 2>/dev/null && echo "  ✅ Monitoring enabled" || echo "  ❌ Monitoring disabled"
	@grep -q "COMPOSE_PROFILES=.*logging" .env 2>/dev/null && echo "  ✅ Logging enabled" || echo "  ❌ Logging disabled"
	@grep -q "COMPOSE_PROFILES=.*tracing" .env 2>/dev/null && echo "  ✅ Tracing enabled" || echo "  ❌ Tracing disabled"
	@grep -q "COMPOSE_PROFILES=.*service-mesh" .env 2>/dev/null && echo "  ✅ Service mesh enabled" || echo "  ❌ Service mesh disabled"
	@echo ""
	@echo "Run 'make setup-configs' to initialize all config directories"

# Setup ALL configuration files (one-time)
setup-configs:
	@echo "Setting up ALL observability configuration files..."
	@mkdir -p ../envoy ../fluent-bit ../statsd ../prometheus ../grafana/provisioning ../grafana/dashboards ../loki ../jaeger
	@echo "Copying templates..."
	@cp -r ../config-templates/envoy/* ../envoy/ 2>/dev/null || echo "  ⚠️  No envoy templates found"
	@cp -r ../config-templates/fluent-bit/* ../fluent-bit/ 2>/dev/null || echo "  ⚠️  No fluent-bit templates found"
	@cp -r ../config-templates/statsd/* ../statsd/ 2>/dev/null || echo "  ⚠️  No statsd templates found"
	@cp -r ../config-templates/prometheus/* ../prometheus/ 2>/dev/null || echo "  ⚠️  No prometheus templates found"
	@cp -r ../config-templates/grafana/* ../grafana/ 2>/dev/null || echo "  ⚠️  No grafana templates found"
	@cp -r ../config-templates/loki/* ../loki/ 2>/dev/null || echo "  ⚠️  No loki templates found"
	@cp -r ../config-templates/jaeger/* ../jaeger/ 2>/dev/null || echo "  ⚠️  No jaeger templates found"
	@echo ""
	@echo "✅ Configuration directories created!"
	@echo ""
	@echo "📖 Next steps:"
	@echo "   Choose what to enable:"
	@echo "   - make enable-monitoring    (Prometheus + Grafana)"
	@echo "   - make enable-logging       (Loki + Fluent-bit)"
	@echo "   - make enable-tracing       (Jaeger)"
	@echo "   - make enable-service-mesh  (Envoy sidecars)"
	@echo "   - make enable-all           (Everything)"

# Enable specific observability features
enable-monitoring:
	@echo "Enabling monitoring stack (Prometheus + Grafana)..."
	@grep -q "COMPOSE_PROFILES=" .env 2>/dev/null || echo "COMPOSE_PROFILES=" >> .env
	@sed -i.bak 's/COMPOSE_PROFILES=\(.*\)/COMPOSE_PROFILES=\1,monitoring/' .env
	@sed -i.bak 's/,,/,/g; s/^,//; s/,$$//' .env
	@docker compose -f $(COMPOSE_FILE) up -d prometheus grafana
	@echo "✅ Monitoring enabled!"
	@echo "   Prometheus: http://localhost:9090"
	@echo "   Grafana: http://localhost:3001 (admin/admin)"

enable-logging:
	@echo "Enabling logging stack (Loki + Fluent-bit)..."
	@grep -q "COMPOSE_PROFILES=" .env 2>/dev/null || echo "COMPOSE_PROFILES=" >> .env
	@sed -i.bak 's/COMPOSE_PROFILES=\(.*\)/COMPOSE_PROFILES=\1,logging/' .env
	@sed -i.bak 's/,,/,/g; s/^,//; s/,$$//' .env
	@docker compose -f $(COMPOSE_FILE) up -d loki fluent-bit
	@echo "✅ Logging enabled!"
	@echo "   Loki: http://localhost:3100"
	@echo "   View logs in Grafana: http://localhost:3001"

enable-tracing:
	@echo "Enabling tracing (Jaeger)..."
	@grep -q "COMPOSE_PROFILES=" .env 2>/dev/null || echo "COMPOSE_PROFILES=" >> .env
	@sed -i.bak 's/COMPOSE_PROFILES=\(.*\)/COMPOSE_PROFILES=\1,tracing/' .env
	@sed -i.bak 's/,,/,/g; s/^,//; s/,$$//' .env
	@docker compose -f $(COMPOSE_FILE) up -d jaeger
	@echo "✅ Tracing enabled!"
	@echo "   Jaeger UI: http://localhost:16686"

enable-service-mesh:
	@echo "Enabling service mesh (Envoy sidecars)..."
	@grep -q "COMPOSE_PROFILES=" .env 2>/dev/null || echo "COMPOSE_PROFILES=" >> .env
	@sed -i.bak 's/COMPOSE_PROFILES=\(.*\)/COMPOSE_PROFILES=\1,service-mesh/' .env
	@sed -i.bak 's/,,/,/g; s/^,//; s/,$$//' .env
	@docker compose -f $(COMPOSE_FILE) up -d
	@echo "✅ Service mesh enabled!"
	@echo "   Envoy admin (API): http://localhost:9901"
	@echo "   Envoy admin (Worker): http://localhost:9902"

enable-all:
	@echo "Enabling FULL Version B stack..."
	@echo "COMPOSE_PROFILES=monitoring,logging,tracing,service-mesh" > .env.tmp
	@cat .env 2>/dev/null | grep -v "^COMPOSE_PROFILES=" >> .env.tmp || true
	@mv .env.tmp .env
	@docker compose -f $(COMPOSE_FILE) up -d
	@echo ""
	@echo "✅ Full observability stack enabled!"
	@echo ""
	@echo "Services running:"
	@echo "   API: http://localhost:4000"
	@echo "   Traefik: http://localhost:8080"
	@echo "   Prometheus: http://localhost:9090"
	@echo "   Grafana: http://localhost:3001 (admin/admin)"
	@echo "   Jaeger: http://localhost:16686"
	@echo "   Loki: http://localhost:3100"

disable-observability:
	@echo "Disabling all observability services (reverting to Version A)..."
	@sed -i.bak '/^COMPOSE_PROFILES=/d' .env 2>/dev/null || true
	@docker compose -f $(COMPOSE_FILE) down prometheus grafana loki fluent-bit jaeger statsd-exporter
	@docker compose -f $(COMPOSE_FILE) up -d
	@echo "✅ Reverted to Version A (simple mode)"

# Database operations
db-shell:
	@docker compose -f $(COMPOSE_FILE) exec postgres psql -U ujamaa_user -d ujamaa_db

db-migrate:
	@docker compose -f $(COMPOSE_FILE) exec web npx prisma migrate dev

db-push:
	@docker compose -f $(COMPOSE_FILE) exec web npx prisma db push

db-studio:
	@docker compose -f $(COMPOSE_FILE) exec web npx prisma studio

db-reset:
	@echo "WARNING: This will reset the database!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose -f $(COMPOSE_FILE) exec web npx prisma migrate reset; \
	fi

backup:
	@echo "Creating database backup..."
	@mkdir -p ./backups
	@docker compose -f $(COMPOSE_FILE) exec postgres pg_dump -U ujamaa_user ujamaa_db | gzip > ./backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup created in ./backups/"

# Redis operations
redis-cli:
	@docker compose -f $(COMPOSE_FILE) exec redis redis-cli

# Container shell access
shell-web:
	@docker compose -f $(COMPOSE_FILE) exec web bash

shell-worker:
	@docker compose -f $(COMPOSE_FILE) exec worker bash

# Check service status
ps:
	@docker compose -f $(COMPOSE_FILE) ps

# View configuration
config:
	@docker compose -f $(COMPOSE_FILE) config

# Development helpers
install:
	@echo "Installing npm dependencies..."
	@npm ci

test:
	@echo "Running tests..."
	@npm test

test-watch:
	@echo "Running tests in watch mode..."
	@npm run test:watch

lint:
	@npm run lint

lint-fix:
	@npm run lint:fix

format:
	@npm run format

# Local development (without Docker)
dev-local:
	@echo "Starting local development (no Docker)..."
	@npm run dev

worker-local:
	@echo "Starting worker locally (no Docker)..."
	@npm run dev:worker

# Quick restart specific services
restart-web:
	@docker compose -f $(COMPOSE_FILE) restart web

restart-worker:
	@docker compose -f $(COMPOSE_FILE) restart worker

restart-db:
	@docker compose -f $(COMPOSE_FILE) restart postgres

restart-redis:
	@docker compose -f $(COMPOSE_FILE) restart redis

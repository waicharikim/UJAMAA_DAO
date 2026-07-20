# UjamaaDAO — Infrastructure Reference

> **New collaborator?** Start with [`SETUP.md`](../SETUP.md) at the repo root — it covers clone-to-running in one page.
> This document is the deeper reference for Docker architecture, environment variables, and production deployment.

---

## Active Services (`make dev`)

| Container | Host Port | Purpose |
|---|---|---|
| `ujamaa_web` | 4000 | Express REST API |
| `ujamaa_worker` | — | BullMQ background jobs |
| `ujamaa_postgres` | 5432 | Main PostgreSQL database |
| `ujamaa_postgres_test` | 5433 | Test database (isolated) |
| `ujamaa_redis` | 6380 | Redis — cache + BullMQ queues |
| `ujamaa_frontend` | 3000 | Next.js frontend |
| `ujamaa_mailhog` | 8025 (UI) / 1025 (SMTP) | Email catcher (dev only) |

Traefik is disabled in dev (see ADR-023). Services use direct port access.

---

## Architecture

```
[Browser]
    ↓ localhost:3000
[Frontend — Next.js]
    ↓ localhost:4000/api/v1
[Web Container — Express]
    ├─→ [PostgreSQL :5432]    (Prisma ORM)
    ├─→ [Redis :6379]         (rate limiting + event pub/sub)
    └─→ [BullMQ Queue]        (enqueue background jobs)
              ↓
    [Worker Container]
         ├─→ Process jobs (economy, user cleanup, auth cleanup)
         └─→ Event handlers (PR awards, notifications)
```

---

## Environment Variables

All variables are documented in `.env.example`. Defaults work for local dev — no changes needed.

### Key variables

```bash
# Application
NODE_ENV=development
PORT=4000
JWT_SECRET=<64 char hex>          # openssl rand -hex 32
ENCRYPTION_KEY=<64 char hex>      # openssl rand -hex 32 — required for 2FA/TOTP

# Database
DATABASE_URL=postgresql://ujamaa_user:ujamaa_pass@postgres:5432/ujamaa_db

# Redis (BullMQ uses HOST+PORT, not URL)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379      # rate-limiter only

# URLs
BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# Email — MailHog in dev (no auth required)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM=noreply@ujamaadao.org

# SMS — Africa's Talking
ENABLE_SMS=false
AT_API_KEY=
AT_USERNAME=sandbox

# Blockchain (worker only — not needed for dev)
MINTER_PRIVATE_KEY=
PR_TOKEN_ADDRESS=
UT_TOKEN_ADDRESS=
```

### Important notes

- **Never use `localhost`** in Docker env vars — use service names (`postgres`, `redis`, `mailhog`)
- **`ENCRYPTION_KEY`** — silently empty by default; set before enabling TOTP/2FA
- **`MINTER_PRIVATE_KEY`** — backend EOA for minting PR/UT tokens; not needed until contracts are deployed

---

## Common Commands

```bash
make dev              # Start all services
make logs             # View all logs
make logs-web         # API server logs
make logs-worker      # Worker logs
make restart          # Restart all services
make down             # Stop all services
make clean            # Stop + delete volumes (DESTRUCTIVE)

make db-shell         # PostgreSQL shell
make db-migrate       # Run Prisma migrations
make db-studio        # Prisma Studio UI
make db-reset         # Reset database (DESTRUCTIVE)
make backup           # Dump database to file
```

---

## Troubleshooting

**Services won't start**
```bash
docker ps               # See what's running
make logs               # Check for errors
make down && make dev   # Fresh start
```

**Worker crash: `redischeck.sh: Permission denied`**
```bash
chmod +x backend/docker/*.sh
make restart
```

**Email not arriving in MailHog**
```bash
# Confirm SMTP_HOST is 'mailhog', not an IP
grep SMTP_HOST docker/docker-compose.yml

# Check MailHog is running
docker ps | grep mailhog

# Check logs for SMTP errors
make logs-web | grep -i smtp
```

**env var changes not taking effect**
```bash
# 'make restart' reuses containers — use force-recreate:
docker compose -f ../docker/docker-compose.yml up -d --force-recreate
```

**tsx watch silently stops after a crash**
```bash
touch backend/src/app.ts    # Touch any watched file to trigger restart
```

**Prisma schema out of sync**
```bash
docker exec ujamaa_web npm run db:merge    # Regenerate prisma/schema.prisma
make db-migrate
```

---

## Production Deployment

### 1. Prepare environment

```bash
cp .env.example .env.prod
# Edit .env.prod:
#   NODE_ENV=production
#   JWT_SECRET=$(openssl rand -hex 32)
#   ENCRYPTION_KEY=$(openssl rand -hex 32)
#   DATABASE_URL=postgresql://... (production DB)
#   SMTP_HOST=<real SMTP provider>
#   DASHBOARD_PASSWORD=<strong password>
#   FRONTEND_URL=https://your-domain.com
```

### 2. Enable Traefik

In `docker/docker-compose.yml`, uncomment the `traefik` service block (see ADR-023).

In `traefik/traefik.yml`, enable Let's Encrypt:
```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your@email.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

Ensure `traefik/acme.json` has `chmod 600`.

### 3. Deploy

Images are built in CI (GitHub Actions → GHCR) and pulled on the droplet — it
no longer compiles locally. Authenticate once with `docker login ghcr.io -u waicharikim`.

```bash
make prod-deploy   # pull prebuilt images from GHCR + restart (normal path)
docker compose -f ../docker/docker-compose.prod.yml exec web npx prisma migrate deploy

# Fallback only — build on the droplet (slow, 3 GB heap, may OOM on 2 GB box):
make prod-build && make prod
```

### Production checklist

- [ ] All secrets rotated from dev defaults
- [ ] `ENCRYPTION_KEY` set (64 hex chars)
- [ ] Real SMTP credentials configured
- [ ] `DASHBOARD_PASSWORD` changed from default
- [ ] `ALLOWED_ORIGINS` set to your domain only
- [ ] `traefik/acme.json` has `chmod 600`
- [ ] Traefik service uncommented and domain configured
- [ ] Database backups scheduled

---

## Observability (when needed)

Prometheus, Grafana, Loki, Jaeger and Envoy sidecars are pre-configured but disabled. Enable when you have real users and need SLAs or debugging visibility.

```bash
make check-configs          # Check what's available
make setup-configs          # Copy config templates (one-time)
make enable-monitoring      # Prometheus + Grafana
make enable-logging         # Loki + Fluent-bit
make enable-tracing         # Jaeger
make enable-all             # Full observability stack
make disable-observability  # Revert to simple mode
```

See `UPGRADE-GUIDE.md` for the full observability upgrade path.

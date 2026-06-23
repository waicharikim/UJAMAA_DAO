# UjamaaDAO Server Runbook

**Server:** DigitalOcean droplet `167.71.55.51`
**Domains:** `ujamaadao.org` (frontend) · `api.ujamaadao.org` (backend)
**Repo path:** `~/UJAMAA_DAO/`
**Makefile path:** `~/UJAMAA_DAO/backend/`

---

## First-Time Setup (run once on the droplet)

```bash
# 1. Add aliases to shell
echo "source ~/UJAMAA_DAO/docker/server-aliases.sh" >> ~/.bashrc
source ~/.bashrc

# 2. Authenticate to GHCR so the droplet can pull prebuilt images
#    (PAT needs read:packages; or make the packages public to skip this)
docker login ghcr.io -u waicharikim

# 3. Confirm aliases loaded
uj-ps
```

---

## How deploys work (CI build → droplet pull)

Production images are **built by GitHub Actions, not on the droplet.** The 2 GB
droplet OOMs/swap-thrashes when compiling (the backend build alone asks for 3 GB
of heap), so it just pulls finished images instead.

- On every push to `develop` touching `frontend/**` or `backend/**`, the
  workflows in `.github/workflows/build-frontend.yml` and `build-backend.yml`
  build and push to GHCR:
  - `ghcr.io/waicharikim/ujamaa-frontend`
  - `ghcr.io/waicharikim/ujamaa-web`
  - `ghcr.io/waicharikim/ujamaa-worker`
- Each build is tagged `latest` **and** `sha-<shortsha>` (pin/rollback).
- The compose file references `${*_IMAGE:-ghcr...:latest}`, so `uj-deploy`
  pulls these. The local `build:` blocks remain only as a fallback (`uj-build*`).

**Roll back to a specific build** by exporting the pinned tag before deploying:

```bash
WEB_IMAGE=ghcr.io/waicharikim/ujamaa-web:sha-1a2b3c4 uj-up
```

---

## Daily Operations

### Deploy a new version

```bash
uj-deploy
# Equivalent to: git pull origin develop → make prod-deploy
#   (= docker compose pull → up -d). Pulls images CI already built; the droplet
#   compiles nothing. Wait for the GitHub Actions build to go green first.

# Single service:
uj-deploy-web        # pull + restart web only
uj-deploy-worker     # pull + restart worker only
uj-deploy-frontend   # pull + restart frontend only

# Pull images without restarting:
uj-pull
```

> **Fallback — build on the droplet** (slow, RAM-heavy; only if CI is down):
> `uj-build` / `uj-build-web` / `uj-build-worker` / `uj-build-frontend`.

### Check everything is running

```bash
uj-ps        # all ujamaa containers + status
uj-health    # curl api.ujamaadao.org/health → {"success":true,"status":"ok"}
```

### View live logs

```bash
uj-logs              # all services, follow
uj-logs-web          # API (web) only
uj-logs-worker       # background job worker
uj-logs-frontend     # Next.js frontend
uj-logs-traefik      # Traefik (SSL / routing)
```

### Restart without rebuilding

```bash
uj-restart    # down → up (uses existing images)
```

---

## Super Admin

### Grant super admin to a user

The user must have registered first. Then:

```bash
# Via alias (after sourcing server-aliases.sh)
uj-make-admin waicharikimani@gmail.com

# Via Makefile
cd ~/UJAMAA_DAO/backend && make prod-make-admin EMAIL=waicharikimani@gmail.com

# Via raw SQL
docker exec ujamaa_postgres psql -U ujamaa_user -d ujamaa_db \
  -c "UPDATE users SET roles = array_append(roles, 'system:super_admin') WHERE email = 'user@example.com' AND NOT ('system:super_admin' = ANY(roles)); SELECT email, roles FROM users WHERE email = 'user@example.com';"
```

**Important:** Roles are embedded in the JWT at login time — the user must **log out and back in** after the role is granted for it to take effect.

### Verify the role was applied

```bash
docker exec ujamaa_postgres psql -U ujamaa_user -d ujamaa_db \
  -c "SELECT email, roles FROM users WHERE email = 'user@example.com';"
```

---

## Database

### Open a psql shell

```bash
uj-db
# Connects to ujamaa_postgres as the configured POSTGRES_USER
```

### Run pending migrations manually

```bash
uj-migrate
# Runs: prisma migrate deploy inside the web container
```

### Seed the database (first deploy only)

```bash
uj-seed
# Runs make prod-seed — starts with FORCE_SEED=true
# Safe to re-run: seed data uses upserts, won't duplicate
```

### Backup the database

```bash
cd ~/UJAMAA_DAO/backend && make backup
# Writes a .sql.gz to backend/backups/
```

---

## Disk & Resources

```bash
uj-disk      # shows / usage + docker volume sizes

# If disk is critically low, prune stopped containers + dangling images:
uj-prune     # docker system prune -af + volume prune (removes unused volumes only)
```

### Typical disk consumers

| What | Where |
|---|---|
| Docker build cache | `docker system df` |
| Old images from failed builds | `docker image prune -af` |
| Postgres data volume | `pgdata` — do NOT prune |
| Redis data volume | `redis_data` — do NOT prune |

---

## Container Shell Access

```bash
uj-shell     # sh inside ujamaa_web (run one-off commands, inspect files)
uj-redis     # redis-cli inside ujamaa_redis
uj-db        # psql inside ujamaa_postgres
```

---

## Secrets & Config

All secrets live in `~/UJAMAA_DAO/docker/.env.prod` (gitignored — never committed).

| Variable | What it controls |
|---|---|
| `JWT_SECRET` | Session token signing |
| `ENCRYPTION_KEY` | AES encryption for sensitive fields |
| `TELEGRAM_BOT_TOKEN` | Baraza bot |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook validation |
| `CLAUDE_API_KEY` | Baraza AI (leave empty to disable) |
| `BUNI_*` | M-Pesa STK push via Buni by KCB |
| `SMTP_*` | Transactional email |
| `POSTGRES_USER/PASSWORD/DB` | Database credentials |

After editing `.env.prod`, apply with:

```bash
uj-restart    # picks up new env vars (no rebuild needed)
```

---

## Telegram Bot Webhook

Register (or re-register after a redeploy):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api.ujamaadao.org/api/v1/integration/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

Verify:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## SSL / Traefik

Traefik handles Let's Encrypt automatically. Certificates are stored in `~/UJAMAA_DAO/traefik/acme.json` (must be `chmod 600`).

```bash
# If Traefik fails to start with permission error:
chmod 600 ~/UJAMAA_DAO/traefik/acme.json
uj-restart
```

---

## Incident Checklist

**API returning 502/503:**
1. `uj-ps` — is `ujamaa_web` running?
2. `uj-logs-web` — check for crash or OOM
3. `uj-logs-traefik` — check routing errors
4. If container exited: `uj-up` to restart

**Frontend not loading:**
1. `uj-ps` — is `ujamaa_frontend` running?
2. `uj-logs-frontend` — Next.js errors
3. Check Traefik routing: `uj-logs-traefik`

**Jobs not running:**
1. `uj-ps` — is `ujamaa_worker` running?
2. `uj-logs-worker` — BullMQ errors
3. Bull Board: `https://api.ujamaadao.org/admin/queues` (requires `DASHBOARD_PASSWORD`)

**Database connection errors:**
1. `uj-ps` — is `ujamaa_postgres` healthy?
2. `uj-db` — can you connect manually?
3. Check `DATABASE_URL` in `.env.prod` matches container service name (`postgres`)

**Disk full:**
1. `uj-disk` — confirm
2. `docker image prune -af` — remove old images first (safe)
3. Only run `uj-prune` if no builds are in progress — it removes build cache

---

## Quick Reference

| Alias | What it does |
|---|---|
| `uj-up` | Start all prod containers |
| `uj-down` | Stop all prod containers |
| `uj-restart` | Stop then start (no rebuild) |
| `uj-deploy` | git pull + **pull images from GHCR** + start (normal deploy) |
| `uj-deploy-web` | git pull + pull + restart web only |
| `uj-deploy-worker` | git pull + pull + restart worker only |
| `uj-deploy-frontend` | git pull + pull + restart frontend only |
| `uj-pull` | Pull latest images from GHCR (no restart) |
| `uj-build` | **Fallback:** build all images on the droplet (no cache, slow) |
| `uj-build-web` | Fallback: build web image on the droplet + restart |
| `uj-build-worker` | Fallback: build worker image on the droplet + restart |
| `uj-build-frontend` | Fallback: build frontend image on the droplet + restart |
| `uj-seed` | Force-seed database (first deploy) |
| `uj-logs` | Tail all logs |
| `uj-logs-web` | Tail API logs only |
| `uj-ps` | Show container status |
| `uj-health` | Hit `/health` endpoint |
| `uj-shell` | Shell into web container |
| `uj-db` | psql shell |
| `uj-redis` | redis-cli shell |
| `uj-migrate` | Run pending migrations |
| `uj-make-admin <email>` | Grant super_admin role (log out + in after) |
| `uj-disk` | Disk + Docker volume usage |
| `uj-prune` | Remove unused Docker objects |

# UjamaaDAO — Collaborator Setup Guide

> One command starts everything. This guide gets a new developer from zero to running in under 10 minutes.

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Docker | 24+ | Runs all services |
| Docker Compose | v2 (bundled with Docker Desktop) | Orchestrates the stack |
| Git | any | Clone the repo |
| Node.js | 22 | Local tooling only (schema merge, tests) — not needed to run the app |

Check Docker is working:

```bash
docker --version          # Docker version 24+
docker compose version    # Docker Compose version v2+
```

---

## 1. Clone the Repository

```bash
git clone <repo-url> UJAMAA_DAO
cd UJAMAA_DAO
```

---

## 2. Environment Setup

### Backend env

```bash
cp backend/.env.example backend/.env
```

The defaults in `.env.example` work for local development — no edits needed to get running. In development:

- Database credentials are pre-set (`ujamaa_user` / `ujamaa_pass`)
- Redis uses default settings
- Emails are caught by MailHog (no real SMTP needed)
- JWT secret uses a development default (change before any shared environment)

For anything beyond local dev, generate real secrets:

```bash
openssl rand -hex 32    # Use output for JWT_SECRET and ENCRYPTION_KEY
```

### Frontend env

```bash
cp frontend/.env.local.example frontend/.env.local   # if the example exists
# OR create it manually:
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_PRIVY_APP_ID=cmm3oautu048e0djonwhybq5c
EOF
```

> `NEXT_PUBLIC_PRIVY_APP_ID` is the development Privy App ID. It is safe to commit — it is an App ID, not a secret. The Privy secret key lives server-side only.

---

## 3. Fix Script Permissions (first clone only)

Docker copies file permission bits from the host. Worker startup scripts must be executable:

```bash
chmod +x backend/docker/*.sh
```

The Traefik TLS certificate file also needs restricted permissions (already set if you cloned correctly, but verify):

```bash
chmod 600 traefik/acme.json
```

---

## 4. Start Everything

From the `backend/` directory:

```bash
cd backend
make dev
```

This single command starts **all 8 services**:

| Service | URL | Description |
|---|---|---|
| API (web) | http://localhost:4000 | Express REST API |
| Worker | — | BullMQ background jobs |
| PostgreSQL | localhost:5432 | Main database |
| PostgreSQL (test) | localhost:5433 | Isolated test database |
| Redis | localhost:6380 | Cache + job queues |
| Frontend | http://localhost:3000 | Next.js app |
| MailHog | http://localhost:8025 | Catches all dev emails |
| Traefik | http://localhost:8080 | Reverse proxy dashboard |

Wait ~30 seconds for services to become healthy, then check:

```bash
curl http://localhost:4000/health
# → {"success":true,"status":"ok"}
```

---

## 5. Apply Database Migrations (first run only)

```bash
make db-migrate
```

This runs Prisma migrations inside the `web` container. You should see all migrations applied cleanly. The schema has 80 models across 12 modules.

---

## 6. Verify Everything Is Working

```bash
# API health
curl http://localhost:4000/health

# Database + Prisma connected
curl http://localhost:4000/ready

# Frontend
open http://localhost:3000

# Email catcher (for magic links in dev)
open http://localhost:8025

# Queue dashboard (admin/admin123)
open http://localhost:4000/admin/queues
```

---

## 7. First End-to-End Test (Magic Link Flow)

1. Go to http://localhost:3000
2. Click **Get Started** → fill in the 4-step registration form
3. After submitting, go to **MailHog** at http://localhost:8025
4. Open the verification email, click the link
5. You land on the dashboard — you're authenticated

Or test the API directly:

```bash
# Register a new user
curl -s -X POST http://localhost:4000/api/v1/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "phoneNumber": "+254700000000",
    "primaryWardId": "00000000-0000-0000-0000-000000000001"
  }' | jq .

# Check MailHog for the link: http://localhost:8025
```

---

## 8. Running Tests

Tests require the test database container (`ujamaa_postgres_test` on port 5433), which starts automatically with `make dev`.

```bash
cd backend

# Run all 173 tests
npx vitest run

# Run by module
npx vitest run tests/auth/
npx vitest run tests/user/
npx vitest run tests/economy/

# Watch mode (re-runs on file save)
npx vitest
```

> Tests are isolated — they truncate the test DB before each test case. Never run tests against the dev DB.

---

## 9. Daily Dev Workflow

```bash
# Start services (if stopped)
cd backend && make dev

# View all logs
make logs

# View specific service logs
make logs-web        # API server
make logs-worker     # Background jobs

# Restart after config changes
make restart

# Stop everything
make down

# Database shell
make db-shell

# Rebuild after Dockerfile changes
make build
```

### Frontend hot reload

The frontend runs with hot reload in Docker — edit files in `frontend/` and changes appear immediately in the browser. No restart needed.

### Backend hot reload

The API server uses `tsx watch` and reloads on file save. If it silently pauses after an error, touch a watched file to trigger restart:

```bash
touch backend/src/app.ts
```

---

## 10. Adding Packages

### Backend

```bash
cd backend && npm install <package>
# Then rebuild the Docker image to pick up the new package:
make build && make dev
```

### Frontend

New packages are installed inside the Docker container (the `/app/node_modules` is an isolated anonymous volume):

```bash
# Install locally first (for type checking)
cd frontend && npm install <package>

# Install inside the running container
docker exec ujamaa_frontend npm install <package> --no-fund --no-audit

# Restart the frontend
docker restart ujamaa_frontend
```

---

## 11. Codebase Orientation

```
UJAMAA_DAO/
├── backend/src/
│   ├── app.ts           — Express app, middleware chain, route mounts
│   ├── index.ts         — Server entry + graceful shutdown
│   ├── workers.ts       — BullMQ worker (4 background jobs)
│   ├── core/            — Shared: logger, errors, RBAC, events, queue
│   └── modules/         — Feature modules (auth, user, economy, community…)
│
├── frontend/
│   ├── app/             — Next.js App Router pages (15 routes)
│   ├── components/      — UI components (layout, auth, dashboard…)
│   ├── contexts/        — Auth + wallet state
│   └── lib/api.ts       — Typed HTTP client (authApi, userApi, economyApi)
│
├── contracts/           — Solidity (Foundry) — scaffold, not yet written
├── docker/              — Docker Compose configs
├── traefik/             — Reverse proxy config
└── ai_workflows/        — Project context for AI sessions
    ├── SESSION_STATE.md — Read this first each session (live snapshot)
    ├── CLAUDE.md        — Full project brain (rules, conventions, status)
    └── PROGRESS_LOG.md  — Session-by-session build history
```

**API base URL**: `http://localhost:4000/api/v1`

All 12 module routes are mounted and functional. Three modules are fully tested (auth, user, economy — 173 tests green). The rest have routes and services but no tests yet.

---

## 12. Troubleshooting

**Services won't start**
```bash
make down && make dev        # Fresh start
docker compose logs traefik  # Check Traefik specifically
```

**Web server exits immediately**
```bash
make logs-web
# Common cause: JWT_SECRET too short (must be ≥64 chars in production)
# Dev default in docker-compose.yml is long enough
```

**Worker crash on start: `redischeck.sh: Permission denied`**
```bash
chmod +x backend/docker/*.sh
make restart
```

**Magic link emails not appearing in MailHog**
```bash
# Check MailHog is running
docker ps | grep mailhog

# Confirm SMTP_HOST is 'mailhog' (not an IP)
grep SMTP_HOST docker/docker-compose.yml
# Should show: SMTP_HOST=${SMTP_HOST:-mailhog}

# Check backend logs for email send errors
make logs-web | grep -i smtp
```

**Frontend: `Module not found` after adding a package**
```bash
docker exec ujamaa_frontend npm install --no-fund --no-audit
docker restart ujamaa_frontend
```

**Database migrations fail**
```bash
# Check the web container is running
docker ps | grep ujamaa_web

# Apply migrations manually
make db-migrate

# If schema is out of sync with code
docker exec ujamaa_web npm run db:merge   # regenerates prisma/schema.prisma
make db-migrate
```

**env var changes not picked up after `make restart`**
```bash
# 'restart' reuses existing containers — use this instead:
docker compose -f docker/docker-compose.yml up -d --force-recreate
```

**Port conflicts** — if any port is in use (4000, 3000, 5432, 6379, 8025), either stop the conflicting service or edit the port mapping in `docker/docker-compose.yml`.

---

## Non-Negotiable Rules

Before building any UI or API feature, read these:

1. **Marketplace = discovery only.** No payments, no checkout, no escrow.
2. **Real money via M-Pesa to platform accounts.** Never P2P.
3. **Blockchain is hybrid.** On-chain: PR/UT tokens, governance. Off-chain: all UX.
4. **PR token is soulbound.** No send/transfer UI. Earned UT has no cash-out.
5. **Blockchain is invisible to users.** No seed phrases, no gas warnings, no wallet addresses in UI.

Full rules and architectural decisions: `ai_workflows/CLAUDE.md`

---

*See `ai_workflows/SESSION_STATE.md` for current project status and next tasks.*

# CLAUDE.md — UjamaaDAO Project Brain

> This file is the single source of truth for every Claude session.
> Read it fully before writing any code, making any suggestion, or planning any feature.

---

## 1. What This Project Is

**UjamaaDAO** is a neighborhood sovereignty platform rooted in African Ujamaa philosophy — cooperative economics, familyhood, shared prosperity.

**Core thesis**: Real wards (Kenyan administrative units) become self-reliant economic, governance, and resilience units. Money and labor are traceable to measurable outcomes — a borehole drilled, a skill trained, clean water flowing.

**Target market**: Kenya first. Ward-based, mobile-first, M-Pesa-native, low-data-friendly.

**The test for every feature**: *"Does this help a ward build or maintain a borehole faster?"* If no, justify it or drop it.

---

## 2. Non-Negotiable Rules

Break these and the feature gets rejected, no exceptions.

**Rule 1 — Marketplace is discovery-only.**
No payments, no escrow, no transaction processing, no liability for trades. It finds people. That's it.

**Rule 2 — Real money flows through M-Pesa to platform-controlled accounts.**
Never P2P in-app. Dues, project contributions, and treasury deposits go to platform accounts. No exceptions.

**Rule 3 — Blockchain is hybrid from day one.**
On-chain: PR token, UT token, governance votes, treasury. Off-chain: profiles, discovery, education, emergency coordination, chat.

**Rule 4 — Token rules are fixed.**
- PR (Participation Rights): governance token, non-transferable (soulbound), monthly regen gated by activity, weighted voting, penalty system.
- UT (Utility Token): internal points only, cosmetic/visibility use, no cash-out for earned UT.
- Impact Points: reputation score, not spendable, not transferable.

**Rule 5 — Incentives must reflect real value creation.**
No grinding. No farming. Rewards must be causally linked to actions that create collective benefit.

**Rule 6 — Everything runs in Docker.**
No bare-metal instructions. Use service names (`postgres`, `redis`, `web`, `worker`). All dev/test/deploy via Docker Compose.

---

## 3. Current Progress (Updated: Feb 2026)

> **How to read this table:**
> - `scaffold` = directory + schema only, no working logic
> - `partial` = controllers/services/routes written, core logic exists, no tests, not verified end-to-end
> - `production-ready` = passes full checklist in section 6 (no module is here yet — zero tests exist)
>
> **Update this table at the end of every session that changes code.**

| Module | Status | Notes |
|---|---|---|
| auth | partial | 10+ handlers, 10+ services, routes, validators, prisma schema. SMS phone verification wired (AT SDK). Auth-cleanup BullMQ job added. 11 green unit tests. Most complete module. |
| user | partial | 7 handlers, services, routes, validators, prisma schema, cleanup job |
| economy | partial | Cron jobs (dues penalties, monthly regen), PR award logic, BullMQ jobs, event listeners |
| community | partial | Group management: controllers, services, routes, member event listeners |
| governance | partial | Proposal controllers, services, routes, prisma schema |
| projects | partial | Project lifecycle: controllers, services, routes, prisma schema |
| marketplace | partial | Listing controllers, services, routes, prisma schema. Discovery-only per Rule 1. |
| notifications | partial | Controllers, services, routes, prisma schema |
| onboarding | partial | Controllers, listeners, routes, services, seed data |
| emergency | partial | Controllers, services, routes, prisma schema |
| audit | partial | Controllers, services, routes, types |
| admin | partial | Handlers, services, routes, validators, RBAC integration |
| reputation | scaffold | Impact point + location impact services only — no routes or controllers |
| education | scaffold | Prisma schema only |
| treasury | scaffold | Prisma schema only |
| integration | scaffold | Empty directory |
| verification | scaffold | Empty directory |

**Cross-cutting gaps (apply to all modules):**
- Tests: auth module has **11 green unit tests** (`sendMagicLink` x2, `verifyEmailToken` x4, `verifyMagicLink` x5). All other modules: zero tests.
- `make dev` → `/health` ✅ verified 2026-02-22 — server responds `{"success":true,"status":"ok"}`
- `make dev` → `/ready` ✅ verified 2026-02-22 — Prisma connected, migration applied
- Worker container: `redischeck.sh` needs `chmod +x docker/*.sh` on host after fresh clone
- All 12 module routes mounted in `app.ts` ✅ (auth, user, admin, economy, community, governance, projects, marketplace, notifications, emergency, audit, onboarding)
- TypeScript: `npx tsc --noEmit` returns **0 errors** ✅ (`develop` branch — PR #3 merged 2026-02-23)
- ESLint: `npm run lint` passes clean ✅ (`develop` branch — ESLint config rewritten 2026-02-23, 133 files formatted)
- BullMQ scheduling: 4 active jobs registered — user-cleanup (4h), auth-cleanup (03:00), monthly-pr-regen (1st of month), daily-commitment-penalties (02:00)
- `BASE_URL`, `SMTP_*`, `ENCRYPTION_KEY`, `ALLOWED_ORIGINS` ⚠️ not in docker-compose.yml web env — magic links and emails broken without them
- M-Pesa: not started
- On-chain PR/UT (Base Sepolia): not started
- Frontend (Next.js): not started

**Infrastructure completed (2026-02-21/22):**
- Prisma schemas aligned: **80 models** (77 original + ImpactPointLog + UserLocationImpact + Ward back-relation), 12 per-module schemas merged via `mergeSchema.ts`, validates cleanly
- Old Jan 2026 migrations cleared — fresh migration runs on first `make dev`
- Docker config fixed: `REDIS_HOST`/`REDIS_PORT` env vars added to web + worker, `traefik/` directory created with `traefik.yml` + `acme.json`, worker startup script filename corrected (`workers.ts`)
- `queue/index.ts` fixed: duplicate `deadLetterQueue` export removed, dead example Worker code removed
- `registerAllListeners()` now called in `app.ts` `initializeServices()` — event bus is live on startup

---

## 4. Tech Stack

### Backend (active)
- Node.js 20+ / TypeScript strict mode
- Express — `backend/src/app.ts` (REST API, middleware chain)
- Prisma — each module owns its schema at `backend/src/modules/[name]/prisma/schema.prisma`
- BullMQ + Redis — queues registered in `backend/src/core/jobs/register.ts`
- Bull Board — queue monitoring dashboard at `/admin/queues` (HTTP basic auth: login=`admin`, password=`DASHBOARD_PASSWORD` env var, default `admin123` in dev). Shows economy, user-cleanup, dead-letter queues.
- Event bus — `backend/src/core/utils/eventBus.ts` (e.g. `eventBus.publish("user.email.verified")`)
- Structured logging — `backend/src/core/logger/logger.ts` with `operationType`
- Error handling — `ApiError` class (`backend/src/core/errors/ApiError.ts`)
- RBAC — `backend/src/core/rbac/` (roles, authorize middleware, integration)
- Testing — Vitest + Supertest (`backend/vitest.config.ts`) — 11 auth tests passing; `fileParallelism: false` required (shared test DB)

### Infrastructure (active)
- Docker Compose: `docker/docker-compose.yml` — services: `traefik`, `web`, `worker`, `postgres`, `postgres_test`, `redis`
- Makefile: `backend/Makefile` — commands: `make dev`, `make logs`, `make db-migrate`, `make db-shell`, `make down`, `make clean`
- Entry points: `backend/src/index.ts` (web), `backend/src/workers.ts` (worker), `backend/src/worker-events.ts`
- Graceful shutdown in `backend/src/index.ts`: SIGTERM/SIGINT → close server → disconnect Prisma/Redis
- Observability (disabled by default): Prometheus, Grafana, Loki, Jaeger

### Frontend (planned)
- Next.js 14+ App Router, TypeScript, Tailwind CSS, shadcn/ui
- TanStack Query, Wagmi + RainbowKit, Zustand

### Blockchain (planned)
- Base L2 (Sepolia testnet → Mainnet)
- PR: soulbound ERC-20, UT: standard ERC-20
- Embedded wallets via Privy or Dynamic
- Gas sponsorship via Pimlico paymaster
- Local dev: Anvil fork of Base Sepolia

---

## 5. Code Conventions

**Always follow these. Never deviate without flagging it.**

- TypeScript strict mode everywhere
- Prisma for all DB access — no raw SQL
- BullMQ for all async/scheduled work — no node-cron, no setInterval for recurring jobs (exception: ephemeral in-memory cleanup that does not need to survive restarts, per ADR-006 amendment)
- Event bus for cross-module decoupling — emit, don't import
- `ApiError` for all error responses — no raw `res.status(500).json(...)`
- Naming: camelCase, descriptive, no abbreviations
- Middleware order in `backend/src/app.ts`:
  `trust proxy → helmet/CORS → body parsing → context/logging → rate limiting → routes → cleanup → 404 → error handler`
- Async service init in `backend/src/app.ts` via `servicesReady` promise before accepting traffic
- All new queues must register in `backend/src/core/jobs/register.ts`
- All new events must be typed in the event bus types file

---

## 6. Module Readiness Checklist

A module is **production-ready** when ALL of these are true:
- [ ] Route file exists with correct Express router
- [ ] Service file contains business logic (no logic in route handlers)
- [ ] Prisma schema has all required models and relations
- [ ] Migration exists and runs cleanly with `make db-migrate`
- [ ] Unit tests pass for the service layer
- [ ] Integration test covers the happy path and at least one error case
- [ ] If async: job is registered in `backend/src/core/jobs/register.ts`, queue is named in constants
- [ ] If cross-module: events are emitted (not direct imports)
- [ ] Docker: service restarts cleanly after `make down && make dev`
- [ ] No hardcoded values — all config via environment variables

---

## 7. Common Issues & Solutions

| Problem | Solution |
|---|---|
| Can't connect to DB or Redis | Use service names (`postgres`, `redis`) not `localhost` |
| Jobs not processing | Check worker logs: `make logs-worker`. Check queue registered in `backend/src/core/jobs/register.ts` |
| BullMQ can't connect to Redis | BullMQ uses `REDIS_HOST`/`REDIS_PORT` env vars (not `REDIS_URL`). Both must be set in `docker/docker-compose.yml` for web and worker. |
| N+1 queries | Use Prisma `include` with batching, or TanStack Query `select` |
| Auth token failure | Check `detectBruteForce` in `backend/src/modules/auth/services/auth.service.ts`, verify token expiry logic |
| Prisma schema changes not reflecting | `prisma/schema.prisma` is generated — do not edit directly. Run `npm run db:merge` from `backend/` to regenerate from per-module schemas. |
| `ENCRYPTION_KEY` env crash on startup | Must be exactly 64 hex characters. Generate with: `openssl rand -hex 32` |
| Container crash on start | Check `depends_on` with `condition: service_healthy`, add startup delay |
| Blockchain local dev | Use Anvil fork of Base Sepolia at `http://127.0.0.1:8545` |
| M-Pesa testing | Use sandbox credentials + mock webhook handler |
| Wallet UX friction | Embedded wallets + gasless first tx via Pimlico |
| `docker compose restart` doesn't pick up env var changes | Use `docker compose up --force-recreate` instead — restart reuses the existing container |
| tsx watch silently pauses after `process.exit(1)` | Touch any watched file (e.g. `touch backend/src/app.ts`) to trigger a restart |
| "JWT_SECRET invalid" at startup | JWT_SECRET must be ≥64 chars. Short default in docker-compose triggers Zod validation failure — use a 64-char hex fallback |
| Server exits ~15s after startup ("Shutdown timeout") | Force-exit timeout was set at module level, not inside `gracefulShutdown()` — it fired unconditionally. Move it inside the shutdown handler. |
| `@prisma/client` missing enum error in a service | Service references an enum not defined in any module schema. Fix the service to use actual schema-aligned enums, not invented names. |
| `redischeck.sh: Permission denied` in worker container | Run `chmod +x docker/*.sh` on host before `make dev`. Docker copies the file permission bits — if the script isn't executable on host, it won't be in the container. |
| Test files fail with unique constraint violation when run together | `fileParallelism: false` is required in `vitest.config.ts` when test files share UUID seed constants and a single postgres_test DB. Parallel file execution causes concurrent `CREATE` conflicts. |
| `signMagicLinkToken` token fails immediately in tests ("jwt not active") | `signMagicLinkToken` adds a 30-second `notBefore` anti-replay delay. In tests use `signJwtToken(payload, '15m', 0)` directly — the third argument `0` means valid immediately. |
| `verifyEmailToken` test throws "Record to update not found" for UNVERIFIED user | `completeEmailVerificationAndCreateSession` calls `tx.onboardingProgress.update()` on first-time login. Test must create an `OnboardingProgress` row for the user before calling `verifyEmailToken`. |
| TypeScript errors in scaffold services that reference unmapped Prisma models | Add `// @ts-nocheck` at the top of the service file and a note like `scaffold: <ModelName> alignment in progress`. Do not attempt full schema fixes on scaffold modules — defer until that module is actively being built. |
| Magic links produce `undefined/auth/verify-email?...` in emails | `BASE_URL` env var is not set. Add `BASE_URL=http://localhost:4000` to the web service environment in `docker/docker-compose.yml`. |
| Emails not sending at all (magic links, verification) | SMTP credentials not configured. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` to web service environment in `docker/docker-compose.yml`. Startup logs show "Email service NOT configured" warning when missing. |
| `/admin/queues` Bull Board returns 401 with correct password | Username is always `admin`. Password is `DASHBOARD_PASSWORD` env var (default `admin123` in dev docker-compose). Change before any shared or production deployment. |
| CI fails: `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | Prisma v7 `prisma.config.ts` calls `env('DATABASE_URL')` at config-load time, even during `prisma generate`. Add `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ci_db` to the job-level `env:` block in `.github/workflows/ci.yml`. |
| ESLint error: `Cannot find module '@eslint/js/dist/configs/typescript.js'` | That subpath does not exist in `@eslint/js`. Rewrite `eslint.config.js` to import `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, and `globals` directly — do not rely on `@eslint/js` TypeScript re-exports. |
| JWT `jti` claim does not match session ID | `signJwtToken` generates a new random hex `jti` regardless of the payload's `jti` field. The actual session ID travels in the JWT `sessionId` field (not `jti`). Token revocation checks must use `sessionId`, not `jti`. |

---

## 8. Version History

| Version | Change |
|---|---|
| v1.0 | Initial creation |
| v1.1 | Added non-negotiable rules and Ujamaa context |
| v1.2 | Added progress snapshot and tech stack |
| v1.3 | Incorporated real file references from codebase |
| v1.4 | Added Docker section and Makefile commands |
| v2.0 | Full rewrite — tighter, directive format, added module checklist |
| v2.1 | Fixed all file paths (backend/ prefix), replaced outdated progress snapshot with module status table |
| v2.2 | Added infrastructure completion notes, added BullMQ/schema/env common issues |
| v2.3 | Updated cross-cutting gaps: `/health` verified ✅, worker permission issue, unmounted routes. Added 6 new common issues from first `make dev` session. |
| v2.4 | All 12 routes mounted ✅, `/ready` ✅, 2 auth tests green. Updated cross-cutting gaps. JWT jti fix documented. |
| v2.5 | TypeScript CI: 134 → 0 errors ✅. Reputation schema added (80 models). Auth tests: 2 → 11. 4 new common issues. `fileParallelism: false` note added. |
| v2.6 | SMS wired (AT SDK). Auth-cleanup BullMQ job. Dead scheduling code deleted. ESLint fixed. PR #3 + PR #4 merged to develop. Bull Board added to tech stack. 7 new common issues. Scheduling convention tightened (BullMQ-only). |

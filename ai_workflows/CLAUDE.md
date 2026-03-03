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

## 3. Current Progress (Updated: 2026-03-02 session 22)

> **How to read this table:**
> - `scaffold` = directory + schema only, no working logic
> - `partial` = controllers/services/routes written, core logic exists, no tests, not verified end-to-end
> - `tested` = all service + route tests green, schema aligned; not yet production-deployed or fully signed off
> - `production-ready` = passes full checklist in section 6
>
> **Update this table at the end of every session that changes code.**

| Module | Status | Notes |
|---|---|---|
| auth | tested | 10+ handlers, 10+ services, routes, validators, prisma schema. SMS wired (AT SDK). Auth-cleanup BullMQ job. **104 green tests** across 11 files (service units + 34 HTTP route integration tests). Schema fully aligned (2FA + security_events migration applied). |
| user | tested | 7 handlers, services, routes, validators, prisma schema, cleanup job. **35 green tests** (1 helper file + 34 route integration tests). 5 service bugs fixed: proofUrl nullable, vouch P2002 race, timeout semantic, redundant middleware, dead code. Migration `20260223214449_make_proof_url_nullable` applied. |
| economy | tested | PR service (award/spend/balance/hasSufficient), dues history, commitments. **34 green tests** (2 files: 18 service unit + 16 route integration). Bug fixed: duesOptInSchema added (validator/handler mismatch on POST /commitments/dues). Audit wired: PR_AWARDED, PR_SPENT, DUES_PAID, COMMITMENT_CREATED. |
| community | tested | Group management: controllers, services, routes, member event listeners. **49 green tests** (4 files: 13 service unit + 16 membership service unit + 20 route integration). Event listener registration fixed: `registerCommunityListeners()` now active — users auto-enroll in system groups on email verification. GET endpoints added: `GET /community/my-groups` + `GET /community/:groupId/members?limit&offset` + `GET /community/:groupId` (single group detail with user membership). |
| governance | tested | Proposal controllers, services, routes, prisma schema. All 6 endpoints: `GET /governance`, `GET /governance/:proposalId`, `POST /create`, `POST /start-voting`, `POST /vote`, `POST /:proposalId/tally`. **47 green tests** (25 service unit + 22 route integration across 2 files). |
| projects | partial | Project lifecycle: controllers, services, routes, prisma schema |
| marketplace | partial | Listing controllers, services, routes, prisma schema. Discovery-only per Rule 1. |
| notifications | partial | Controllers, services, routes, prisma schema. Type-loss bug fixed: `toPrismaType()` maps DUES_* → ECONOMIC, PROPOSAL_* → PROPOSAL. Only emergency module sends notifications — no scheduled jobs, no preference routes yet. |
| onboarding | partial | Controllers, listeners, routes, services, seed data |
| emergency | partial | Controllers, services, routes, prisma schema |
| audit | partial | Controllers, services, routes, types. **6 audit events now active**: USER_CREATED, EMAIL_VERIFIED (auth), PR_AWARDED, PR_SPENT, DUES_PAID, COMMITMENT_CREATED (economy). `GET /api/v1/audit/search` returns real records. Remaining gaps: profile, group, governance actions. |
| admin | partial | Handlers, services, routes, validators, RBAC integration |
| reputation | scaffold | Impact point + location impact services only — no routes or controllers |
| education | scaffold | Prisma schema only |
| treasury | scaffold | Prisma schema only |
| integration | partial | Full Baraza integration module: Telegram/WhatsApp/Discord bot services, BullMQ reward jobs, baraza-bot.service.ts, bot.controller.ts, bot.routes.ts, integration-events.listener.ts. BarazaGroup + BarazaAttendance + UserMessagingProfile schema. GET /baraza-groups wired to frontend. |
| verification | scaffold | Empty directory |

**Cross-cutting gaps (apply to all modules):**
- Tests: auth **104 green** (11 files), user **35 green** (2 files), economy **34 green** (3 files), community **49 green** (4 files), governance **47 green** (2 files). All other modules: zero tests. Total: **269 green tests**.
- `make dev` → `/health` ✅ verified 2026-02-22 — server responds `{"success":true,"status":"ok"}`
- `make dev` → `/ready` ✅ verified 2026-02-22 — Prisma connected, migration applied
- Worker container: `redischeck.sh` needs `chmod +x docker/*.sh` on host after fresh clone
- All 12 module routes mounted in `app.ts` ✅ (auth, user, admin, economy, community, governance, projects, marketplace, notifications, emergency, audit, onboarding)
- TypeScript: `npx tsc --noEmit` returns **0 errors** ✅ (`develop` branch — PR #3 merged 2026-02-23)
- ESLint: `npm run lint` passes clean ✅ (`develop` branch — ESLint config rewritten 2026-02-23, 133 files formatted)
- BullMQ scheduling: 4 active jobs registered — user-cleanup (4h), auth-cleanup (03:00), monthly-pr-regen (1st of month), daily-commitment-penalties (02:00)
- `BASE_URL`, `SMTP_*`, `ENCRYPTION_KEY`, `ALLOWED_ORIGINS` ✅ now in `docker/docker-compose.yml` web env. `ENCRYPTION_KEY` defaults to 64 zero chars (`000...000`) — functional but insecure. Replace with `openssl rand -hex 32` before enabling TOTP/2FA or any encrypted fields.
- M-Pesa: not started
- On-chain PR/UT (Base Sepolia): **contracts written** — `PrToken.sol` (soulbound) + `UtToken.sol` (standard) compiled, 13 Foundry tests green, backend `getPrContract()` wired with null-guard; Base Sepolia deploy pending (minter wallet not yet funded)
- MailHog (dev email catcher): ✅ auto-started by `make dev` (defined in `docker/docker-compose.yml`). Web UI at `http://localhost:8025`. SMTP host is `mailhog:1025` (container name) — no auth required.
- Frontend (Next.js): **partial** — landing page, about page, 4-step registration form, magic-link sign-in modal, auth callback, dashboard (PR balance via TanStack Query), profile edit, app shell (sidebar/topbar/mobile nav). Build green (15 routes). Auth email links fixed and E2E flow verified 2026-02-26. **Privy wallet integration complete** (`wallet-context.tsx` + `wallet-button.tsx`, App ID wired, webpack stubs in `next.config.mjs` for unused Privy deps). **Chai palette fully applied to all pages.** **Sidebar: collapsible** (272px ↔ 72px animated, icons-only mode, `ChevronLeft`/`ChevronRight` toggle, `PanelLeft` topbar expand button). **Logout button** in sidebar footer (`LogOut` icon, calls `useAuth.logout()`). Collapse state owned by `AppShell`, passed to `Sidebar` + `Topbar` as props. **Upgraded to Next.js 16.1.6 + Turbopack dev** (`next dev --turbopack`). **Group detail page functional** — `GroupDetail` + `GroupMembers` components rewritten to use real `GroupDetailDto`/`GroupMemberDto` shapes; join/leave mutations for voluntary groups. **Topbar** shows "Get Started" + "Sign In" for unauthenticated users; authenticated users see PR/IP/UT token chips (`TokenChip`, desktop `hidden md:flex`). **SystemGroupsCard** rows link to `/groups/[groupId]`. **Dashboard, Groups, Proposals pages fully wired** — no hardcoded stats; all counts from real API calls. **User profile** shows PR, IP, and UT in a 3-col chip grid. **Mobile token bar** on dashboard (`md:hidden`) below welcome greeting. `utBalance` mapped in `auth-context.tsx` + added to `User` type in `types.ts`.

**Infrastructure completed (2026-02-21/22):**
- Prisma schemas aligned: **80 models** (77 original + ImpactPointLog + UserLocationImpact + Ward back-relation), 12 per-module schemas merged via `mergeSchema.ts`, validates cleanly
- Old Jan 2026 migrations cleared — fresh migration runs on first `make dev`
- Docker config fixed: `REDIS_HOST`/`REDIS_PORT` env vars added to web + worker, `traefik/` directory created with `traefik.yml` + `acme.json`, worker startup script filename corrected (`workers.ts`). **Traefik is fully commented out in `docker/docker-compose.yml` — it does not run at all in dev.** Direct port mappings are used instead. See ADR-023 to re-enable for production.
- **Dev port map**: API `:4000`, frontend `:3000`, Postgres `:5432`, Postgres test `:5433`, Redis `:6380` (host; container listens on 6379 — host port 6380 avoids conflict with any local Redis), MailHog SMTP `:1025`, MailHog UI `:8025`, Anvil (local EVM) `:8545`.
- `queue/index.ts` fixed: duplicate `deadLetterQueue` export removed, dead example Worker code removed
- `registerAllListeners()` now called in `app.ts` `initializeServices()` — event bus is live on startup

---

## 4. Tech Stack

### Backend (active)
- Node.js 22 / TypeScript strict mode
- Express — `backend/src/app.ts` (REST API, middleware chain)
- Prisma — each module owns its schema at `backend/src/modules/[name]/prisma/schema.prisma`
- BullMQ + Redis — queues registered in `backend/src/core/jobs/register.ts`
- Bull Board — queue monitoring dashboard at `/admin/queues` (HTTP basic auth: login=`admin`, password=`DASHBOARD_PASSWORD` env var, default `admin123` in dev). Shows economy, user-cleanup, dead-letter queues.
- Event bus — `backend/src/core/utils/eventBus.ts` (e.g. `eventBus.publish("user.email.verified")`)
- Structured logging — `backend/src/core/logger/logger.ts` with `operationType`
- Error handling — `ApiError` class (`backend/src/core/errors/ApiError.ts`)
- RBAC — `backend/src/core/rbac/` (roles, authorize middleware, integration)
- Testing — Vitest + Supertest (`backend/vitest.config.ts`) — **222 tests green** (104 auth across 11 files + 35 user across 2 files + 34 economy across 3 files + 49 community across 4 files); `fileParallelism: false` required (shared test DB); `resolve.alias` for `@core/*` and `@modules/*` required in vitest config

### Infrastructure (active)
- Docker Compose: `docker/docker-compose.yml` — active services: `web`, `worker`, `postgres`, `postgres_test`, `redis`, `frontend`, `mailhog`. (`traefik` service is commented out — see ADR-023.)
- Makefile: `backend/Makefile` — commands: `make dev`, `make logs`, `make db-migrate`, `make db-shell`, `make down`, `make clean`
- Entry points: `backend/src/index.ts` (web), `backend/src/workers.ts` (worker), `backend/src/worker-events.ts`
- Graceful shutdown in `backend/src/index.ts`: SIGTERM/SIGINT → close server → shutdown rateLimiter → shutdown tokenBlacklistService → close BullMQ redisConnection → disconnect Prisma
- Observability (disabled by default): Prometheus, Grafana, Loki, Jaeger

### Frontend (Phase 1 — auth/user APIs wired)
- Next.js 15 + React 18 + TypeScript + Tailwind CSS + shadcn/ui (installed)
- `frontend/lib/api.ts` — real HTTP client with JWT injection + auto-refresh (`authApi`, `userApi`, `economyApi`, `integrationApi`, `notificationsApi`, `communityApi`, `governanceApi` + legacy `ApiClient` for backward compat)
- `frontend/contexts/auth-context.tsx` — magic link flow (`requestMagicLink`, `verifyMagicLink`, `verifyEmailToken`, auto-hydrate from localStorage)
- `frontend/app/auth/callback/page.tsx` — detects token type and routes: JWT (2 dots) → `verifyMagicLink` (`GET /auth/login`); hex → `verifyEmailToken` (`GET /auth/verify-email`)
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`
- TanStack Query, Zustand. (Wagmi removed — replaced by Privy; see ADR-009.)

### Blockchain (contracts written — deploy pending)
- Base L2 (Sepolia testnet → Mainnet) — ADR-008
- `contracts/src/PrToken.sol` — soulbound ERC-20, non-transferable, role-gated mint/burn, `ParticipationRightsAwarded` event ✅
- `contracts/src/UtToken.sol` — standard ERC-20, role-gated mint/burn ✅
- `contracts/test/` — 13 Foundry tests green (`forge test -vv`) ✅
- `contracts/script/Deploy.s.sol` — reads `MINTER_WALLET_ADDRESS`, deploys both; run with `--rpc-url base_sepolia` when wallet is funded
- `contracts/lib/openzeppelin-contracts` — OZ v5 submodule; remapping in `foundry.toml`
- Toolchain: Foundry (`forge`/`cast`/`anvil`) installed at `/home/mzizi/.foundry/bin/` — ADR-018
- `contracts/` at repo root — ADR-019
- Embedded wallets: **Privy** (ADR-009) — `@privy-io/react-auth` v3.14.1 installed and active in `frontend/contexts/wallet-context.tsx`
- Backend minter wallet: `MINTER_PRIVATE_KEY` env var on **worker only** (not web) — ADR-020
- `backend/src/core/blockchain/client.ts` — `getPrContract()` / `getUtContract()` with null-guard
- `participationRights.service.ts` — on-chain mint wired, triple-guarded (NODE_ENV, walletAddress, getPrContract)
- Gas sponsorship via Pimlico paymaster (not yet wired)
- Local dev: `ujamaa_anvil` Docker service on port 8545; `BASE_RPC_URL=http://anvil:8545` on worker ✅
- **Next:** fund minter wallet → `forge script Deploy.s.sol --rpc-url base_sepolia --broadcast` → set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS`

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
- Auth token field name: both `GET /auth/verify-email` and `GET /auth/login` return `sessionToken` (not `accessToken`). Frontend must read `sessionToken`. No refresh token is issued — 7-day lifetime per ADR-022.
- `AUTH_CLEANUP_JOB` runs on the `user-cleanup` worker queue (not a dedicated auth queue). New low-volume auth housekeeping jobs belong in `user-cleanup` — do not create a third queue.
- Request body limit: **10 MB** for all endpoints (`express.json` + `express.urlencoded` in `app.ts`). Payloads larger than this are rejected with 413.
- Security events: use `logSecurityEvent(message, type, severity, detail, context)` from `backend/src/core/logger/logger.ts` for all security-relevant events (auth failures, brute force, suspicious activity). Do not call `logger.error` directly for security events. Severity values: `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'`.
- **Event bus registry** — current published events: `user.created` (emitted on new user registration; economy + community listen; audit logs USER_CREATED), `user.email.verified` (emitted on email verification; economy awards PR, community enrolls groups; audit logs EMAIL_VERIFIED), `auth.login` (emitted on every successful login; audit listens), `economy.commitment.breached` (emitted when commitment breach threshold reached; no listeners yet). Add all new events here and type them in the event bus types file.
- **Sensitive integration secrets belong on the `worker` service only, never `web`.** `MINTER_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` are set in the `worker:` env block of `docker/docker-compose.yml`. The web service must never have these values. Verify each new secret is on the correct service before committing.

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
| "JWT_SECRET invalid" at startup | JWT_SECRET must be **≥32 chars** in production. The hardcoded dev default (`6e603cfa...`) is explicitly blocked in production — use any different ≥32-char secret. The docker-compose dev default is 64 chars, which satisfies this minimum. |
| Server exits ~15s after startup ("Shutdown timeout") | Force-exit timeout was set at module level, not inside `gracefulShutdown()` — it fired unconditionally. Move it inside the shutdown handler. |
| `@prisma/client` missing enum error in a service | Service references an enum not defined in any module schema. Fix the service to use actual schema-aligned enums, not invented names. |
| `redischeck.sh: Permission denied` in worker container | Run `chmod +x docker/*.sh` on host before `make dev`. Docker copies the file permission bits — if the script isn't executable on host, it won't be in the container. |
| Test files fail with unique constraint violation when run together | `fileParallelism: false` is required in `vitest.config.ts` when test files share UUID seed constants and a single postgres_test DB. Parallel file execution causes concurrent `CREATE` conflicts. |
| `signMagicLinkToken` token fails immediately in tests ("jwt not active") | `signMagicLinkToken` adds a 30-second `notBefore` anti-replay delay. In tests use `signJwtToken(payload, '15m', 0)` directly — the third argument `0` means valid immediately. |
| `verifyEmailToken` test throws "Record to update not found" for UNVERIFIED user | `completeEmailVerificationAndCreateSession` calls `tx.onboardingProgress.update()` on first-time login. Test must create an `OnboardingProgress` row for the user before calling `verifyEmailToken`. |
| TypeScript errors in scaffold services that reference unmapped Prisma models | Add `// @ts-nocheck` at the top of the service file and a note like `scaffold: <ModelName> alignment in progress`. Do not attempt full schema fixes on scaffold modules — defer until that module is actively being built. |
| Magic links produce `undefined/auth/verify-email?...` in emails | `BASE_URL` env var is not set. Add `BASE_URL=http://localhost:4000` to the web service environment in `docker/docker-compose.yml`. |
| Emails not sending at all (magic links, verification) | SMTP credentials not configured. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` to web service environment in `docker/docker-compose.yml`. Startup logs show "Email service NOT configured" warning when missing. |
| `/admin/queues` Bull Board returns 401 with correct password | Username is always `admin`. Password is `DASHBOARD_PASSWORD` env var (default **`admin123`** in dev per `docker-compose.yml`). Change before any shared or production deployment. Auth uses `timingSafeEqual` via SHA-256 hash. |
| CI fails: `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | Prisma v7 `prisma.config.ts` calls `env('DATABASE_URL')` at config-load time, even during `prisma generate`. Add `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ci_db` to the job-level `env:` block in `.github/workflows/ci.yml`. |
| ESLint error: `Cannot find module '@eslint/js/dist/configs/typescript.js'` | That subpath does not exist in `@eslint/js`. Rewrite `eslint.config.js` to import `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, and `globals` directly — do not rely on `@eslint/js` TypeScript re-exports. |
| JWT `jti` claim does not match session ID | `signJwtToken` generates a new random hex `jti` regardless of the payload's `jti` field. The actual session ID travels in the JWT `sessionId` field (not `jti`). Token revocation checks must use `sessionId`, not `jti`. |
| Prisma migration SQL files not committed (silently gitignored) | `backend/.gitignore` has a `*.sql` rule. Add `!prisma/migrations/**/*.sql` directly after it to exempt migration files. Without this, migration files are invisible to git and teammates can't reproduce the schema history. |
| `sendJobFailureAlert` fires but no alert is actually sent | `failedJobHandler` (which calls `sendJobFailureAlert`) is defined in `workers.ts` but **never registered on any worker `failed` event** — it is unreachable dead code. Job failures reach the dead-letter queue and appear in logs, but `sendJobFailureAlert` is never called at all. Fix: `worker.on('failed', failedJobHandler)`, then wire Slack webhook or email before production. |
| Access token is valid for 7 days — 401 auto-refresh rarely fires | `auth.service.ts:448` issues 7-day access tokens (intentional for magic-link UX — see ADR-022). The `frontend/lib/api.ts` 401-refresh path exists as a safety net but will rarely trigger. Revocation requires explicit `DELETE /auth/sessions/:id`. |
| `ENCRYPTION_KEY` defaults to 64 zero chars, not a crash | `docker/docker-compose.yml` sets a default of 64 zero chars (`000...000`). TOTP and encrypted fields will work but with an insecure all-zero key — there is no startup crash. Always replace with a real value (`openssl rand -hex 32`) before enabling 2FA or any feature that calls the encryption utility. |
| `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter` | Express `req.query` is a getter-only property on `IncomingMessage`. Assigning `(req.query as any) = data` throws at runtime. Use `Object.defineProperty(req, 'query', { value: data, writable: true, configurable: true })` instead. |
| Rate limiter blocks tests (`strictRateLimit` 5 req/15min exceeded) | Add a `NODE_ENV === 'test'` guard at the top of `buildRateLimiter` that returns a no-op middleware. Rate limiters share in-memory (or Redis) state across test cases hitting the same endpoint in the same run. |
| `generateRandomHex(n)` throws "Must generate at least 8 bytes" | The crypto utility enforces a minimum of 8 bytes. Never pass a value less than 8. If you need fewer output characters, generate 8 bytes and slice: `generateRandomHex(8).slice(0, desiredLength)`. |
| Audit call after `return prisma.$transaction(...)` is unreachable dead code | If a service method returns the transaction result directly (`return prisma.$transaction(...)`), any code after the closing `});` is unreachable. To add a post-transaction audit call, refactor to `const result = await prisma.$transaction(...); await auditService.log(...); return result;`. Rename inner transaction variables to avoid shadowing (e.g. `record` instead of `payment`). |
| Audit records should not be created inside transaction blocks | Place `auditService.log()` calls **after** the `await prisma.$transaction(...)` call, never inside the transaction callback. If the transaction rolls back (exception), the audit call never fires — no orphaned records. If the audit call itself fails after a successful transaction, the audit trail has a gap but the operation is not reversed. This is the correct trade-off for current scale. |
| Kenyan phone numbers with `07`/`01` prefix rejected by backend E.164 validator | Normalise on submit before sending: `.trim().replace(/\s+/g, '').replace(/^0/, '+254')`. Backend regex is `/^\+254[17]\d{8}$/` (strict E.164). Users naturally type `0712 345 678` — strip spaces and swap leading zero for `+254`. Update input placeholder to match natural format (`0712 345 678`). |
| Registration form shows opaque "Validation failed" with no field details | `apiFetch` only reads `body?.message`; backend validation details are in `body.details.validation.errors` (a `Record<string, string>`). Add `errors?: Record<string, string>` to `ApiError` class and extract in `apiFetch`: `const errors = body?.details?.validation?.errors`. In form catch blocks check `err instanceof ApiError && err.errors` and render a `<ul>` of per-field messages. |
| `enrollInSystemGroups` throws unique constraint when `primaryWardId === secondaryWardId` | `enrollInSystemGroups` fans out to `Promise.all` concurrently. When the same ward is used for both primary and secondary, two concurrent `findFirst → null → create` calls both try to insert the same `@unique Group.name` → Prisma unique constraint violation. In tests, always use two distinct ward IDs (`TEST_WARD_ID` + `TEST_WARD_ID_B`). In production, prevent users from setting the same ward for both fields. |
| Frontend dev server: `Module not found: Can't resolve '@privy-io/react-auth'` | The Docker container's `node_modules` is an anonymous volume created at first build — it predates any packages added to `package.json` after that point. Fix: `docker exec ujamaa_frontend npm install --no-fund --no-audit` then `docker restart ujamaa_frontend`. The package will persist in the volume. |
| `webpack resolve.alias` for a package doesn't apply to ESM files inside `node_modules` | Next.js + webpack 5 ESM module handling does not reliably apply `resolve.alias` entries when the importer is an `.mjs` file inside `node_modules`. Use `webpack.NormalModuleReplacementPlugin(/TargetFileName/, path.resolve(__dirname, 'stubs/empty.js'))` instead — it matches on the resolved resource path and works in both `next build` and `next dev`. |
| Privy transitive dep causes `Module not found` at build time | `@privy-io/react-auth` pulls in `@base-org/account` (Coinbase smart wallets), `unstorage` (WalletConnect KV), `x402/client` (Privy payments), and `DelegatedActionsConsentScreen` (imports missing lucide icon). Add webpack `resolve.alias` stubs for the first three and a `NormalModuleReplacementPlugin` for the last one — all point at `frontend/stubs/empty.js`. See `frontend/next.config.mjs` for the exact config. |
| `.next` directory is owned by `root` and blocks local `npm run build` | If Next.js was previously built inside the Docker container, the `.next` dir on the host is owned by root (container runs as root). Clean it with: `docker exec ujamaa_frontend rm -rf /app/.next`. Never use `sudo rm` — use the container exec. |
| Routes integration test returns 400 for a valid request | The endpoint queries the DB and the required row doesn't exist (user, ward, industry, etc.). Routes tests need a `beforeEach` that seeds the DB — the global `testSetup.ts` truncates all 81 tables before each test, so `beforeAll` seeding is wiped before the first test runs. Always seed in `beforeEach` for routes tests. |
| Refresh token issues new tokens for a revoked session | `refresh-token.service.ts` must check `prisma.session.findUnique({ select: { revoked: true } })` after decoding the refresh JWT and before issuing new tokens. Without this check, a revoked session can keep refreshing indefinitely. |
| Error response body has `success: undefined` | `BaseError.toJSON()` and `errorHandler.ts` `responseBody` must include `success: false` explicitly. Tests checking `res.body.success === false` will fail silently if `success` is omitted from the serialized error object. |
| `seedLocation()` throws unique constraint error on re-runs | `prisma.county/constituency/ward.create()` fails if the test DB still holds rows from a previous run (e.g. the TRUNCATE didn't fire yet). Use `upsert()` with `where: { id }` and `update: {}` for all fixed-UUID seed helpers — this makes them idempotent regardless of DB state. |
| `prisma.industry.create` throws `Unknown argument 'active'` | The `Industry` model has NO `active` field. Only `GoodsService` has `active: Boolean`. Omit `active` from any `Industry` create/upsert call. |
| `updateProfile()` and `selectIndustries()` responses don't contain profile data | Both handlers return `{ success: true }` — they do not echo back the updated entity. Tests must verify side effects by querying the DB directly: `prisma.user.findUnique(...)` / `prisma.userIndustry.findMany(...)`. |
| Validation errors return 400, not 422 | `validateRequest.ts` calls `ApiError.badRequest()` which sets HTTP status 400. Route tests checking for validation rejection must `expect(res.status).toBe(400)`, not 422. |
| `getVerificationStatus()` returns `'PENDING'` when no request exists | When no `VerificationRequest` row exists for the user, the handler returns `{ status: 'PENDING', vouchesReceived: 0, vouchesNeeded: 3 }`. Do not assert `'NOT_STARTED'` — that status does not exist in the implementation. |
| Prisma `upsert` where clause must reference a `@unique` field | `seedSystemGroups()` used `where: { systemType: 'NATIONAL' }` but `systemType` is not unique on `Group`. Prisma throws `Argument 'where' needs at least one of '...'`. Always use a `@unique` or `@@unique` field (e.g. `name`) in `upsert` where clauses. |
| Seed `create` block spreads non-schema fields | `seedRoles()` spread `{ name, namespace, description, builtin }` into Prisma `create` — `namespace` and `builtin` do not exist on the `Role` model, causing `Unknown argument` errors. Always destructure only schema-mapped fields in seed `create` blocks. |
| `proofUrl` on `ResidenceChangeRequest` was non-nullable | `ResidenceChangeRequest.proofUrl` was `String` in schema, but `requestResidenceChange()` correctly accepts `proofUrl` as optional. TypeScript error `Type 'string | null' is not assignable to type 'string'` signals a schema mismatch — apply `String?` migration before setting `null`. |
| Email links go to backend (`:4000`) instead of frontend — clicking does nothing | `auth.service.ts` used `BASE_URL` (backend URL) to build both magic-link and verify-email links. The backend returns 404 for `/auth/login` and `/auth/verify-email` (no `/api/v1` prefix). Fix: use `FRONTEND_URL` (`:3000`) + `/auth/callback?token=...` for both. |
| Frontend `/auth/callback` fails for new-user verification tokens | The callback page previously only called `verifyMagicLink()` (JWT flow). New-user tokens are hex strings that need `GET /auth/verify-email`. Detect token type by dot-count: 2 dots = JWT magic link → `verifyMagicLink()`; no dots = hex verification token → `verifyEmailToken()`. |
| MailHog starts but port bindings are missing | The container may have been created before the port config was added. Fix: `docker compose stop mailhog && docker compose rm -f mailhog && docker compose up -d mailhog` from the `docker/` directory to force recreation with correct port bindings (`1025:1025`, `8025:8025`). |
| Magic link emails sent but nothing arrives in MailHog | MailHog is auto-started by `make dev`. If emails are still missing, check `SMTP_HOST` is `mailhog` (not `172.19.0.1`) in `docker/docker-compose.yml`, and confirm the `mailhog` container is running: `docker ps | grep mailhog`. Check UI at `http://localhost:8025`. |
| Existing-user magic link login silently fails (user not authenticated after clicking link) | `frontend/lib/api.ts verifyMagicLink` was destructuring `{ accessToken }` but the backend returns `{ sessionToken }` in `MagicLinkAuthResult`. `accessToken` would be `undefined`, storing the string `"undefined"` in localStorage and sending `Authorization: Bearer undefined` on all requests. Fix: destructure `sessionToken` from `verifyMagicLink` response; `auth-context.tsx verifyMagicLink` must call `tokenStore.set(sessionToken)`. |
| `forge install --no-commit` fails — unexpected argument | Newer versions of Foundry removed `--no-commit` (the flag for the opposite behaviour is now `--commit`). `forge install` commits the submodule by default. Just run `forge install OpenZeppelin/openzeppelin-contracts` without any flag. The submodule commit will be staged automatically. |
| `_beforeTokenTransfer` hook missing in OZ v5 — soulbound ERC-20 reverts unexpectedly | OZ v5 removed the `_beforeTokenTransfer` hook entirely. The correct soulbound pattern in OZ v5 is to override the four public transfer functions directly: `transfer()`, `transferFrom()`, `approve()`, `allowance()`. Call `revert("PR: non-transferable")` in the first three and `return 0` in the last. Internal `_mint`/`_burn` bypass these overrides so mint and burn still work. |
| Backend ABI `require()` fails in ESM module with "require is not defined" | `backend/src/core/blockchain/client.ts` is an ESM file (the backend uses `"type": "module"` in package.json). Use `createRequire` from Node's `module` package: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`. Then `require('./path/to/artifact.json')` works normally. |
| `integrationQueue` not visible in Bull Board `/admin/queues` | Add `integrationQueue` to both the import block and the `createBullBoard` queues array in `backend/src/app.ts`. Bug was introduced in session 21 when the queue was created but not registered on the dashboard. |
| `DASHBOARD_PASSWORD` code fallback is `'YourVeryStrongPassword123!'` but `docker-compose.yml` default is `admin123` | These are two different values for two different situations. In Docker the env var is always set (`admin123`), so the code fallback never fires. The code fallback only runs if the env var is unset entirely (e.g. bare-metal dev). Change both before any shared deployment. |
| `NEXT_PUBLIC_PRIVY_APP_ID` not in `docker/docker-compose.yml` frontend env | The value lives in `frontend/.env.local` (gitignored). A fresh clone will start the frontend container without a Privy App ID — wallet connect silently fails. Document the required env vars or add a placeholder in docker-compose. |
| WhatsApp integration has no `WHATSAPP_BOT_TOKEN` env var | Intentional — WhatsApp uses an inbound webhook pattern, not a bot-token model. Only `TELEGRAM_BOT_TOKEN` and `DISCORD_BOT_TOKEN` are needed. Do not add a WhatsApp bot token. See ADR-024. |
| PWA not installable despite `next-pwa` being in `package.json` | `next-pwa ^5.6.0` is installed but never wired. `withPWA` is not called in `next.config.mjs`, `public/manifest.json` does not exist, no app icons in `public/`, and `layout.tsx` has no `manifest`/`themeColor`/`appleWebApp` metadata. To make it installable: add icons, create `manifest.json`, wrap config with `withPWA({ dest: 'public' })`, add metadata to `layout.tsx`. Defer until core features are stable. |
| Concurrent registrations cause unique constraint violation on `Group.name` in `enrollInSystemGroups` | `enrollInSystemGroups` runs inside `prisma.$transaction` but uses `Promise.all` to concurrently create system groups. When two different users register at the same time, both transactions can read `null` for the same system group name (e.g. "Kenya National Community") and both attempt `tx.group.create()` → PostgreSQL unique constraint violation on `Group.name`. Fix: replace `findFirst + create/update` with a single `upsert` on the `@unique` field: `tx.group.upsert({ where: { name: groupName }, create: { ... }, update: { lastActivity: new Date() } })`. The `INSERT ... ON CONFLICT DO UPDATE` is atomic and serialises concurrent attempts correctly. This pattern applies to any "find-or-create" operation on a `@unique` field inside a concurrent `Promise.all`. |
| `turbopack.resolveAlias` in `next.config.mjs` throws 500 with `Can't resolve './app/stubs/empty.js'` | Turbopack's `resolveAlias` does **not** accept absolute `path.resolve()` strings. Use relative paths from the project root: `'./stubs/empty.js'`. The webpack `resolve.alias` config (used by `next build`) must retain absolute paths — the two configs coexist in the same `next.config.mjs`. |
| Docker node_modules volume is stale after bumping Next.js major version in `package.json` | Updating `package.json` on the host does not update the Docker anonymous volume where `node_modules` lives. Running `docker compose run --rm frontend npm install` creates a *new* throw-away container with its own volume — it does not update the named volume used by the running container. Fix: `docker compose rm -sf frontend` → `docker volume prune -f` (removes anonymous volumes) → `docker compose up --build -d frontend`. This rebuilds the image (runs `npm ci`) and mounts a fresh volume. |

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
| v2.7 | Auth module: 104 tests green (11 files). Auth status upgraded partial → tested. `tested` tier added to status legend. 5 service bugs fixed (phone-verification, refresh-token, logout, BaseError, errorHandler). 8 new common issues (gitignore SQL, req.query setter, rate limiter, generateRandomHex, routes seeding, refresh revocation, success field). vitest alias note added. PR #6 merged. |
| v2.8 | User module: 35 tests green (35 route integration tests). User status upgraded partial → tested. 5 service bugs fixed (proofUrl null, vouch P2002 race, timeout semantic, redundant middleware x5, dead code). Schema migration `20260223214449_make_proof_url_nullable`. Dev seed repaired (systemType uniqueness, Role schema fields). Auth helpers upsert-refactored. 8 new common issues added (upsert idempotency, Industry.active, response shapes, 400 vs 422, PENDING status, unique where clause, non-schema fields, proofUrl nullable). Total tests: 139 green. |
| v2.9 | ADR-009 closed (Privy chosen). ADR-018/019/020 added (Foundry, contracts/ at root, minter wallet). `contracts/` scaffold created (foundry.toml, README with architecture). Frontend Phase 1: api.ts real HTTP client, auth-context magic link flow, connect-wallet.tsx email dialog, auth/callback page, .env.local. Dashboard wired to real user data. Economy module: 34 new tests green (18 service unit + 16 route integration). Bug fixed: duesOptInSchema added. ParticipationRightsService class exported. Total: 173 green tests. |
| v3.0 | Audit pass (2026-02-24): removed stale Bull Board timing-safe issue (fixed in app.ts:287), updated env-var gap note (BASE_URL/SMTP_*/ENCRYPTION_KEY/ALLOWED_ORIGINS now in docker-compose), added `frontend` service to infrastructure list, added 3 new common issues (sendJobFailureAlert stub, 7-day token, ENCRYPTION_KEY empty default). ADR-021 (auth→user direct import exception) and ADR-022 (7-day token) added to DECISIONS.md. |
| v3.1 | Audit pass (2026-02-26): START_HERE.md rewritten (was severely stale). SESSION_STATE.md created (always-current live snapshot). Orient hat added to AGENTS.md. CLAUDE.md: MailHog startup note added to section 3, auth-context entry updated (verifyEmailToken added), two new section 5 conventions (sessionToken field name, auth-cleanup queue), DASHBOARD_PASSWORD default corrected (was `admin123`, actually `YourVeryStrongPassword123!`), 3 new section 7 issues. Code bug fixed: `verifyMagicLink` in api.ts + auth-context.tsx now correctly reads `sessionToken` instead of `accessToken`. |
| v3.2 | Privy wallet integration complete (2026-02-26): `wallet-context.tsx` wired to real `PrivyProvider`, `wallet-button.tsx` added, App ID in `.env.local`. Auth flows connected to landing page (`SignInModal`, `onSignIn` prop). Register page Chai palette. Webpack stubs for 4 Privy transitive deps in `next.config.mjs`. Frontend build 15/15 green. Docker npm install pattern documented. 4 new section 7 issues added. |
| v3.3 | Audit pass (2026-02-28): 8 contradictions corrected — JWT_SECRET minimum (32 not 64 chars), DASHBOARD_PASSWORD default (`admin123` not `YourVeryStrongPassword123!`), ENCRYPTION_KEY default (64 zeros not empty string), Traefik state (fully commented out, not "runs but ports not bound"), `failedJobHandler` scope (dead code, never registered on any event), ADR-009 Privy login method, ADR-010 build order, Wagmi stale note removed. Added: dev port map (Redis=6380), graceful shutdown full order, body limit + `logSecurityEvent` + event bus registry conventions. |
| v3.4 | Session 18 (2026-03-02): Roles system hardened — `roles.ts` rewritten, 5 new system roles + 2 group roles, `RoleHierarchy`, `roleIncludes()`, type guards, `AssignmentMethod`, `ElectionThresholds`. Raw string role literals replaced in admin/audit routes + password-reset service. Notification type-loss bug fixed (`toPrismaType()` in notification.service.ts). Audit wired: 6 events active (USER_CREATED, EMAIL_VERIFIED, PR_AWARDED, PR_SPENT, DUES_PAID, COMMITMENT_CREATED). `AuditAction` enum extended. Economy services refactored to `const result = await $transaction()` pattern. 2 new §7 common issues (audit outside transactions, unreachable post-return code). |
| v3.5 | Session 19 (2026-03-02): Community module tests — 49 new tests (13 group.service + 16 groupMembership.service + 20 group.routes), community status partial → **tested**. Event listener registration gap fixed: `registerCommunityListeners()` now active in `listener-registry.ts`. `TEST_WARD_ID_B` + `seedSecondWard()` added to community test helpers to avoid `Promise.all` concurrent group create race. Total: **222 green tests**. 1 new §7 issue (enrollInSystemGroups same-ward race). |
| v3.6 | Session 20 (2026-03-02): Blockchain contracts written — `PrToken.sol` (soulbound ERC-20, OZ v5 override pattern) + `UtToken.sol` (standard ERC-20), 13 Foundry tests green. Deploy script ready. `backend/src/core/blockchain/client.ts` added with null-guard. `participationRights.service.ts` wired with triple-guarded on-chain mint. `ujamaa_anvil` Docker service added. Worker gets blockchain env vars (`BASE_RPC_URL`, `MINTER_PRIVATE_KEY` placeholder, `PR_TOKEN_ADDRESS`, `UT_TOKEN_ADDRESS`). Section 3 blockchain status updated. Dev port map updated (anvil :8545). 4 new §7 issues (forge --no-commit removed, OZ v5 soulbound pattern, ESM require). |
| v3.7 | Session 21 (2026-03-02): Baraza messaging integration — `BarazaGroup` + `BarazaAttendance` + `UserMessagingProfile` Prisma models, migration applied. Full `backend/src/modules/integration/` module (Telegram, Discord, WhatsApp services, BullMQ reward jobs, bot controller + routes, event listener). `integrationQueue` + `integrationWorker` wired. Frontend register-form step 5 "Stay Connected". `requestMagicLink` extended with `messagingPlatforms`. Integration module status scaffold → **partial**. |
| v3.8 | Session 22 (2026-03-02): Frontend wiring + GET endpoints — `integrationApi`, `notificationsApi`, `communityApi` (mutations + GET), `governanceApi` (mutations + GET) added to `frontend/lib/api.ts`. `NotificationsPopover` + `BarazaGroupsCard` components created. Topbar bell wired to real data. Dashboard sidebar updated. Backend community GET endpoints added (`GET /my-groups`, `GET /:groupId/members`). Backend governance GET endpoints added (`GET /`, `GET /:proposalId` with votesSummary). `ApiClient.getGroups()` + `getProposals()` now return real data. Community + Economy tests: 83/83 green. |
| v3.9 | Audit pass (2026-03-02): `integrationQueue` added to Bull Board ✅; integration route added to docs endpoint; ADR-024 (Baraza platform decisions) written; §5 worker-only secrets convention added; 4 new §7 issues (Bull Board gap, DASHBOARD_PASSWORD double-default, Privy App ID not in docker-compose, WhatsApp webhook pattern). |
| v4.0 | Session 23 (2026-03-03): 3 registration flow bugs fixed (baraza handle `.trim()`, phone `.replace(/\s+/g,'')`, auth-context messagingPlatforms type). `ApiError.errors` field added + `apiFetch` extracts `body.details.validation.errors` — field-level validation errors now surface in the UI as a `<ul>` list. Kenyan phone normalisation: `07`/`01` → `+254` on submit; placeholder updated. 2 new §7 issues. |
| v4.1 | Session 24 (2026-03-03): Turbopack enabled (`next dev --turbopack`) — dev route compile 2-5s → 100-500ms; `turbopack.resolveAlias` stubs added with relative paths. Next.js upgraded 15.3.3 → 16.1.6, ESLint 8 → 9. `GET /community/:groupId` endpoint added (getGroupById service + getGroupDetail controller + route). `GroupDetailDto` interface + `communityApi.getGroupDetail()` added to api.ts. `GroupDetail` + `GroupMembers` components rewritten to use real DTO fields; join/leave mutations for voluntary groups. `SystemGroupsCard` rows link to `/groups/[groupId]`. Topbar shows "Get Started"/"Sign In" for unauthenticated users. Community section 3 updated. 2 new §7 issues (turbopack alias paths, Docker node_modules stale volume). |
| v4.2 | Session 25 (2026-03-03): Enrollment race condition fixed — `findFirst → create` replaced with atomic `upsert` on `Group.name` in `ensureSystemGroupAndEnroll` + `ensureNationalGroupAndEnroll`. `utBalance` added to `User` type + mapped in `mapBackendUser()`. Topbar PR/IP/UT `TokenChip` strip (desktop only). Dashboard wired: real proposal count, real community count, real notification activity, mobile token bar. Groups page: fake delay + hardcoded stats → `useQuery(communityApi.getMyGroups)` with 4 computed counts. Proposals page: 4 hardcoded stats → 2 real counts. Profile: UT chip in 3-col grid. PWA non-installability noted in §3 and §7. One-time remediation: `backend/scripts/re-enroll-orphaned-users.ts` ran successfully — 7 real users now have 5–7 group memberships. 1 new §7 issue (concurrent registration upsert). |

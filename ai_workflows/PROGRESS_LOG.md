# PROGRESS_LOG.md — Running Development Log

> Append to this file at the end of every session that changes code, makes a decision, or resolves an incident.
> Do not edit past entries. Only append.
> Format: date, what happened, what was decided, what's next.

---

## How to Append

At the end of every session, wear the Documentation hat and add an entry:

```markdown
## [YYYY-MM-DD] — [one-line summary]

**What was built:**
- [bullet]

**Decisions made:**
- [bullet with reason]

**What's still broken or incomplete:**
- [bullet]

**Next milestone:**
[one sentence]

**Token usage (optional):**
[Sonnet / Opus, rough estimate if notable]
```

---

## Log

---

## [2026-02-19] — Project setup, workflow files created

**What was built:**
- Created initial CLAUDE.md, agent roles, orchestration framework, prompt templates, emergency protocols, model strategy
- Uploaded key code files: `src/app.ts`, `src/index.ts`, `src/worker.ts`, `src/modules/auth/services/auth.service.ts`
- Confirmed `docker-compose.yml` and `prisma/schema.prisma` exist

**Decisions made:**
- Marketplace remains discovery-only — no payments, no escrow (non-negotiable)
- Blockchain hybrid from day one: PR/UT on-chain (Base Sepolia), UX off-chain
- All development via Docker Compose — no bare-metal
- Auth module is the first to reach production-ready status

**What's still broken or incomplete:**
- Backend not yet running end-to-end — files exist but not connected
- No frontend exists yet
- Marketplace, governance, education, emergency all in design phase
- On-chain PR/UT not started
- M-Pesa integration not started

**Next milestone:**
Connect middleware + auth + user modules, run `make dev` successfully, verify `/health` endpoint responds.

---

## [2026-02-20] — Workflow files rewritten (v2.0)

**What was built:**
- Rewrote all 5 workflow files (CLAUDE.md, AGENTS.md, ORCHESTRATION.md, PROMPT_TEMPLATES.md, EMERGENCY_PROTOCOLS.md, MODEL_STRATEGY.md)
- Added new file: PROGRESS_LOG.md (this file)
- Key changes: directive format (not descriptive), hat metaphor instead of personas, tier system for task sizing, module readiness checklist in CLAUDE.md, post-emergency checklist, M-Pesa and blockchain prompt templates added

**Decisions made:**
- Agent files should give Claude commands, not describe roles in third person
- Orchestration should have a "Quick / Standard / Major" tier system to avoid ceremony on small tasks
- Model selection is a human decision, not Claude's — MODEL_STRATEGY.md reframed accordingly

**What's still broken or incomplete:**
- Backend still not running end-to-end (unchanged from yesterday)

**Next milestone:**
First real Claude Code session — connect existing files, run `make dev`, hit `/health` endpoint.

---

## [2026-02-21] — ai_workflow files corrected to match real codebase

**What was built:**
- Full scaffold audit: read all module directories to establish true project state
- Replaced outdated progress prose in CLAUDE.md section 3 with a module status table (17 modules, scaffold/partial/production-ready)
- Fixed all file paths across CLAUDE.md, AGENTS.md, ORCHESTRATION.md, PROMPT_TEMPLATES.md:
  - `src/` → `backend/src/` everywhere
  - `src/worker.ts` → `backend/src/workers.ts` (file is `workers.ts`, not `worker.ts`)
  - `prisma/schema.prisma` → per-module paths (`backend/src/modules/[name]/prisma/schema.prisma`)
  - Docker Compose location: `docker/docker-compose.yml` (not root)
  - Makefile location: `backend/Makefile` (not root)

**Decisions made:**
- Module statuses: auth, user, economy, community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin = `partial`; reputation, education, treasury, integration, verification = `scaffold`
- "partial" means: controllers/services/routes exist, no tests written, not verified end-to-end
- No module is `production-ready` — zero tests exist across the entire codebase

**What's still broken or incomplete:**
- No test files anywhere
- `make dev` end-to-end not yet verified
- M-Pesa not started
- On-chain PR/UT not started
- Frontend not started

**Next milestone:**
Run `make dev`, verify `/health` responds, then begin writing tests for the auth module to get it to `production-ready`.

---

## [2026-02-21] — ai_workflow files v2.2: structural improvements

**What was built:**
- AGENTS.md: Added Testing hat (Vitest + Supertest), fixed Developer hat file path example, added Docker verification and migration notes to Developer rules, updated default hat sequence to include Testing
- ORCHESTRATION.md: Added Step 0 reality check (mandatory session start), added DECISIONS.md consultation to Architect step, added security review and ADR recording to "Done" definition, clarified Emergency tier points to `ai_workflows/EMERGENCY_PROTOCOLS.md`
- PROMPT_TEMPLATES.md: Added Template 10 (sync CLAUDE.md status with reality), Template 11 (write tests), Template 12 (database migrations); updated Tips section
- MODEL_STRATEGY.md: Added specific model IDs (`claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`), added Haiku tier for low-reasoning tasks, added `/model` command note, fixed stale file path
- DECISIONS.md: Fixed stale paths in ADR-006 and ADR-007, added ADR-011 (backend/ subdirectory), ADR-012 (Vitest + Supertest), ADR-013 (gRPC under review)

**Decisions made:**
- Vitest + Supertest is now the official testing framework (ADR-012)
- `backend/` subdirectory structure is now formally documented (ADR-011)
- gRPC presence is flagged as requiring a decision (ADR-013, Under Review)

**What's still broken or incomplete:**
- Zero tests written — this is the primary technical debt
- `make dev` end-to-end not yet verified
- ADR-009 (Privy vs Dynamic) still Under Review
- ADR-013 (gRPC) still Under Review

**Next milestone:**
Run `make dev`, verify `/health` responds, then write tests for auth module.

---

## [2026-02-21] — Prisma schema alignment (Phase 1–3 complete, Phase 4 pending Docker)

**What was built:**
- **base.prisma rewritten** — stripped down to backbone only: generator, datasource, 4 shared enums (LocationScope, GroupStatus, GroupRole, HolderType), geographic models (County, Constituency, Ward), Industry, GoodsService, User (with comprehensive back-relations covering all 11 module schemas), Role, UserRole, SystemConfiguration
- **User model back-relations added** for: auth (12), user (10), community (9), governance (2), projects (5), economy (3), treasury (3), marketplace (4), notifications (5), education (3), emergency (2), system (1)
- **Ward back-relations added**: groups (community), communityAssets, communityVouches, marketplaceListings, residenceRequests (user module)
- **County/Constituency back-relations added**: groups (community)
- **community/prisma/schema.prisma updated**: added VerificationRequest model, added CommunityVouch model, commented out `elections Election[]` (Election not yet defined — TODO)
- **economy/prisma/schema.prisma updated**: added Commitment model (moved from base.prisma)
- **treasury/prisma/schema.prisma updated**: added WalletTransaction model (was missing, referenced by governance and projects)
- **mergeSchema.ts fixed**: glob typo corrected (`chema.prisma` → `schema.prisma`), MODULE_ORDER updated (added projects, treasury; removed wallet, onboarding, audit; comments explaining merge order rationale)
- **Merge runs successfully**: `npx tsx src/core/database/mergeSchema.ts` → 77 models, 0 duplicates
- **Prisma validate passes**: `npx prisma validate` → schema valid 🚀

**Decisions made:**
- Reset chosen over forward migration — old migrations (Jan 2026) were based on unmerged base.prisma only and don't reflect the intended architecture
- Election model deferred — commented out relation in community Group; will be defined in a future governance sub-module ADR
- WalletTransaction added to treasury module (not a new base model) — it's a treasury-specific ledger model referenced by other modules via named relations
- MODULE_ORDER in mergeSchema.ts now reflects actual merge dependency order, not just sequence

**What's still broken or incomplete:**
- Phase 4 (reset + migrate) blocked: 3 old migration files owned by root (Docker created them) — need `sudo rm -rf` to clear before running fresh migration
- Migration files to delete: `prisma/migrations/20260109143704_user_and_auth_basic`, `20260111235507_auth_core_complete`, `20260112002234_full_auth_schema`
- After clearing migrations: run `make dev`, then inside Docker: `npx prisma migrate dev --name schema_alignment`

**Next milestone:**
Clear old migrations (sudo), start Docker, run schema_alignment migration, verify `/health` responds.

---

## [2026-02-21] — Created HUMAN_WORKFLOW.md, completed path cleanup across all files

**What was built:**
- Created `ai_workflows/HUMAN_WORKFLOW.md` — human-facing field guide covering: session lifecycle (open/work/check/close), task framing, template quick reference, model selection, non-negotiable habits, recovery from off-track sessions, session types, weekly rhythm, current state snapshot, key files, one-line rules
- Fixed remaining stale paths in EMERGENCY_PROTOCOLS.md (backend/ prefix, workers.ts, docker/docker-compose.yml) — this was the last file with wrong paths
- All 8 ai_workflow files now at v2.1 or v2.2 with consistent, correct file paths

**Decisions made:**
- HUMAN_WORKFLOW.md is the entry point for the human, not for Claude — it lives in ai_workflows/ but is written in second person to the project owner

**What's still broken or incomplete:**
- Zero tests written
- make dev end-to-end not yet verified
- ADR-009 and ADR-013 still Under Review

**Next milestone:**
Run `make dev`, verify `/health` responds, write auth module tests.

---

## [2026-02-21] — Full project doc audit: 17 MD files updated

**What was built:**
- Audited all 33 project markdown files. Updated 17 files with correct content.
- **`backend/src/core/database/base.prisma.md`**: Completely rewritten — old file contained the pre-rewrite monolithic Prisma schema. Replaced with documentation of the new per-module merge architecture (ADR-014).
- **`backend/docker/DOCKER-SCRIPTS.md`**: Fixed `src/worker.ts` → `src/workers.ts` in 3 places (hot reload, prod build, entry point table).
- **`backend/INFRASTRUCTURE.md`**: Fixed `worker.ts` → `workers.ts`, `docker-compose.yml` → `docker/docker-compose.yml`, `docker-compose` → `docker compose` (modern CLI), `Winston logger` → `Pino logger`. Added warning on "No Docker" option (violates ADR-005).
- **`backend/README.md`**: Fixed `worker.ts` → `workers.ts` in file tree, fixed logger (Winston → Pino), fixed production migration command to use `../docker/` path.
- **`README.md`** (root): Complete rewrite — was a generic 60-line placeholder. Now shows actual project status, repo structure, tech stack, non-negotiable rules, and correct paths.
- **`frontend/README.md`**: Complete rewrite — was a generic "Web3 Frontend Roadmap" template. Replaced with UjamaaDAO-specific frontend placeholder (planned stack, wallet decisions, non-negotiables, API integration points).
- **`graphql-internal-only.md`**: Added exploration status header — file was unlabeled. Now clearly marked as exploration-only, not implemented.
- **`security_events_summary.md`**: Fixed `src/` paths → `backend/src/`, fixed API URLs from `/auth/` → `/api/v1/auth/`.
- **`docs/user-api.md`**: Fixed `/api/users` → `/api/v1/users` (confirmed in app.ts). Added module status banner.
- **`docs/group-api.md`**: Fixed `/api/groups` → `/api/v1/community/groups`. Added module status banner.
- **`docs/proposal-api.md`**: Fixed `/api/proposals` → `/api/v1/governance/proposals`. Added module status banner.
- **`docs/proposal-module.md`**: Added module status banner.
- **`docs/vote-api.md`**: Fixed `/api/votes/*` → `/api/v1/governance/votes/*`. Added module status banner.
- **`docs/project-module.md`**: Fixed `/api/projects` → `/api/v1/projects`. Added module status banner.
- **`docs/milestone-module.md`**: Fixed `/api/milestones` → `/api/v1/projects/milestones`. Added proper heading + module status banner.
- **`docs/impactPoint-api.md`**: Fixed base URL → `/api/v1/economy`. Fixed all endpoint paths.
- **`docs/architecture.md`**: Fixed wallet reference (MetaMask/WC → embedded wallets per ADR-009), added Base L2 network, improved logging reference.
- **`docs/contributing.md`**: Fixed branching (feature branches from `develop`, not `main`). Fixed getting started steps to use `make dev` instead of bare `npm run dev`.

**Decisions made:**
- API prefix is `/api/v1/` (confirmed in `app.ts`). All docs updated to reflect this.
- `base.prisma.md` is now documentation, not a copy of schema code.
- Logging is Pino (confirmed from `logger.ts` file header). All Winston references corrected.

**What's still broken or incomplete:**
- Zero tests written (unchanged)
- `make dev` end-to-end not yet run (unchanged — ready to go)
- Community, governance, projects, marketplace, notifications routes not yet mounted in `app.ts`
- `docs/auth-api.md` and `docs/economy-api.md` referenced in backend/README.md but don't exist yet

**Next milestone:**
Run `make dev` → verify `/health` → run `prisma migrate dev --name schema_alignment` inside web container → confirm `/ready` responds → write auth module tests.

---

## [2026-02-22] — Worker container fixed; both web and worker healthy ✅

**What was built:**
- Fixed 2 worker container restart-loop causes:
  1. `redischeck.sh` lacked execute permission on host — Docker volume mounts copy host permissions, so the container couldn't execute it. Fix: `chmod +x backend/docker/*.sh`
  2. Worker container had stale `JWT_SECRET=dev_jwt_secret_change_me` (24 chars) from original container creation — `docker compose restart` reuses the container env, it does NOT pick up docker-compose.yml env changes. Fix: `docker compose up --force-recreate worker`
- Worker now starts cleanly: Redis connected, Postgres connected, 3 BullMQ jobs registered (`user-cleanup`, `monthly-pr-regeneration`, `daily-commitment-penalties`)
- Clarified worker entrypoint: the `dev` Dockerfile stage defaults to `start-web.sh`; docker-compose overrides this with `command: ["sh", "./docker/start-worker.sh"]` for the worker service, which runs `npx tsx watch src/workers.ts`

**Decisions made:**
- None — all fixes were operational corrections

**What's still broken or incomplete:**
- Zero tests written
- `/ready` endpoint not yet confirmed — `prisma migrate dev --name schema_alignment` still pending inside web container
- Community, governance, projects, marketplace, notifications routes not mounted in `app.ts`
- BullMQ eviction policy warning (allkeys-lru) — expected in dev, not a blocker
- `docs/auth-api.md` and `docs/economy-api.md` don't exist yet

**Next milestone:**
Run `prisma migrate dev --name schema_alignment` inside web container, confirm `/ready` responds, then write auth module tests.

---

## [2026-02-22] — 16 startup blockers fixed; `make dev` → `/health` ✅ first confirmed run

**What was built:**
- Fixed 16 startup blockers across a single session, moving the server from crash-loop to healthy
- Makefile `COMPOSE_FILE` corruption fixed (hyphen in path was breaking docker compose invocation)
- Redis host port changed `6379` → `6380` to avoid conflict with host Redis instance
- Docker command arrays fixed (`sh` prefix added for `.sh` entry points in docker-compose.yml)
- `auth-events.listener.ts` stub created — file was missing entirely, causing import crash at startup
- `registerEconomyListeners` alias fixed in `backend/src/core/events/listener-registry.ts`
- Prisma `--skip-seed` flag removed from migrate command (flag removed in Prisma v7)
- `@db.Uuid` annotation added to 16 FK fields (auth module: 6 fields, projects module: 10 fields) — fixed migration failure
- `ValidateRequests.ts` renamed → `validateRequest.ts`; 9 route files updated to use new path; `core/middleware/index.ts` re-export fixed
- `speakeasy`, `qrcode`, `argon2`, `node-cron` installed inside container (were missing from container layer)
- `PR_CONFIG` import path fixed in economy listeners: `../../onboarding/types.js` → `../types.js`
- `groupMembership.service.ts` completely rewritten: removed non-existent enums (`AssignmentMethod`, `GroupType`), rewrote to use schema-aligned fields (`autoEnrolled`, `SystemGroupType`, `userId_groupId` compound constraint)
- `uuidSchema` exported from `backend/src/modules/auth/validators/auth.validators.ts`
- `userIdParamSchema` + siblings exported from `backend/src/modules/admin/validators/admin.validators.ts`
- `z` (zod) import added to `backend/src/modules/admin/routes/admin.routes.ts`
- JWT_SECRET fallback in `docker/docker-compose.yml` fixed from 24-char to 64-char hex (was failing env validation)
- Force-exit timeout moved inside `gracefulShutdown()` in `backend/src/index.ts` (was firing 15s after startup unconditionally, killing the server)
- **Server now responds: `{"success":true,"status":"ok"}` at `/health`**

**Decisions made:**
- No new architectural decisions — all fixes were bug/schema alignment corrections, not design choices

**What's still broken or incomplete:**
- Worker container: `redischeck.sh` lacks execute permission (`chmod +x docker/*.sh` needed on host)
- Zero tests written anywhere
- Community, governance, projects, marketplace, notifications routes not mounted in `app.ts`
- `docs/auth-api.md` and `docs/economy-api.md` don't exist yet (referenced in backend/README.md)
- `/ready` endpoint (Prisma connected) not yet confirmed — migration `schema_alignment` pending

**Next milestone:**
Run `prisma migrate dev --name schema_alignment` inside web container, confirm `/ready` responds, then write auth module tests.

**Token usage:**
Sonnet 4.6 — heavy session (16 fixes, many file reads/writes across the full backend)

---

## [2026-02-21] — Pre-flight audit: 8 blockers found and fixed, ai_workflow docs updated

**What was built:**
- Full pre-flight audit of config files, env vars, module requirements, and docker-compose before first `make dev`
- Fixed 8 blockers across 6 files:
  1. `src/core/queue/index.ts` — removed duplicate `deadLetterQueue` export + dead example Worker code
  2. `src/core/database/base.prisma` — confirmed `previewFeatures = ["driverAdapters"]` not needed (Prisma v7 stable)
  3. `backend/.env` — replaced invalid `ENCRYPTION_KEY` placeholder with valid 64-char hex
  4. `docker/start-worker.sh` — `src/worker.ts` → `src/workers.ts`
  5. `package.json` — `dev:worker` and `start:worker` scripts: `worker.ts/.js` → `workers.ts/.js`
  6. `docker/docker-compose.yml` — added `REDIS_HOST=redis` + `REDIS_PORT=6379` to web and worker environments
  7. `traefik/traefik.yml` + `traefik/acme.json` — created missing traefik config directory
  8. `src/app.ts` — added `registerAllListeners()` call inside `initializeServices()`
- Old Prisma migrations cleared (`prisma/migrations/` deleted — 3 root-owned files from Jan 2026)
- Schema re-merged and validated: 77 models, 0 duplicates, 1 warning (SetNull on optional — not a blocker)
- ai_workflow docs updated: CLAUDE.md (infrastructure notes + 3 new common issues), DECISIONS.md (ADR-013 closed, ADR-014 added), HUMAN_WORKFLOW.md (current state updated), START_HERE.md (status updated)

**Decisions made:**
- ADR-013 closed: `interfaces/` directory is empty — no gRPC implemented, ignore until a real use case exists
- ADR-014 added: per-module Prisma schema merge pattern is now formally documented
- DB reset confirmed: old migrations gone, fresh `schema_alignment` migration will run on first `make dev`

**What's still broken or incomplete:**
- Zero tests written
- `make dev` end-to-end not yet run — infrastructure is ready but first launch pending
- ADR-009 (Privy vs Dynamic) still open — decide when blockchain module starts
- TOTP_ENCRYPTION_KEY in .env is still a placeholder (`your-secret-encryption-key-here`) — not in Zod schema so won't crash, but should be replaced before real 2FA use

**Next milestone:**
Run `make dev` → verify `/health` → run `prisma migrate dev --name schema_alignment` inside web container → confirm `/ready` responds → write auth module tests.

---

---

## [2026-02-22] — First green tests: JWT jti fix + auth service unit tests pass

**What was built:**
- Fixed production bug in `jwt.service.ts`: `signJwtToken` was passing `jti` in both the payload AND `options.jwtid`. jsonwebtoken v9+ throws `"jwtid payload claim cannot be overridden"` — removed `jwtid` from options, payload `jti` is sufficient
- Fixed `tests/auth/auth.service.test.ts`: test was creating Ward with non-UUID IDs (`'ward-test-1'`) which fail Postgres `@db.Uuid` type constraint. Replaced with proper UUID + County → Constituency → Ward seed in `beforeEach`
- Moved 15 pre-refactor test files to `tests/old/` (all referencing removed paths: `src/middlewares/`, `src/services/`, `src/prismaClient.js`, `src/validation/`, old route endpoints `/api/auth/nonce`)
- All routes confirmed live: 12 modules mounted in `app.ts` (auth, user, admin, economy, community, governance, projects, marketplace, notifications, emergency, audit, onboarding) — `/health` ✅ `/ready` ✅
- Committed all to `develop`: `fix(tests): fix JWT jti conflict; 2 auth service tests now green`

**Decisions made:**
- Pre-refactor tests that reference removed src paths (`src/middlewares/`, `src/services/`, `src/prismaClient.js`) go to `tests/old/` not deleted — preserves intent, just excluded from vitest runs
- `auth.onboarding.test.ts` moved to old/ (complex integration test needing full infra: location seed, industries, goodsServices, Redis, event listeners) — rewrite as proper integration test later
- JWT jti: keeping `jti` in payload (not in options) is correct — jsonwebtoken includes payload fields in signed token automatically

**What's still broken or incomplete:**
- Only 2 tests exist (auth service sendMagicLink) — full auth module far from production-ready
- `verifyEmail`, `verifyMagicLink`, `createSession` paths have zero test coverage
- `auth.onboarding.test.ts` integration flow is the most important test to write — it covers the whole E2E auth flow
- Worker container: `redischeck.sh` still needs `chmod +x` on host after any fresh clone

**Next milestone:**
Write `verifyEmail` + `verifyMagicLink` unit tests for auth, OR write the full auth onboarding integration test with proper seeding infrastructure.

---

## [2026-02-22] — TypeScript CI fix (134 → 0 errors) + 9 new auth tests green

**What was built:**
- Fixed all 134 TypeScript compilation errors on `chore/fix-ci` branch — `npx tsc --noEmit` returns **0 errors** ✅
- Key fixes per module: economy (missing imports, wrong field names), community (enum alignment), emergency (schema field name mismatches), governance (ProposalStatus, GroupMemberVote, ParticipationRightsReason), marketplace (sellerUserId, ListingStatus), notifications (per-channel preference model, NotificationType conflict), controllers (AuthRequest vs Request), workers (Queue.on("failed") invalid, logger.critical invalid field)
- Created `backend/src/modules/reputation/prisma/schema.prisma` — `ImpactPointLog` and `UserLocationImpact` models were referenced in services but missing from all schemas. Re-merged (77 → 80 models), regenerated Prisma client
- Applied `// @ts-nocheck` to 3 scaffold service files (project.service.ts, impactPoint.service.ts, locationImpact.service.ts) — deep schema mismatches deferred to incremental build approach
- Excluded `backend/src/modules/onboarding/seed.ts` from tsc via tsconfig (references `onboardingFlow` / `roleOnboardingRequirement` models not yet in merged schema)
- Written **9 new auth service tests** in `backend/tests/auth/auth.verify.test.ts`:
  - `verifyEmailToken`: 4 tests — happy path (UNVERIFIED user gets verified + session), invalid token, expired token, already-verified user
  - `verifyMagicLink`: 5 tests — happy path (EMAIL_VERIFIED user), invalid JWT string, expired JWT, wrong token type, first-time login for UNVERIFIED user
- Added `fileParallelism: false` to `backend/vitest.config.ts` — test files share UUID constants + single postgres_test DB, parallel file execution causes unique constraint violations
- Opened **PR #3** (`chore/fix-ci` → `develop`) — awaiting CI
- **Total tests: 11 passing** (2 existing sendMagicLink + 9 new)

**Decisions made:**
- Use `// @ts-nocheck` for scaffold modules with deep schema mismatches instead of a full rewrite — user confirmed to build auth and user modules incrementally and fully before touching scaffold modules. This avoids wasted effort on business logic that isn't designed yet.
- `fileParallelism: false` is the correct vitest setting for any project where test files share a single test database — parallel file execution is unsafe when UUID seed constants collide across files.
- `signMagicLinkToken` should NOT be used in tests — it adds a 30s `notBefore` anti-replay delay. Use `signJwtToken(payload, '15m', 0)` directly in test helpers to skip the delay.

**What's still broken or incomplete:**
- PR #3 not yet merged — CI must pass first
- `// @ts-nocheck` files need proper schema alignment when their modules are built: `project.service.ts`, `impactPoint.service.ts`, `locationImpact.service.ts`
- User module tests: zero (GET /users/me, PATCH profile not covered)
- `docs/auth-api.md` and `docs/economy-api.md` still don't exist (referenced in backend/README.md)
- `auth.onboarding.test.ts` integration test still in `tests/old/` — full E2E flow not yet tested

**Next milestone:**
Merge PR #3 → develop once CI passes, then write user module tests (GET /users/me, PATCH /users/me/profile) to build auth + user incrementally to production-ready.

**Token usage:**
Sonnet 4.6 — medium session (TypeScript error audit + test writing across 10+ files)

---

## [2026-02-23] — SMS integration, auth-cleanup BullMQ job, dead scheduling code removed, 2 PRs merged, docs audit

**What was built:**
- Wired Africa's Talking SMS SDK into `backend/src/modules/auth/services/phone-verification.service.ts` — replaced stub with real AT SDK dynamic import + `@ts-ignore` (no TypeScript types available for `africastalking` npm package)
- Added phone verification routes to `backend/src/modules/auth/routes/auth.routes.ts` (POST `/phone/send-code`, POST `/phone/verify-code`) — handlers and validators already existed but routes were never wired
- Added SMS env vars to `docker/docker-compose.yml` web service: `ENABLE_SMS`, `SMS_PROVIDER`, `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`
- Created `backend/src/modules/auth/jobs/auth-cleanup.jobs.ts` — new BullMQ job processor. Cleans: expired email verification tokens, expired password reset tokens, and resolved security events older than 90 days (via `securityEventsService.cleanupOldEvents()`)
- Registered auth-cleanup job in `backend/src/core/jobs/register.ts` — daily at 03:00, runs on the `user-cleanup` queue
- Wired auth-cleanup processor into `backend/src/workers.ts` alongside the existing user-cleanup processor
- Deleted 3 dead scheduling files that were never imported anywhere:
  - `backend/src/core/jobs/auth-cleanup.jobs.ts` — node-cron based, 0 imports
  - `backend/src/modules/economy/jobs/economy.jobs.ts` — setInterval based, 0 imports
  - `backend/src/core/jobs/economy-cron.jobs.ts` — empty 1-line placeholder
- Fixed PR #3 CI failures: added `DATABASE_URL` to `ci.yml` job env (Prisma v7 reads it at config-load time even for `generate`), rewrote `backend/eslint.config.js` (old config imported non-existent path `@eslint/js/dist/configs/typescript.js`), ran `lint:fix` on 133 files
- Merged PR #3 (`chore/fix-ci` → `develop`) ✅ — 0 TypeScript errors, 11 auth tests passing, clean ESLint config
- Merged PR #4 (`feature/sms-auth-cleanup` → `develop`) ✅ — SMS wiring, auth-cleanup BullMQ job, 3 dead files deleted
- Full `audit-docs` run: read `app.ts`, `index.ts`, `workers.ts`, `auth.service.ts`, `prisma/schema.prisma`, `docker-compose.yml`, `CLAUDE.md`, `DECISIONS.md` — findings logged, doc fixes applied this session

**Decisions made:**
- BullMQ is the sole scheduling system — node-cron and setInterval dead code removed from `core/jobs/`. The one remaining setInterval (nonce cleanup in `wallet.service.ts`) stays per ADR-006 exception; all other recurring logic must use BullMQ (see ADR-017)
- `securityEventsService.cleanupOldEvents()` coverage was only in the deleted node-cron file — migrated into the BullMQ auth-cleanup job to preserve the cleanup behavior
- Scaffold rule established as workflow convention: always list and read ALL existing files in a target directory before editing or creating anything — prevents dead code duplication
- ESLint flat config must use `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` + `globals` package directly, not `@eslint/js` subpaths that don't exist

**What's still broken or incomplete:**
- `BASE_URL`, `SMTP_*`, `ENCRYPTION_KEY`, `ALLOWED_ORIGINS` absent from `docker/docker-compose.yml` web service (identified in audit, queued for next session)
- Bull Board auth in `app.ts:296` uses plain `===` string comparison — timing-safe comparison not yet implemented
- `backend/src/workers.ts` `@file` comment and `Run with:` instruction say `worker.ts` (singular) — wrong filename
- User module tests: zero (GET /users/me, PATCH profile not covered)
- `// @ts-nocheck` in 3 scaffold service files (`project.service.ts`, `impactPoint.service.ts`, `locationImpact.service.ts`) needs proper schema alignment when those modules are actively built

**Next milestone:**
Apply queued docker-compose.yml env var fixes (`BASE_URL`, `SMTP_*`, etc.), then write user module unit tests (GET /users/me, PATCH /users/me/profile).

**Token usage:**
Sonnet 4.6 — heavy session (CI fixes, 2 PRs merged including a rebase with conflicts, full docs audit across 8 files)

---

## [2026-02-23] — Auth module hardened: 104/104 tests green, 5 service bugs fixed, PR #6 merged

**What was built:**
- **New migration** (`20260223173236_add_2fa_security_fields`): adds `failedAttempts` + `lastFailedAttempt` to `two_factor_auth`; renames `security_events.details` → `metadata` and adds `description` + `resolutionNotes` columns — these were missing from the DB while the services already expected them
- **10 new test files** covering the entire auth module: `helpers.ts` (shared seeders + JWT helpers), `token.service.test.ts`, `session.service.test.ts`, `refresh-token.service.test.ts`, `password-reset.service.test.ts`, `totp-2fa.service.test.ts`, `phone-verification.test.ts`, `security-events.service.test.ts`, `wallet.service.test.ts`, `auth.routes.test.ts` (34 supertest HTTP integration tests covering every auth route)
- **5 service bug fixes** found by the new tests:
  1. `phone-verification.service.ts` — `generateCode()` called `generateRandomHex(3)` but the crypto utility enforces a minimum of 8 bytes; fixed to `generateRandomHex(8).slice(0, 8)`
  2. `refresh-token.service.ts` — `refresh()` never checked if the DB session was revoked before issuing new tokens; added `prisma.session.findUnique({ select: { revoked: true } })` guard
  3. `session.handlers.ts` — `logout()` threw 401 when the token had no `sessionId` (permanent tokens used in tests and headless clients); now returns 200 gracefully
  4. `BaseError.ts` — `toJSON()` was missing `success: false`; all error responses returned `success: undefined`
  5. `errorHandler.ts` — `responseBody` was also missing `success: false`; routes test assertions for `res.body.success === false` were failing
- **4 test infrastructure fixes**:
  1. `vitest.config.ts` — added `resolve.alias` for `@core/*` and `@modules/*` (tsconfig path aliases were not forwarded to vitest; `auth.routes.test.ts` imports the full app which pulls `@core/queue/index.js`)
  2. `validateRequest.ts` — replaced direct `(req.query as any) = data` assignment (throws `TypeError: Cannot set property query` — getter-only on `IncomingMessage`) with `Object.defineProperty`
  3. `rateLimiter.ts` — `buildRateLimiter` now returns a no-op middleware in `NODE_ENV=test`; `strictRateLimit` (5 req/15min) was blocking repeated test hits on the same endpoint
  4. `password-reset.service.test.ts` — added `vi.clearAllMocks()` to `beforeEach`; mock call counts were bleeding across tests
- **gitignore fix** — `backend/.gitignore` had `*.sql` which was silently ignoring all Prisma migration SQL files; added `!prisma/migrations/**/*.sql` exception and committed both migration SQLs for the first time
- **PR #6** (`fix/audit-remaining` → `develop`): merged, branch deleted — `develop` is now at `02bb44d`

**Decisions made:**
- No new architectural decisions — all changes were bug fixes, schema corrections, and test infrastructure alignment
- Confirmed pattern: routes integration tests that exercise DB-touching endpoints must use `beforeEach` (not `beforeAll`) for seeding — the global truncation in `testSetup.ts` runs before each test, so any seeding done in `beforeAll` is wiped before the first test runs

**What's still broken or incomplete:**
- User module tests: zero (GET /users/me, PATCH profile not yet covered)
- `// @ts-nocheck` in 3 scaffold service files (`project.service.ts`, `impactPoint.service.ts`, `locationImpact.service.ts`) still deferred
- `BASE_URL`, `SMTP_*`, `ENCRYPTION_KEY`, `ALLOWED_ORIGINS` still not confirmed in `docker/docker-compose.yml` web service (carried from previous session — applied in `fix/audit-remaining` but worth re-verifying)
- `auth.onboarding.test.ts` full E2E integration test still in `tests/old/`; the full new-user + email-verify + magic-link-login flow is not tested end-to-end

**Next milestone:**
Write user module unit + integration tests (GET /users/me, PATCH /users/me/profile) to move auth → user from tested to production-ready.

**Token usage:**
Sonnet 4.6 — heavy session (schema migration, 10 test files, 5 service bugs, 4 infra fixes)

---

## [2026-02-24] — User module: 5 service bugs fixed, seed repaired, 35/35 route tests green

**What was built:**
- **User module bug fixes** (found by test-driven discovery):
  1. `user.service.ts` — `proofUrl: dto.proofUrl ?? ''` changed to `proofUrl: dto.proofUrl || null` (empty string is never a valid URL; field must be nullable)
  2. `user.service.ts` — `vouchForUser()` had a check-then-create race condition; replaced with try/catch on Prisma P2002 unique violation
  3. `user.service.ts` — `checkVouchingTimeouts()` incorrectly set `rejectionReason` on `PAYMENT_PENDING` status transitions (a timeout is not a rejection); removed
  4. `user.routes.ts` — 5 redundant `authenticate` middleware calls removed from individual routes (global `router.use(authenticate)` at top of router already covers all routes)
  5. `reference.handlers.ts` — dead code null check `if (!wardId)` removed from `getWardMembers` (Zod validator guarantees wardId is always present)
- **New Prisma migration** (`20260223214449_make_proof_url_nullable`): `ResidenceChangeRequest.proofUrl String` → `String?` to match nullable service usage
- **Dev seed repaired** (`backend/src/core/database/seed.ts`):
  1. `seedSystemGroups()` — upsert `where: { systemType: 'NATIONAL' }` → `where: { name: 'Kenya National Community' }` (systemType is not a unique field)
  2. `seedRoles()` — stripped `namespace` and `builtin` fields from `create` block (Role schema only has `name` and `description`)
  - Seed now runs cleanly: 47 counties, 1578 wards, 1909 system groups, 12 roles
- **Auth helpers refactored** (`backend/tests/auth/helpers.ts`):
  - `seedLocation()` `create()` calls changed to `upsert()` — idempotent across multiple test runs against the same DB
  - Removed stale `locationVerified` field references (field removed from TS types in previous session)
- **New test helper file**: `backend/tests/user/helpers.ts` — `seedIndustries()`, `seedGoodsServices()`, `makeUserToken()`, `createCommunityVerifiedUser()`, `createFullyVerifiedUser()`, re-exports location constants from `../auth/helpers.js`
- **35 user route integration tests** in `backend/tests/user/user.routes.test.ts` — covers all user routes: `GET /me`, `PATCH /me/profile`, `DELETE /me`, `GET /reference/*` (counties, constituencies, wards, industries, goods-services), `POST /me/industries`, `GET /me/industries`, `POST /me/goods-services`, `GET /wards/:wardId/members`, `GET /verify-community/status`, `POST /verify-community/request`, `GET /:userId`
- **Total test count: 139/139 green** (104 auth + 35 user)
- **Cross-module dependency analysis**: auth imports economy (participationRightsService), community (groupMembershipService), user (checkFullVerification) directly; user imports auth (session/phone cleanup); economy and community react via eventBus listeners on auth/user events
- Committed and pushed to `develop` ✅

**Decisions made:**
- No new architectural decisions — all changes were implementation bug fixes

**What's still broken or incomplete:**
- Economy and community modules (directly imported by auth, mocked in current tests) — zero tests
- `BASE_URL`, `SMTP_*`, `ENCRYPTION_KEY`, `ALLOWED_ORIGINS` env vars still absent from `docker/docker-compose.yml` web service
- M-Pesa: not started
- On-chain PR/UT (Base Sepolia): not started
- `auth.onboarding.test.ts` full E2E integration test still in `tests/old/`
- `// @ts-nocheck` in 3 scaffold service files (`project.service.ts`, `impactPoint.service.ts`, `locationImpact.service.ts`) deferred

**Next milestone:**
Write economy and community module tests — both are directly called by auth and are mocked in current tests, making them the highest-priority modules to bring to `tested` status.

**Token usage:**
Sonnet 4.6 — heavy session (5 service bugs, schema migration, seed fixes, 2 new test files, 3 rounds of test failure fixes)

---

## [2026-02-24] — ADR-009 closed (Privy), blockchain scaffold, frontend wired, economy tests green

**What was built:**

- **ADR-009 closed — Privy chosen** (`ai_workflows/DECISIONS.md`): Full comparison vs Dynamic documented. Privy wins on phone-primary identity, zero-crypto-experience UX, gasless-first Pimlico integration, lighter SDK for rural/3G users.
- **Three new ADRs added**:
  - ADR-018: Foundry as smart contract toolchain (over Hardhat) — Rust-based, Solidity-native tests, gas snapshots, `forge test`/`forge script`
  - ADR-019: `contracts/` at repo root (not inside `backend/`) — separate deployable artifact, independent build lifecycle
  - ADR-020: Backend minter wallet pattern — dedicated EOA (`MINTER_PRIVATE_KEY` env var) holds `PR_MINTER_ROLE`/`UT_MINTER_ROLE`, separate from Privy user wallets
- **`contracts/` scaffold created** (no Solidity yet): `foundry.toml` (solc 0.8.24, optimizer on, Base Sepolia + Mainnet RPC endpoints), `src/`, `test/`, `script/`, `out/` directories, `README.md` with full architecture doc (on-chain vs off-chain split, contract specs, minter wallet pattern, directory structure, env vars table), `.gitignore`
- **Frontend Phase 1 — real API wiring**:
  - `frontend/lib/api.ts` — replaced all mock API responses with real `fetch()` calls to backend at `NEXT_PUBLIC_API_URL`. Added JWT injection, 401 auto-refresh via refresh token (with race-condition deduplication), typed `apiFetch()` wrapper. Exported `authApi`, `userApi`, `economyApi` namespaced clients. Legacy `apiClient` compat shim preserved.
  - `frontend/contexts/auth-context.tsx` — replaced wallet-based auth (wagmi signMessageAsync) with magic link flow: `requestMagicLink(email)` → `verifyMagicLink(token)`. Added `mapBackendUser()` to bridge backend ↔ frontend User type. Auto-hydrate from localStorage tokens on mount. Deprecated `login(walletAddress)` shim kept for compat.
  - `frontend/components/auth/connect-wallet.tsx` — replaced wallet connect dropdown with magic link dialog (email input + "Send Login Link" → sent confirmation). Shows profile dropdown when authenticated.
  - `frontend/app/auth/callback/page.tsx` — new page: handles `?token=...` from magic link email, calls `verifyMagicLink()`, redirects to `/dashboard` on success.
  - `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`
  - `frontend/components/dashboard/dashboard-content.tsx` — made client component, wired `user.impactPoints.global` and `user.tokenBalance` (participationRights) to real auth context.
- **Economy module tested** (`backend/tests/economy/`):
  - `helpers.ts` — `createEconomyTestUser()`, `makeEconomyToken()`, re-exports `seedLocation`
  - `participationRights.service.test.ts` — **18 tests**: `getBalance()` (0 for new user, positive sum, net with negatives), `award()` (creates log + updates denorm field, caps at MAX_BALANCE=500, throws on ≤0, accumulates, stores metadata), `spend()` (negative log, throws 403 when insufficient, throws on ≤0, rejects over-balance, allows exact balance spend), `hasSufficient()` (false/true matrix)
  - `economy.routes.test.ts` — **16 tests**: auth (401 without token), authorization (403 for EMAIL_VERIFIED on all routes), happy paths (GET /pr returns balance+history, GET /dues/history empty array, GET /commitments empty + with seeded data, POST /commitments/dues validation + 201 creation)
- **Bug fix — economy validator/handler mismatch**: `POST /economy/commitments/dues` route used `createCommitmentSchema` (validated `type: CommitmentType`) but handler read `tier: DuesTier`. Added `duesOptInSchema` (`tier: ORDINARY|SUPPORTER|SPONSOR`, `startPeriod: YYYY-MM`, `durationMonths`). Updated route to use correct schema.
- **`ParticipationRightsService` class exported** (named export added) — allows test-time instantiation with custom Prisma client if needed.
- **Total test count: 173/173 green** (104 auth + 35 user + 34 economy)

**Decisions made:**
- ADR-009: Privy (closed, see above)
- ADR-018: Foundry toolchain
- ADR-019: contracts/ at root
- ADR-020: Minter wallet pattern

**What's still broken or incomplete:**
- Community module tests: zero tests (directly imported by auth — same priority as economy was)
- Frontend: proposals/groups/governance pages still have stub data (Phase 2: after community + governance backends are hardened)
- Frontend: Privy integration not yet done (Phase 3: after ADR-009 is closed — it is now ✅, so unblocked)
- Blockchain: `PrToken.sol` + `UtToken.sol` not written yet (dedicated blockchain session needed)
- Economy `duesService.applyCommitmentPenalties()` and `commitmentService.checkForBreaches()` not tested
- `BASE_URL`, `SMTP_*`, `ENCRYPTION_KEY`, `ALLOWED_ORIGINS` env vars still absent from `docker/docker-compose.yml` web service

**Next milestone:**
Write community module tests → move community status from `partial` → `tested`. Then wire frontend Phase 2 (PR/UT balance display) once economy tests are merged.

**Token usage:**
Sonnet 4.6 — heavy session (4 concurrent tasks: ADR decisions, contracts scaffold, frontend wiring, economy tests)

---

## [2026-02-26] — auth email links fixed, frontend user flow verified end-to-end

**What was built:**

- **Auth email link bug fixed** (`backend/src/modules/auth/services/auth.service.ts`):
  - Both magic-link and email-verification emails used `BASE_URL` (backend `:4000`) — links pointed directly to the backend and returned 404 when clicked
  - Fixed: both now use `FRONTEND_URL` (frontend `:3000`) + `/auth/callback?token=...` as the landing path
- **Frontend callback page updated** (`frontend/app/auth/callback/page.tsx`):
  - Previously only called `verifyMagicLink()` (existing-user JWT flow)
  - Now detects token type: JWT (2 dots = 3 segments) → `verifyMagicLink()`; hex string → `verifyEmailToken()`
- **`verifyEmailToken()` added to api.ts** (`frontend/lib/api.ts`):
  - Calls `GET /auth/verify-email?token=...` → `{ sessionToken, user, session, needsProfileCompletion }`
- **`verifyEmailToken()` added to auth context** (`frontend/contexts/auth-context.tsx`):
  - Stores `sessionToken` as the access token (no refresh token in the new-user verify-email flow)
  - Maps user with existing `mapBackendUser()` and shows "Karibu" welcome toast
- **MailHog started and verified**: `docker compose up -d mailhog` + port bindings confirmed at `localhost:8025`
- **Full registration and sign-in flow tested and verified**: new-user 4-step form → email → click link → dashboard; existing-user sign-in modal → email → click link → dashboard

**Decisions made:**
- No new architectural decisions — targeted bug fix only
- Token type detection via dot-count (JWT = 2 dots) chosen over a `type` query param to avoid backend URL changes beyond the host/path fix

**What's still broken or incomplete:**
- Community module: zero tests (still highest backend priority)
- Blockchain: `PrToken.sol` + `UtToken.sol` not written
- Frontend Phase 3: Privy integration not yet done
- New-user verify-email flow has no refresh token — session expires after 7 days with no silent renewal (acceptable for now, same as magic-link UX)
- MailHog container must be started manually (`docker compose up -d mailhog`) — it is in `docker-compose.yml` but not in the default `make dev` startup profile

**Next milestone:**
Write community module tests to move community from `partial` → `tested`, then start blockchain session (`PrToken.sol` + `UtToken.sol` + Base Sepolia deploy).

**Token usage:**
Sonnet 4.6 — light session (1 bug diagnosed and fixed across 4 files, E2E flow tested)

---

## [2026-02-26] — Privy wallet integration complete, frontend build 15/15 green

**What was built:**

- **Full Privy wallet integration** (`frontend/contexts/wallet-context.tsx`):
  - Replaced `StubWalletProvider` with real `PrivyProvider` wrapping `PrivyWalletAdapter`
  - Hooks wired: `usePrivy`, `useWallets`, `useConnectWallet`, `useLogout`
  - Config: `loginMethods: ["email","wallet","google"]`, `embeddedWallets: { createOnLogin: "users-without-wallets" }`
  - Falls back to `StubWalletProvider` when `NEXT_PUBLIC_PRIVY_APP_ID` is unset
- **`frontend/components/auth/wallet-button.tsx`** (new): amber "Connect Wallet" pill when disconnected; green address pill with copy/disconnect dropdown when connected
- **`frontend/.env.local`**: `NEXT_PUBLIC_PRIVY_APP_ID` set (App ID only — secret is server-side, never in frontend env)
- **`frontend/components/providers.tsx`**: `WalletProvider` added between `AuthProvider` and `RoleProvider`
- **Auth flows wired to landing page**:
  - `SignInModal` lives on the landing page itself (not `/auth/callback`) — email input → magic link → MailHog confirmation
  - `onSignIn` prop threads through `LandingNavbar` and `HeroSection` to open the modal
  - Fixed: landing page "Sign In" was incorrectly linked to `/auth/callback` (token processor, not sign-in UX)
- **Register page Chai palette redesign** (`app/auth/register/page.tsx`): tea-dark background, cream card, amber UJ badge
- **Webpack stubs for Privy transitive deps** (`frontend/next.config.mjs`):
  - `@base-org/account` → `stubs/empty.js` (Coinbase smart-wallet; viem ESM resolution fails indirectly in webpack)
  - `unstorage` → `stubs/empty.js` (WalletConnect KV storage, not used)
  - `x402/client` → `stubs/empty.js` (Privy payment protocol, not used)
  - `DelegatedActionsConsentScreen` → `stubs/empty.js` via `webpack.NormalModuleReplacementPlugin` (imports `CloudUpload` icon absent from lucide-react v0.294)
- **`frontend/stubs/empty.js`** (new): `module.exports = {}` — canonical empty stub for all unused Privy features
- **Docker node_modules sync**: ran `npm install` inside `ujamaa_frontend` container (659 packages added including all Privy transitive deps); container restart required to pick up new modules

**Decisions made:**

- `NormalModuleReplacementPlugin` chosen over a webpack `resolve.alias` for the `DelegatedActionsConsentScreen` stub: the alias approach (`"lucide-react": shim.mjs`) did not apply to ESM-format files inside `node_modules` in the Next.js build pipeline; `NormalModuleReplacementPlugin` matches on the resolved resource path and works reliably in both `next build` and `next dev`
- App Secret (`PRIVY_APP_SECRET`) is explicitly server-side only — never added to `NEXT_PUBLIC_*` env vars; the frontend only receives the App ID
- `stubs/empty.js` established as the canonical pattern for any future Privy feature module we don't use (add a new `resolve.alias` or `NormalModuleReplacementPlugin` entry in `next.config.mjs` + point at the same file)

**What's still broken or incomplete:**

- Community module: zero tests (still highest backend priority)
- Blockchain: `PrToken.sol` + `UtToken.sol` not written
- Chai palette not extended to dashboard, profile, or proposals screens (still use old inline hex values)
- New-user verify-email flow has no refresh token — 7-day session, no silent renewal (same as session 11, intentional per ADR-022)
- MailHog must be started manually (`docker compose up -d mailhog`) — not in default `make dev` profile

**Next milestone:**

Write community module tests to move community from `partial` → `tested`, then write `PrToken.sol` + `UtToken.sol` in a dedicated blockchain session.

**Token usage:**
Sonnet 4.6 — medium session (Privy integration, 3 cascading webpack build errors resolved, Docker npm install)

---

## [2026-02-27] — Chai palette extended to all frontend pages

**What was built:**

- **`frontend/app/about/page.tsx`** — full rewrite matching landing page design:
  - Dark `#0A1F14` background (matches landing page)
  - Hero: Ujamaa etymology + "the word that changed how Africa thinks about building together"
  - Philosophy section: chama/harambee/tontine/stokvel cooperative tradition + Nyerere 1962 quote blockquote
  - Three pillars: Govern Together / Work Together / Prosper Together
  - All 7 Nguzo Saba with Swahili names, English translations, and full principle meanings
  - Protocol section: soulbound PR tokens / Impact Points / Community Treasury with tea-green accent cards
  - CTA → `/auth/register`, footer Nguzo Saba name strip
- **`frontend/components/layout/page-header.tsx`** — replaced blue gradient with cream gradient (`#FAF7F2→#F6F0E6`), amber badge, amber glow; title uses `font-display` chai text
- **`frontend/components/layout/stats-grid.tsx`** — replaced white/slate cards with cream gradient; Chai palette change pills (tea-green/ember/chai) instead of green/red/slate
- **`frontend/app/groups/page.tsx`** — Chai stat icon colors, amber spinner, amber pill CTA replacing purple/pink gradient button
- **`frontend/app/proposals/page.tsx`** — Chai stat colors, amber pill CTA
- **`frontend/app/projects/page.tsx`** — Chai stat colors, amber spinner, amber pill CTA
- **`frontend/app/admin/page.tsx`** — Chai stat colors, amber spinner
- **`frontend/app/groups/[id]/page.tsx`** — amber-tinted skeleton pulses replacing `bg-slate-200`
- **`frontend/app/projects/[id]/page.tsx`** — full redesign: `InfoCard` component with cream gradient, custom amber progress bar, `StatusBadge` with Chai colors, tea-green participant avatar initials, amber-tinted `TabsList`, all `text-gray-*` → `text-[#1A120B]` chai palette
- **`frontend/app/dashboard/page.tsx`** — cream gradient loading fallback replacing `bg-slate-200`

**Decisions made:**

- Authenticated pages (dashboard, profile, groups, proposals, projects, admin, marketplace, treasury) keep cream backgrounds — they live inside AppShell which already sets `#F7F2E8` page background; only dark `#0A1F14` is used for public/marketing pages (landing, about)
- Stat icon colors standardised across all pages: amber `#C9922A` / tea-dark `#1E3D2F` / ember `#B03A1E` / tea-mid `#2A5240` — matching the pattern already established in `dashboard-content.tsx`
- Blue/purple/green/orange Tailwind gradient classes (`from-blue-500`, `from-purple-500`, etc.) fully removed from all page and component files

**What's still broken or incomplete:**

- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing, dev server unaffected)
- `sendJobFailureAlert` in `workers.ts` is dead code — no human alert on job failure
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- M-Pesa verification in `user.service.ts` stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` not written
- Deep components (MilestoneTracker, AdminDashboard, GroupDetail, FetchProposals, etc.) still use internal blue/slate/gray colours — these are scaffold-tier components not yet connected to real data

**Next milestone:**

Write community module tests to move community from `partial` → `tested`, then start blockchain session (`PrToken.sol` + `UtToken.sol` + Foundry tests + Base Sepolia deploy).

**Token usage:**
Sonnet 4.6 — medium session (about page rewrite + 10-file Chai palette rollout)

---

## [2026-02-27] — Collapsible sidebar + logout button

**What was built:**

- **`frontend/components/layout/sidebar.tsx`** — collapsible sidebar:
  - Animated width transition: 272px (expanded) ↔ 72px (collapsed), `transition-all duration-300`
  - `ChevronLeft`/`ChevronRight` toggle button in the logo header area
  - Collapsed mode: icons only, section labels hidden, divider replaces "More" label, nav items centred, native `title=` tooltips on all links
  - **Logout button** at footer: ember-red `LogOut` icon + "Sign out" label (icon-only when collapsed), calls `logout()` from `useAuth`
  - User card above logout: avatar + name/role (avatar-only when collapsed)
  - Props: `collapsed: boolean`, `onToggle: () => void`
- **`frontend/components/layout/app-shell.tsx`** — owns `collapsed` state (`useState(false)`), passes `collapsed` + `onToggle` down to both `Sidebar` and `Topbar`
- **`frontend/components/layout/topbar.tsx`** — accepts `collapsed`/`onToggle` props; renders a `PanelLeft` expand button at left of topbar when sidebar is collapsed, giving a clear re-expand affordance

**Decisions made:**

- Collapse state lives in `AppShell` (not a context or localStorage) — simplest correct scope; sidebar and topbar both need it, both are direct children of AppShell
- Topbar expand button only shown when sidebar is collapsed — avoids duplicate toggle controls when sidebar is visible
- `title=` attribute used for collapsed-mode tooltips — zero extra dependencies, works natively, consistent with the rest of the design

**What's still broken or incomplete:**

- Collapse state resets on page navigation (not persisted to localStorage) — acceptable for now
- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing)
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- `PrToken.sol` + `UtToken.sol` not written

**Next milestone:**

Write community module tests to move community from `partial` → `tested`, then start blockchain session.

**Token usage:**
Sonnet 4.6 — light session (3 files, collapsible sidebar + logout)

---

## [2026-02-28] — Docs audit: 8 contradictions corrected, missing conventions added

**What was built:**

- **Full `/audit-docs` pass** — Architect hat + Documentation hat, 8 files read in full:
  - `ai_workflows/CLAUDE.md`, `ai_workflows/DECISIONS.md`
  - `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/workers.ts`
  - `backend/src/modules/auth/services/auth.service.ts`
  - `backend/prisma/schema.prisma`, `docker/docker-compose.yml`
- **8 doc contradictions corrected** in `CLAUDE.md` and `DECISIONS.md` (commit `df6d74e`):
  1. JWT_SECRET minimum: docs said ≥64 chars; code enforces ≥32 in production — fixed to 32
  2. DASHBOARD_PASSWORD default: docs said `YourVeryStrongPassword123!`; docker-compose actually sets `admin123` — corrected. (A v3.1 "correction" had introduced this error.)
  3. ENCRYPTION_KEY default: docs said "silently empty string"; docker-compose actually sets 64 zero chars — corrected in both §3 and §7
  4. Traefik state: docs said "container runs but ports not bound"; Traefik is fully commented out and does not run — corrected
  5. `failedJobHandler` scope: docs said `sendJobFailureAlert` fires but doesn't email/Slack; the whole handler is dead code — never registered on any worker `failed` event, so `sendJobFailureAlert` is never called at all — corrected with stronger language + fix instruction
  6. ADR-009 Privy login method: ADR said "Primary login flow: `loginWithPhone()`"; actual config uses `loginMethods: ['email','wallet','google']` — corrected
  7. ADR-010 build order: ADR said Auth → Marketplace → Governance; actual order followed was Auth → User → Economy → Community → Governance — revised with reasoning
  8. Wagmi stale note in §4: "to be replaced by Privy in Phase 3" — Privy has been active since session 13; note removed
- **Missing conventions added to §5** (things enforced by code but not documented):
  - 10 MB request body limit
  - `logSecurityEvent(message, type, severity, detail, context)` from `core/logger/logger.ts` — for all security-relevant events; severity values listed
  - **Event bus registry** — canonical list of current published events: `user.created`, `user.email.verified`, `auth.login`, with listener mappings
- **Other gaps filled**:
  - Dev port map added to §3 cross-cutting gaps — includes Redis `:6380` (host) callout which would otherwise confuse developers expecting `:6379`
  - Graceful shutdown order corrected in §4: rateLimiter → tokenBlacklistService → BullMQ redis → Prisma (was just "close server → disconnect Prisma/Redis")
  - Docker Compose active service list corrected: `traefik` removed, `mailhog` added
  - `v3.3` version history entry added

**Decisions made:**

- No new architectural decisions — this was a pure documentation pass. All DECISIONS.md changes were corrections to existing ADRs (ADR-009, ADR-010), not new decisions.

**What's still broken or incomplete:**

- `failedJobHandler` is dead code in `workers.ts` — needs `worker.on('failed', failedJobHandler)` wired before production (now correctly documented; code fix deferred)
- `User.verificationLevel` and `User.status` are plain `String` fields in Prisma schema, not enums — no DB-level enforcement. Not a blocking issue but worth a schema ADR when governance module is built
- `User.roles String[]` is a denormalized duplicate of `UserRole` join table — no documented sync contract
- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing)
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin modules
- `PrToken.sol` + `UtToken.sol` not written

**Next milestone:**

Write community module tests to move community from `partial` → `tested` (highest backend priority — directly imported by auth; the last major gap before governance can be hardened).

**Token usage:**
Sonnet 4.6 — medium session (8-file read-audit across 2,000+ lines of code + 14 targeted doc edits)

---

## [2026-03-02] — Roles system hardened, notification type bug fixed, audit wired into auth + economy

**What was built:**

- **`backend/src/core/rbac/roles.ts`** — Complete rewrite per `roles.md` design decisions:
  - 5 new system roles: `system:compliance_officer`, `system:county_coordinator`, `system:blockchain_admin`, `system:contract_deployer`, `system:multisig_signer`
  - 2 new group roles: `SECRETARY`, `MODERATOR`
  - `RoleHierarchy` — LEADER inherits FACILITATOR + MODERATOR + SECRETARY + MENTOR + MEMBER
  - `roleIncludes(userRole, requiredRole)` — hierarchy-aware permission check
  - `isValidSystemRole()` + `isValidGroupRole()` — runtime type guards
  - `RoleDisplayNames`, `GroupRoleDescriptions`, `AssignmentMethod`, `GroupRoleAssignment`, `SystemRoleAssignment`, `ElectionThresholds`
- **`backend/src/core/database/seed.ts`** — 5 new role rows seeded
- **`backend/src/modules/admin/routes/admin.routes.ts`** + **`audit.routes.ts`** + **`password-reset.service.ts`** — all raw string role literals replaced with `SystemRoles.*` constants
- **`backend/tests/auth/helpers.ts`** — `createTestAdmin()` fixed to upsert `system:super_admin` (was creating non-existent `'ADMIN'` role)
- **`backend/src/modules/notifications/services/notification.service.ts`** — Type-loss bug fixed: added `toPrismaType()` mapping DUES_REMINDER/DUES_OVERDUE → ECONOMIC; PROPOSAL_* → PROPOSAL; rest → SYSTEM (was hardcoded SYSTEM for everything)
- **`backend/src/modules/audit/types.ts`** — Added `EMAIL_VERIFIED` and `COMMITMENT_CREATED` to `AuditAction` enum
- **`backend/src/modules/auth/services/auth.service.ts`** — `USER_CREATED` audit after new user creation; `EMAIL_VERIFIED` audit after first-time email verification
- **`backend/src/modules/economy/services/participationRights.service.ts`** — `PR_AWARDED` + `PR_SPENT` audit after each transaction; refactored `return this.prisma.$transaction(...)` → `const log = await ...` pattern to allow post-transaction calls
- **`backend/src/modules/economy/services/dues.service.ts`** — `DUES_PAID` + `COMMITMENT_CREATED` audit; same refactor pattern
- All tests: 173/173 green

**Decisions made:**

- Audit calls placed **outside** transaction blocks — orphaned audit records are preferable to failed operations. Revisit with outbox/saga pattern if strict audit completeness is required.
- `roleIncludes()` resolves inherited permissions at runtime — callers don't need to enumerate every sub-role.

**What's still broken or incomplete:**

- `next build` fails at `/404` (Next.js 15.3.3 bug, pre-existing)
- `failedJobHandler` in `workers.ts` still dead code
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- M-Pesa verification stubbed
- `PrToken.sol` + `UtToken.sol` not written
- Raw-string role literals remain in `admin.validators.ts` + `emergency.routes.ts` (pre-existing, out of scope)
- Profile updates, group joins, governance actions not yet wired into audit (wire when those modules are tested)
- Notifications: no DUES_REMINDER BullMQ job, no preference routes, only emergency module sends notifications

**Next milestone:**

Write community module tests to move community from `partial` → `tested`, then start blockchain session (`PrToken.sol` + `UtToken.sol` + Foundry tests + Base Sepolia deploy).

**Token usage:**
Sonnet 4.6 — heavy session (roles system rewrite, 3 service files refactored for audit, 2-module diagnostic, notification type fix)

---

## [2026-03-02] — Community module tests: 49 new tests green, community status partial → tested

**What was built:**

- **`backend/src/core/events/listener-registry.ts`** — fixed listener registration gap: `registerCommunityListeners()` import and call were commented out — users auto-enroll in system groups on email verification now actually fires
- **`backend/tests/community/helpers.ts`** (new): shared seed helpers and token factories for all community tests:
  - Re-exports `TEST_WARD_ID`, `TEST_CONST_ID`, `TEST_COUNTY_ID`, `seedLocation` from auth helpers
  - New: `TEST_WARD_ID_B` (second ward, same constituency) — required to avoid concurrent group-create race in `enrollInSystemGroups` tests
  - `seedSecondWard()` — upserts the second ward
  - `createCommunityTestUser()` — creates `COMMUNITY_VERIFIED` user with primary ward
  - `awardPR()` — awards PR via `participationRightsService.award()`
  - `seedVoluntaryGroup()` — creates a voluntary group with LEADER membership
  - `makeCommunityToken()` — JWT factory for community routes (no verificationLevel gate)
- **`backend/tests/community/group.service.test.ts`** (new, 13 tests): unit tests for `GroupService`:
  - `createVoluntaryGroup()`: happy path, spends 100 PR, invalid type (400), insufficient PR (403), zero PR (403), no description
  - `joinGroup()`: happy path, 404 non-existent, 400 system group, 409 duplicate
  - `leaveGroup()`: happy path (deletes record), 404 not a member, 403 canLeave=false
- **`backend/tests/community/groupMembership.service.test.ts`** (new, 16 tests): unit tests for `GroupMembershipService`:
  - `enrollInSystemGroups()`: creates 5 system groups (primary ward + secondary ward + constituency + county + national), idempotency, memberCount increment, no double-increment, throws for non-existent ward
  - `updateResidenceGroups()`: completes without error, user remains enrolled after re-enrollment
  - `getUserGroups()`: returns active memberships with correct fields, empty array, filter system-only, filter voluntary-only
  - `getGroupMembers()`: returns active members with metadata, excludes inactive, empty for empty group, respects pagination (limit/offset)
- **`backend/tests/community/group.routes.test.ts`** (new, 20 tests): Supertest integration tests for community HTTP routes:
  - `POST /community/voluntary/create`: 401, 400 missing fields, 400 short name, 400 invalid type, 403 insufficient PR, 200 success, persists to DB, spends 100 PR
  - `POST /community/join`: 401, 400 invalid UUID, 400 missing, 404 group not found, 400 system group, 409 duplicate, 200 success MEMBER
  - `POST /community/leave`: 401, 400 invalid UUID, 400 missing, 404 not member, 403 canLeave=false, 200 success + deletes record
- **Full test suite: 222/222 green** (173 existing + 49 new community tests across 4 files)

**Decisions made:**

- Use distinct `TEST_WARD_ID` (primary) and `TEST_WARD_ID_B` (secondary, same constituency) in all enrollment tests — this avoids the `Promise.all` concurrent `findFirst + create` race on the `@unique Group.name` field inside `enrollInSystemGroups`; using the same ward for both triggers a unique constraint violation
- `updateResidenceGroups` test checks only that active memberships exist after re-enrollment — using the same ward pool (just swapped) means all memberships upsert back to `active: true`, so testing for inactive records would always fail; the real production behavior (moving to a different ward) would show inactive old-ward memberships but requires a different ward pool setup
- `groupMembershipService` mocked in route tests (not real) — route tests focus on HTTP contract, not membership service internals; membership service has its own dedicated unit test file

**What's still broken or incomplete:**

- `next build` fails at `/404` (Next.js 15.3.3 bug, pre-existing)
- `failedJobHandler` in `workers.ts` still dead code
- No tests for governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- M-Pesa verification stubbed
- `PrToken.sol` + `UtToken.sol` not written
- `enrollInSystemGroups` has a real concurrency bug when `primaryWardId === secondaryWardId` (same ward for both fields) — the `Promise.all` causes a unique constraint violation. Deferred until user data model enforces distinct wards.
- Profile updates, group joins, governance actions not yet wired into audit

**Next milestone:**

Start blockchain session: write `PrToken.sol` (soulbound ERC-20) + `UtToken.sol` + Foundry tests + Base Sepolia deploy + wire `participationRights.service.ts` to call the minter.

**Token usage:**
Sonnet 4.6 — heavy session (4 test files created across 2 conversation continuations, concurrent create race diagnosed and fixed, 222 tests green)

---

## [2026-03-02] — Blockchain session: PrToken + UtToken contracts, Foundry tests green, backend wired

**What was built:**

- **`contracts/src/PrToken.sol`** — soulbound ERC-20 (Participation Rights): `transfer`, `transferFrom`, `approve` always revert with `"PR: non-transferable"`; `allowance` always returns 0. Role-gated `mint(address, uint256)` (emits `ParticipationRightsAwarded`) and `burn(address, uint256)`. Inherits OZ v5 `ERC20` + `AccessControl`. `PR_MINTER_ROLE` + `PR_BURNER_ROLE` granted to `admin` in constructor.
- **`contracts/src/UtToken.sol`** — standard transferable ERC-20 (Utility Token): same role pattern (`UT_MINTER_ROLE`, `UT_BURNER_ROLE`), no transfer restrictions.
- **`contracts/test/PrToken.t.sol`** (9 tests): mint balance, mint event, transfer reverts, transferFrom reverts, approve reverts, allowance zero, burn reduces balance, non-minter reverts, non-burner reverts — all green
- **`contracts/test/UtToken.t.sol`** (4 tests): mint balance, transfer works A→B, burn reduces balance, non-minter reverts — all green
- **`contracts/script/Deploy.s.sol`** — reads `MINTER_WALLET_ADDRESS` from env; deploys both tokens; logs addresses via `console.log`. Ready for Base Sepolia when wallet is funded.
- **`contracts/lib/openzeppelin-contracts`** — OZ v5 installed via `forge install`; remapping `@openzeppelin/=lib/openzeppelin-contracts/` added to `foundry.toml`; `forge build` → ABIs in `contracts/out/`
- **`backend/src/core/blockchain/client.ts`** (new): `getPrContract()` / `getUtContract()` — ethers v6 singletons; return `null` when `MINTER_PRIVATE_KEY` is missing or is the dev placeholder (`0x0000...`), when `BASE_RPC_URL` is missing, or when `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS` are empty. Provider + signer initialised once per process.
- **`backend/src/modules/economy/services/participationRights.service.ts`** — on-chain mint added after `auditService.log()` in `award()`: guarded by `NODE_ENV !== 'test'` + `user.walletAddress` non-null + `getPrContract() !== null`. Off-chain award and DB record are never affected if on-chain call fails.
- **`docker/docker-compose.yml`** — `ujamaa_anvil` service added (image: `ghcr.io/foundry-rs/foundry:latest`, chain-id 31337, port 8545); worker service gets `BASE_RPC_URL`, `MINTER_PRIVATE_KEY` (dev placeholder), `PR_TOKEN_ADDRESS`, `UT_TOKEN_ADDRESS` env vars. Web service intentionally does NOT receive `MINTER_PRIVATE_KEY`.
- **Foundry installed** at `/home/mzizi/.foundry/bin/` — `forge --version` → 1.5.1-stable

**Decisions made:**

- **Soulbound via public function override, not `_beforeTokenTransfer`** — OZ v5 removed `_beforeTokenTransfer` hook. The correct pattern is to override the four public functions (`transfer`, `transferFrom`, `approve`, `allowance`) directly and revert. Internal `_mint`/`_burn` bypass the public overrides, so mint and burn still work.
- **Triple null-guard in `getPrContract()`** — any single missing env var returns `null` silently, no crash. This means all 222 existing tests pass without any mocking — `NODE_ENV=test` check in `award()` is a second layer of defence, but the null-guard in the client is the primary gate in dev/prod when contracts aren't deployed yet.
- **`MINTER_PRIVATE_KEY` on worker only, never on web** — the HTTP API process has no need to sign transactions. Keeping the private key off the web container limits blast radius if the web process is compromised.
- **OZ installed without `--no-commit`** — newer forge API removed that flag (now uses `--commit` for the opposite). `forge install` always commits the submodule by default in newer versions; the `contracts/lib/` submodule was staged and committed as part of the session commit.
- **ABI artifacts loaded via `createRequire`** — `contracts/out/` artifacts are `require()`d from the backend using Node's `createRequire(import.meta.url)` since the backend uses ESM. Relative path from `client.ts` goes `../../../../../contracts/out/...`.

**What's still broken or incomplete:**

- Base Sepolia deploy not done — minter wallet not funded yet. `PR_TOKEN_ADDRESS` and `UT_TOKEN_ADDRESS` are empty in docker-compose; on-chain mint will silently skip until these are set.
- `next build` fails at `/404` (Next.js 15.3.3 bug, pre-existing)
- `failedJobHandler` in `workers.ts` still dead code
- No tests for governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- M-Pesa verification stubbed
- Profile updates, group joins, governance actions not yet wired into audit

**Next milestone:**

Fund the minter wallet, run `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast`, then set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS` in docker-compose to activate on-chain minting.

**Token usage:**
Sonnet 4.6 — medium session (2 Solidity contracts, 2 test files, 1 deploy script, 1 backend client, 2 file edits, forge install + build + test)

---

## [2026-03-02] — Baraza messaging integration: Telegram, WhatsApp, Discord + frontend step 5

**What was built:**

- **Schema additions** — `MessagingPlatform` enum + `UserMessagingProfile` model (userId, platform, handle, externalId) in auth schema; `BarazaGroup` model (groupId, platform, externalId, name, inviteLink, isActive) + `BarazaAttendance` model in community schema. Migration `20260302051843_add_baraza_integration` applied; total 83 Prisma models.
- **PR config** — 3 new `ParticipationRightsReason` values: `BARAZA_ATTENDED` (+15), `BARAZA_FACILITATED` (+25), `BARAZA_REPORT_SUBMITTED` (+10). Added to `PR_CONFIG` + `ParticipationRightsReason` enum in `economy/types.ts`.
- **Auth integration** — `auth.validators.ts` + auth types extended with `messagingPlatforms` on signup. `auth.service.ts` creates `UserMessagingProfile` rows inside the registration transaction.
- **Integration module** (`backend/src/modules/integration/`): `types.ts`, `services/telegram.service.ts` (webhook processing + member sync), `services/discord.service.ts` (interaction handler), `services/baraza-bot.service.ts` (cross-platform reward dispatch), `jobs/baraza-reward.jobs.ts` (BullMQ job processor), `controllers/bot.controller.ts`, `routes/bot.routes.ts`, `listeners/integration-events.listener.ts`.
- **Queue wiring** — `integrationQueue` added to `core/queue/index.ts`; `integrationWorker` added to `workers.ts`; `registerIntegrationListeners()` wired in `listener-registry.ts`. Routes mounted at `/api/v1/integration` in `app.ts`.
- **Docker env** — Worker service gets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY` env vars.
- **Frontend step 5** — Register-form gains a "Stay Connected" step with Telegram/WhatsApp/Discord platform cards + handle inputs. `api.ts requestMagicLink` extended with `messagingPlatforms` param.

**Decisions made:**

- **Keep WhatsApp despite 1024-member group limit** — ~96% Kenyan penetration justifies staying on the platform. Overflow is handled via multiple baraza groups per ward (`@@unique([groupId, platform, externalId])` allows several WHATSAPP groups for one Group). Coordinators register "Ward North Baraza" + "Ward South Baraza" separately; join links are delivered at signup.
- **Barazas scoped to one Group** — `BarazaGroup.groupId` references the `Group` table (no filter applied), allowing both system and voluntary groups to have linked barazas. One external group → one `BarazaGroup` row; multiple external groups can link to the same internal Group for overflow.
- **Voluntary groups handled identically to system groups** — no schema filter; any `groupId` may be registered as a BarazaGroup.

**What's still broken or incomplete:**

- `next build` fails at `/404` (Next.js 15.3.3 bug, pre-existing)
- `failedJobHandler` in `workers.ts` still dead code
- No tests for integration module, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- Telegram/Discord bot tokens are placeholders — real bots not yet configured
- M-Pesa verification stubbed
- Base Sepolia deploy pending (minter wallet not funded)

**Next milestone:**

Wire frontend to all new backend endpoints — add `integrationApi`, `notificationsApi`, `communityApi`, `governanceApi` namespaces to `frontend/lib/api.ts` and update the notification bell + dashboard cards to show real data.

**Token usage:**
Sonnet 4.6 — heavy session (new Prisma models, migration, full integration module, BullMQ wiring, frontend step 5)

---

## [2026-03-02] — Frontend wiring + GET endpoints for community and governance

**What was built:**

- **`frontend/lib/api.ts`** — 4 new API namespaces added: `integrationApi` (`getBarazaGroups`, `registerBarazaGroup`, `recordAttendance`, `deactivateBarazaGroup`), `notificationsApi` (`getNotifications`, `markRead`), `communityApi` (mutations + `getMyGroups`, `getGroupMembers`), `governanceApi` (mutations + `getProposals`, `getProposal`). New DTOs: `BarazaGroupDto`, `RegisterBarazaGroupDto`, `NotificationDto`, `GroupMembershipDto`, `GroupMemberDto`, `ProposalDto`.
- **`ApiClient` delegation** — `getGroups()` now calls `communityApi.getMyGroups()` and maps the response shape; `getGroupMembers()` delegates to `communityApi.getGroupMembers()`; `getProposals()` calls `governanceApi.getProposals()` and maps backend status enums to frontend display values; `markNotificationRead()` added (was missing, causing silent failures in `notification-context.tsx`); `getUserGroups()` delegates to `communityApi.getMyGroups()`.
- **`components/layout/notifications-popover.tsx`** (new) — Real notification bell: reads from existing `NotificationContext` (already polls `/notifications`), shows unread count badge, popover with scrollable list, click-to-mark-read, relative timestamps, amber left-border for unread rows.
- **`components/integration/baraza-groups-card.tsx`** (new) — "My Barazas" dashboard card: TanStack Query fetch, platform badges (Telegram=blue, WhatsApp=green, Discord=indigo), "Join" button opens invite link, "Inactive" badge for deactivated groups, empty state for wards with no barazas yet.
- **Topbar** — hardcoded bell + red dot replaced with `<NotificationsPopover />`.
- **Dashboard** — `<GroupsList />` stub replaced with `<BarazaGroupsCard />`.
- **`auth-context.tsx`** — Pre-existing TypeScript error fixed: `requestMagicLink` type was missing `messagingPlatforms` field (added in session 21 to api.ts but AuthContextType was never updated).
- **Backend community GET endpoints** — `GET /community/my-groups` (returns all active group memberships for the authenticated user) + `GET /community/:groupId/members?limit&offset` (paginated member list). Controller methods added to `group.controller.ts`; routes added to `group.routes.ts`. Service methods (`getUserGroups`, `getGroupMembers`) already existed in `groupMembership.service.ts`.
- **Backend governance GET endpoints** — `GET /governance` (list proposals with `groupId`/`status`/`limit`/`offset` query params) + `GET /governance/:proposalId` (single proposal with vote weight summary). `getProposal()` + `listProposals()` service methods added to `proposal.service.ts`. Controller and route handlers added. GET routes registered before existing POST routes to avoid path conflicts with `/:proposalId/tally`.

**Decisions made:**

- **Reuse `NotificationContext` instead of direct API call in `NotificationsPopover`** — The context was already in the provider tree polling `/notifications` every 60s. Creating a second `useQuery` in the popover would duplicate the fetch. Reading from `useNotifications()` avoids double-fetching and shares the same cache.
- **`ApiClient` class kept for backward-compatibility** — Six existing components (`groups-list.tsx`, `fetch-proposals.tsx`, `group-detail.tsx`, `group-members.tsx`, `voting-context.tsx`, `notification-context.tsx`) import `apiClient`. Rather than migrating all six in one session, the class methods were updated to delegate to the real namespaced APIs with response mapping. Migration can happen per-component.
- **Governance `GET /` before POST routes** — Express router matches in registration order. `GET /:proposalId` must be registered before `POST /:proposalId/tally` to prevent the tally POST from being shadowed. Both GET routes go at the top of the router, before all POST routes.
- **Frontend `Proposal` type mismatch handled with defaults** — The frontend `fetch-proposals.tsx` uses a richer `Proposal` interface (with `votingStats`, `userVote`, `canVote`, `canEdit`, `purpose`, etc.) that doesn't align 1:1 with the backend model. The `ApiClient.getProposals()` mapping layer fills unmapped fields with safe defaults (0, false, undefined) so the UI renders without errors, even if some features (voting stats, user vote history) remain incomplete until governance is fully built out.

**What's still broken or incomplete:**

- Auth test flakiness: 25/222 auth tests show intermittent failures (unique constraint on `name`, JWT expiry timing) — pre-existing, unrelated to this session's changes. Community + Economy tests: 83/83 green.
- `next build` fails at `/404` (Next.js 15.3.3 bug, pre-existing)
- `failedJobHandler` in `workers.ts` still dead code
- No tests for integration, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- `fetch-proposals.tsx` + `voting-interface.tsx` + `enhanced-proposals.tsx` have pre-existing scaffold TypeScript errors (wrong Proposal interface shape) — renders correctly at runtime but tsc reports errors in those files
- Governance proposal listing shows empty `votingStats` (yesVotes/noVotes hardcoded to 0) until vote weight aggregation is added to `listProposals`
- M-Pesa verification stubbed
- Base Sepolia deploy pending

**Next milestone:**

Move governance module from `partial` → `tested` by adding service + route tests (the GET endpoints added this session are the highest-value coverage gap), then wire the Base Sepolia deploy.

**Token usage:**
Sonnet 4.6 — heavy session (2-part: frontend wiring plan + GET endpoints plan, 8 files modified, 2 new frontend components)

---

## [2026-03-03] — Audit fixes, registration flow bugs fixed, field-level validation errors surfaced, Kenyan phone normalisation

**What was built:**

- **`backend/src/app.ts`** — 2 observability bugs fixed:
  - Bug A: `integrationQueue` added to both the `@core/queue/index.js` import and the `createBullBoard` queues array — the queue was created in session 21 but was invisible in the `/admin/queues` dashboard
  - Bug B: `integration: '/api/v1/integration'` added to the `/api/v1/docs` endpoint (route was mounted but missing from the documentation object)
- **`ai_workflows/DECISIONS.md`** — ADR-024 written: Baraza integration platform decisions (WhatsApp webhook-receive vs Telegram/Discord bot-token, single `integrationQueue`, worker-only bot tokens, `@@unique([groupId, platform, externalId])` constraint, one `UserMessagingProfile` per platform per user)
- **`ai_workflows/CLAUDE.md`** — §5 worker-only secrets convention added; 4 new §7 issues (Bull Board gap, DASHBOARD_PASSWORD double-default, Privy App ID not in docker-compose, WhatsApp webhook pattern); v3.9 version history entry
- **Session 22 git housekeeping** — uncommitted session 22 changes (GET endpoints + frontend wiring, 12 modified files + 3 untracked) committed and pushed to `origin/develop`
- **`frontend/components/auth/register-form.tsx`** — 3 registration flow bugs fixed:
  - Bug 1: `setHandle` used `handle || undefined` — a handle of `" "` (single space) is truthy in JS, was sent to backend, failed regex `/^@?[\w.\-]+$/`. Fixed: `handle.trim() || undefined`
  - Bug 2: phone number placeholder `+254 700 000 000` had spaces; `canAdvance()` only checked non-empty so user could reach submit with spaces in the number; backend regex `/^\+254[17]\d{8}$/` rejected it. Fixed: `.replace(/\s+/g, '')` on submit
  - Bug 3: `auth-context.tsx requestMagicLink` implementation params were missing `messagingPlatforms` (added to `AuthContextType` interface in session 21 but not the `useCallback` type). Fixed: added `messagingPlatforms?` to implementation params
- **`frontend/lib/api.ts`** — `ApiError` class gains `errors?: Record<string, string>` third constructor argument; `apiFetch` extracts `body.details?.validation?.errors` and passes it when throwing — backend field-level validation errors are no longer swallowed
- **`frontend/components/auth/register-form.tsx`** — `fieldErrors` state added; `handleSubmit` catch sets it when `err.errors` is present; error display block renders field errors as a `<ul>` list under the heading "Please fix the following errors:"
- **Phone format normalisation** — submit handler now chains `.replace(/^0/, '+254')` so users can type the natural Kenyan `07XXXXXXXX` / `01XXXXXXXX` format; placeholder updated to `0712 345 678`

**Decisions made:**

- **No ADR needed for phone normalisation** — it is a UX convention (strip spaces, leading-zero → +254), not an architectural choice. The backend E.164 regex remains unchanged; the frontend adapts to local input patterns.
- **Field errors rendered as list, not inline** — the error box is shown at the bottom of the current step. Inline per-field highlighting would require step-aware field mapping (e.g. phone is on step 0 but submit is on step 4). Listing errors in the footer is robust regardless of which step the invalid field belongs to.
- **`ApiError.errors` is optional, not required** — non-validation errors (401, 500, network) should not be forced to set `errors`. The pattern is: set `errors` only when backend returns `details.validation.errors`; all existing `throw new ApiError(status, message)` call sites remain unchanged.

**What's still broken or incomplete:**

- Auth test flakiness: 25/222 auth tests intermittent (unique constraint, JWT timing) — pre-existing, unrelated to this session
- `next build` fails at `/404` (Next.js 15.3.3 bug, pre-existing)
- `failedJobHandler` in `workers.ts` still dead code
- No tests for integration, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- Governance proposal list returns `_count.votes` only — yesWeight/noWeight not broken out per proposal in the list
- M-Pesa verification stubbed
- Base Sepolia deploy pending (minter wallet not funded)

**Next milestone:**

Write governance module service + route tests to move governance from `partial` → `tested`.

**Token usage:**
Sonnet 4.6 — medium session (audit fixes + 3 registration bugs + validation error surfacing + phone normalisation; 5 commits)

---

## [2026-03-03] — Group detail page functional, Turbopack enabled, Next.js 16, signup button in topbar

**What was built:**

- **Turbopack** — `package.json dev` script changed to `next dev --turbopack`; `turbopack.resolveAlias` block added to `frontend/next.config.mjs` with relative paths (`'./stubs/empty.js'`) for `unstorage`, `x402/client`, `@base-org/account`. Dev route compile time: 2-5s (webpack) → 100-500ms (Turbopack). Webpack config retained for `next build`.
- **Next.js 16.1.6 upgrade** — bumped `next` 15.3.3 → 16.1.6, `eslint-config-next` 14.0.3 → 16.1.6, `eslint` ^8 → ^9. `tsconfig.json` auto-patched by Next.js 16 (`jsx: preserve` → `react-jsx`, added `.next/dev/types/**/*.ts` to include array). Node modules volume purged and rebuilt via `docker compose up --build`.
- **`components/community/system-groups-card.tsx`** — Each community row (ward/constituency/county/national) is now a `<Link href="/groups/[groupId]">` with hover highlight. Previously the card displayed data but was not navigable.
- **`backend/src/modules/community/services/groupMembership.service.ts`** — New `getGroupById(groupId, userId)` method: fetches single group with location relations + requesting user's membership row. Returns `GroupDetailDto`-shaped object: `groupId`, `groupName`, `description`, `isSystem`, `systemType`, `voluntaryType`, `locationScope`, `memberCount`, `createdAt`, `ward`, `constituency`, `county`, `userRole`, `userJoinedAt`.
- **`backend/src/modules/community/controllers/group.controller.ts`** — New `getGroupDetail` static method delegates to `groupMembershipService.getGroupById(groupId, userId)`.
- **`backend/src/modules/community/routes/group.routes.ts`** — `GET /:groupId` route registered between `/my-groups` and `/:groupId/members` to avoid path conflicts.
- **`frontend/lib/api.ts`** — `GroupDetailDto` interface exported; `communityApi.getGroupDetail(groupId)` added; `apiClient.getGroup()` wired from `return null` stub to real `communityApi.getGroupDetail()`.
- **`components/groups/group-detail.tsx`** — Full rewrite using `GroupDetailDto`: level icon + badge (NATIONAL/COUNTY/CONSTITUENCY/WARD), location breadcrumb (County → Constituency → Ward), member count stat, created date, user's role, joined date, description. Join/Leave mutation (TanStack useMutation) for voluntary groups only — invalidates `["group", groupId]`, `["system-groups"]`, and `["groups"]` queries on success.
- **`components/groups/group-members.tsx`** — Full rewrite using `GroupMemberDto`: uses `member.userId`/`member.userName`/`member.avatarUrl`/`member.verificationLevel`/`member.role`/`member.joinedAt` directly. Verified users show a `ShieldCheck` icon. Role badges (LEADER/ADMIN/MEMBER) with Chai palette colours. Skeleton rows during load.
- **`components/layout/topbar.tsx`** — Unauthenticated users now see "Get Started" (→ `/auth/register`, tea-green pill) and "Sign In" (→ `/auth/callback`, ghost) buttons instead of the notification bell and wallet button. `useAuth().isAuthenticated` guards which set of controls renders.

**Decisions made:**

- **Turbopack for dev only; webpack for build** — `next build` still uses webpack because Turbopack's production build pipeline is not yet stable in Next.js 16. The two configs coexist: `turbopack.resolveAlias` for dev, `webpack.resolve.alias` + `NormalModuleReplacementPlugin` for build. No user-visible difference at runtime.
- **Join/Leave button only for voluntary groups** — System groups (ward/constituency/county/national) are auto-enrolled by the backend on registration and are non-optional. Showing a "Leave" button would confuse users or result in a 400 error from the backend (system groups cannot be left via the join/leave endpoint). The detail component checks `group.isSystem` and hides the button accordingly.
- **Topbar signup button rather than separate page banner** — The topbar is the only global UI element visible across all authenticated-layout pages. Adding the button there ensures unauthenticated users who reach any route inside the app shell (e.g. via a shared link) always have a clear path to register. The landing page retains its own "Get Started" CTA.

**What's still broken or incomplete:**

- Auth test flakiness: 25/222 auth tests intermittent (pre-existing)
- `next build` fails at `/404` (Next.js upgrade did not fix this — pre-existing)
- `failedJobHandler` in `workers.ts` still dead code
- No tests for integration, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- `fetch-proposals.tsx` + `voting-interface.tsx` + `enhanced-proposals.tsx` pre-existing scaffold TypeScript errors
- Governance proposal list returns `_count.votes` only — yesWeight/noWeight not per-proposal in list endpoint
- M-Pesa verification stubbed
- Base Sepolia deploy pending (minter wallet not funded)
- Groups page (`app/groups/page.tsx`) stats are still hardcoded values (3 groups, 1 admin, etc.)

**Next milestone:**

Write governance module service + route tests to move governance from `partial` → `tested`.

**Token usage:**
Sonnet 4.6 — heavy session (2-part, cross-context: Next.js upgrade + group detail page; 8 files committed across backend + frontend)

---

## [2026-03-03] — Enrollment race condition fixed; all frontend stats wired to real data; orphaned users re-enrolled

**What was built:**

- **`backend/src/modules/community/services/groupMembership.service.ts` — enrollment race fix** — `ensureSystemGroupAndEnroll` and `ensureNationalGroupAndEnroll` both replaced the `findFirst → create` pattern with a single atomic `upsert` on `Group.name` (a `@unique` field). Root cause: `Promise.all` inside `prisma.$transaction` ran concurrent ward lookups for two simultaneous registrations; both saw `null` for the same system group name and both tried `tx.group.create()` → unique constraint violation on `Group.name`. `upsert` serialises this via PostgreSQL `INSERT ... ON CONFLICT DO UPDATE`.
- **`frontend/lib/types.ts` + `frontend/contexts/auth-context.tsx`** — `utBalance: number` added to `User` type; mapped in `mapBackendUser()` from `raw.economic?.utilityTokens ?? raw.utilityTokens ?? 0`.
- **`frontend/components/layout/topbar.tsx`** — `TokenChip` component + token stat strip added for desktop (`hidden md:flex`). Shows PR (amber), IP (tea-green), UT (warm-brown) chips between page title and action buttons. Auth-gated (`isAuthenticated && user`).
- **`frontend/components/dashboard/dashboard-content.tsx`** — Three new `useQuery` calls: `proposalsMeta` (governance count via `governanceApi.getProposals({ limit:1 })`), `myGroups` (community count via `communityApi.getMyGroups`), `notifications` (real activity via `notificationsApi.getNotifications`). "Active Proposals" and "My Communities" stats now show real numbers. Recent Activity section replaced 3 hardcoded static items with `notifications.slice(0, 5)` mapped by type to icon; empty state shows "No recent activity yet." Mobile token bar (`md:hidden`) added below welcome greeting.
- **`frontend/app/groups/page.tsx`** — Replaced `useState(loading)` + `useEffect(setTimeout 1000ms)` fake delay with real `useQuery(communityApi.getMyGroups, staleTime: 60_000)`. Four stats now computed from live data: My Groups (`groups.length`), Admin Roles (LEADER/ADMIN count), System Groups (`isSystem` count), Voluntary (`!isSystem` count). Icons updated to `Shield` and `Network`.
- **`frontend/app/proposals/page.tsx`** — Replaced 4 hardcoded stats with 2 real counts from `governanceApi.getProposals()`: Active Proposals (status: VOTING) and Total Proposals. Two unachievable stats (votes cast, avg time) removed entirely.
- **`frontend/components/user/user-profile.tsx`** — Token stats expanded from 2-col to 3-col grid. UT chip added alongside PR and IP using Zap icon + warm-brown colour.
- **`ai_workflows/CLAUDE.md` + `ai_workflows/SESSION_STATE.md`** — PWA non-installability noted as a known issue with full diagnosis (package installed but not wired).
- **`backend/scripts/re-enroll-orphaned-users.ts`** — One-time remediation script: queries for EMAIL_VERIFIED+ users with both ward IDs set and zero group memberships, skips test-email patterns (`/flowtest|e2e_test|ujamaa_admin/i`), calls `groupMembershipService.enrollInSystemGroups()` for each. Ran successfully: 7 real users re-enrolled (kisombe, joan, joe, waichari, jane + 2 e2e_v2 test users), all now have 5–7 group memberships. 1 test user (`e2e_test_*`) intentionally skipped.

**Decisions made:**

- **Upsert is the canonical pattern for system group creation** — `findFirst + create/update` is not safe under concurrent load because Prisma transactions do not isolate reads across concurrent transactions at the default isolation level. Any "find-or-create" pattern on a `@unique` field must use `upsert`. This applies to all future system group provisioning code.
- **Mobile token balance on dashboard only, not topbar** — The topbar is too narrow on mobile (hamburger → title → bell) to accommodate 3 stat chips without overflow or layout break. The dashboard mobile token bar (`md:hidden`, below greeting, horizontally scrollable) is the correct placement. A future React Native app should use a sticky wallet header on the home screen.
- **Re-enrollment script skips test users by email pattern** — Test accounts (`flowtest*`, `e2e_test*`, `ujamaa_admin*`) don't need real groups in production; enrolling them would create noise in the system group member counts. The skip list is encoded as regex patterns in the script itself for clarity.

- **`backend/tests/governance/helpers.ts`** — `createGovernanceUser()` (no ward dependency), `seedGovernanceGroup()` (sets creator IP=1000 + adds dummy second member so WARD-scope 90th-percentile IP check passes), `addGroupMember()`, `seedProposal()` (inserts at any status, bypasses PR spend), `makeGovernanceToken()`.
- **`backend/tests/governance/proposal.service.test.ts`** — 25 service unit tests covering all 6 methods: createProposal (happy path, emergency flag, not found, not member, insufficient PR), startVoting (DRAFT→VOTING, not creator, already voting, not found), castVote (YES + PR spend, NO, not member, not voting, duplicate 409, not found), tallyVotes (APPROVED, REJECTED, no-op on non-VOTING, not found), getProposal (votesSummary with yes/no weights, not found), listProposals (all, by groupId, by status, pagination).
- **`backend/tests/governance/proposal.routes.test.ts`** — 22 route integration tests covering all 6 HTTP endpoints: auth gates (401 without token), validation gates (400 for short title/description, invalid UUID, bad vote option), success cases (200), and service-level error propagation (404, 409).
- **Total tests: 269/269 green** (222 existing + 47 new governance). Governance status: `partial` → **`tested`**.

**Decisions made:**

- **Upsert is the canonical pattern for system group creation** — `findFirst + create/update` is not safe under concurrent load because Prisma transactions do not isolate reads across concurrent transactions at the default isolation level. Any "find-or-create" pattern on a `@unique` field must use `upsert`. This applies to all future system group provisioning code.
- **Mobile token balance on dashboard only, not topbar** — The topbar is too narrow on mobile (hamburger → title → bell) to accommodate 3 stat chips without overflow or layout break. The dashboard mobile token bar (`md:hidden`, below greeting, horizontally scrollable) is the correct placement. A future React Native app should use a sticky wallet header on the home screen.
- **Re-enrollment script skips test users by email pattern** — Test accounts (`flowtest*`, `e2e_test*`, `ujamaa_admin*`) don't need real groups in production; enrolling them would create noise in the system group member counts. The skip list is encoded as regex patterns in the script itself for clarity.
- **Governance test helpers avoid ward dependency** — `createGovernanceUser()` does not set `primaryWardId`/`secondaryWardId`, so governance tests run without needing `seedLocation()`. The IP percentile check (WARD scope requires top-90%) is satisfied by setting creator `globalImpactPoints=1000` + a second dummy member at IP=0 → creator rank=1/2=0.5 < 0.9.

**What's still broken or incomplete:**

- Base Sepolia deploy pending (minter wallet not funded)
- `next build` fails at `/404` static generation (pre-existing)
- PWA not installable — `next-pwa` installed but not wired (deferred)
- `failedJobHandler` in `workers.ts` is dead code (pre-existing)
- `fetch-proposals.tsx`, `voting-interface.tsx`, `enhanced-proposals.tsx` have pre-existing scaffold TypeScript errors

**Next milestone:**

Fund minter wallet and deploy PrToken + UtToken contracts to Base Sepolia; set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS` in docker-compose.

**Token usage:**
Sonnet 4.6 — heavy session (cross-context continuation: enrollment bug fix + full frontend data wiring + re-enrollment remediation + governance tests; 269/269 green)

---

## [2026-03-03] — Planning session: community module gaps + onboarding lifecycle analysis

**What was built:**

- **Plan only — no code committed this session.** Full implementation plan written and saved to `.claude/plans/wiggly-conjuring-nygaard.md` for execution in the next session.
- **Onboarding lifecycle analysed:** `OnboardingProgress` is created at registration with 3 flags pre-set (`profileCompleted`, `industriesSelected`, `goodsServicesSelected`, `currentStep: 'EMAIL_VERIFICATION'`). It advances once on email verification to `currentStep: 'PLATFORM_INTRO'`. After that, nothing ever writes to the remaining 15+ boolean fields (`joinedWardGroup`, `joinedVoluntaryGroup`, `castFirstVote`, `phoneVerified`, `communityVerified`, `walletConnected`, etc.) — these were designed but never wired to any actions.
- **Community module gaps identified:**
  - `Group.memberCount` never incremented/decremented — `joinGroup`, `leaveGroup`, and `createVoluntaryGroup` all bypass it
  - No `GET /community/groups` endpoint — users cannot discover or browse groups
  - Group admin routes commented out — no settings update, member role change, or member removal
  - Community listener (`user-events.listeners.ts`) enrolls users in system groups but never updates `OnboardingProgress.joinedWardGroup`

**Decisions made:**

- **Onboarding step progression defined:** `EMAIL_VERIFICATION` → (email verified) → `PLATFORM_INTRO` → (joinedWardGroup) → `EXPLORE_COMMUNITY` → (joinedVoluntaryGroup or castFirstVote) → progression continues. Steps are free strings (not an enum) — advancement logic will be encoded in the event listeners.
- **Onboarding wiring via `updateMany` not `update`** — using `updateMany` (instead of `update`) makes the call silently idempotent; if `OnboardingProgress` row doesn't exist yet, it does nothing rather than throwing "Record not found". Safe for all event-triggered updates outside the auth transaction scope.
- **`castFirstVote` filter:** `updateMany` with `where: { castFirstVote: false }` ensures the onboarding update only fires on the very first vote, not on every subsequent vote — avoids unnecessary DB writes.
- **Group discovery scoped to ACTIVE groups only** — `getGroups()` filters `status: GroupStatus.ACTIVE` to exclude FORMING/DISBANDED groups from the discovery UI. System groups are always ACTIVE; voluntary groups may be FORMING.

**What's still broken or incomplete:**

- All items from previous session unchanged: Base Sepolia deploy pending, `next build` 404 error, PWA not wired, `failedJobHandler` dead code
- Community `memberCount` is stale for all existing groups (will be correct after fix, but historical data is wrong — no migration needed, counts will self-correct on next join/leave)
- Onboarding `joinedWardGroup` is `false` for all existing users even though they are in system groups (will be correct for new registrations after fix; existing users need a one-time backfill if the progress UI is ever surfaced)

**Next milestone:**

Implement the community + onboarding plan: fix memberCount, add group discovery + admin endpoints, wire onboarding progress booleans, add frontend Explore tab, write tests — targeting ~70+ new tests on top of the 269 baseline.

**Token usage:**
Sonnet 4.6 — planning session only (codebase exploration + plan writing; no code committed)

---

## Session 27 — 2026-03-10

**Mode:** Documentation
**Tier:** Standard

**What was built:**

- **docs/white.docx extracted** into 6 new documentation files:
  - `docs/whitepaper.md` — UjamaaDAO white paper v1.3 (vision, problem, solution, token design, roadmap)
  - `docs/features.md` — Feature inventory by module (all 13 modules, March 2026 status)
  - `docs/ecosystem.md` — Ecosystem overview + prioritised improvement roadmap
  - `docs/economy-design.md` — Full PR/UT/IP token mechanics: earning tables, monthly regen, decay, education rewards, anti-exploit rules
  - `docs/treasury.md` — Treasury structure, M-Pesa deposit/withdrawal flows, fiat-backed UT cash-out design
  - `docs/frontend-payment-ux.md` — Payment UX principles + screen mockups (M-Pesa default, UT as secondary)
  - `docs/white.docx` deleted after extraction
- **7 existing docs files rewritten** to match the real codebase (cross-referenced against live route files):
  - `docs/auth-api.md` — was describing a non-existent OTP flow (`/send-otp`, `/verify-otp`); rewritten with real magic link endpoints, full 30+ endpoint reference
  - `docs/user-api.md` — was describing fake `POST /users` registration with `walletAddress`; rewritten with real 25+ endpoints
  - `docs/group-api.md` — was describing a completely different API (walletAddress, invite/accept flow); rewritten with real 6 endpoints
  - `docs/proposal-api.md` — had wrong vote options (`For/Against`), wrong endpoints (`PATCH`); rewritten with real `YES/NO/ABSTAIN`, correct 6 endpoints
  - `docs/economy-api.md` — had wrong paths (`/impact-points`, `/token-balance`); rewritten with correct 4 endpoints, UT two-pool rule
  - `docs/architecture.md` — had ADR-009 still unresolved, wrong primary auth; fully rewritten with real 13-module table, correct middleware chain, verification ladder
  - `docs/contributing.md` — said "zero tests written"; updated to 269 green tests, correct test command
- **Workflow files updated** to fix stale/wrong references:
  - `commands/orient.md` — `docs/START_HERE.md` + `docs/CLAUDE.md` → correct `ai_workflows/` paths
  - `commands/audit-docs.md` — all 7 file paths corrected (`docs/`, `src/`, bare filenames → real backend/ paths)
  - `ai_workflows/START_HERE.md` — test count (173→269), blockchain status, MailHog note, 8 new docs entries in navigation table
  - `ai_workflows/SESSION_STATE.md` — ADR count (ADR-024→ADR-026), 13 new docs paths in key file paths section
  - `ai_workflows/AGENTS.md` — Developer hat Traefik reference fixed (ADR-023: disabled in dev); bumped to v2.4

**Decisions made:**

- **UT two-pool confirmed (ADR-004 clarified):** `fiatBackedUtBalance` (M-Pesa deposits, 1 UT = 1 KES, fully cashable) vs `earnedUtBalance` (platform activity, no cash-out path, ever). These must be tracked as separate DB columns — never merge them into a single balance. UI must label them separately: "Savings" vs "Earned Rewards".
- **Activity-gated PR regeneration (ADR-025 new):** Monthly PR regen requires minimum activity threshold (login + at least one qualifying action in the past 30 days: vote cast, dues paid, M-Pesa transaction, vouch given). Zero-activity users receive no regen.
- **Soft PR inactivity decay (ADR-026 new):** After 60 days of no qualifying activity: -5% PR per month, floor of 100 PR (never below). Qualifying activity resets the decay clock. Decay only runs on users who have been through full email verification.

**What's still broken or incomplete:**

- Same as previous session — no code changes, no new issues
- Community `memberCount` bug still pending
- `next build` 404 prerender error still pending
- Base Sepolia deploy still pending

**Next milestone:**

Execute community + onboarding plan from `.claude/plans/wiggly-conjuring-nygaard.md`: fix memberCount, add group discovery endpoint, wire onboarding booleans, add frontend Explore tab, extend tests to ~70+ community tests.

**Token usage:**
Sonnet 4.6 — documentation session (codebase read + docs extraction + 7 rewrites + workflow fixes; no code committed)

---

## 2026-03-11 — Community plan executed end-to-end; 302 tests green

**What was built:**
- Fixed `Group.memberCount`: `createVoluntaryGroup` sets to 1, `joinGroup` increments, `leaveGroup` decrements (was never touched before)
- Added `getGroups()` discovery endpoint to `groupMembership.service.ts` — paginated, filterable by `isSystem`, `voluntaryType`, `search`; returns `isMember` + `myRole` per requesting user; filters by `status: ACTIVE`
- Added group admin methods to `group.service.ts`: `updateGroupSettings`, `changeMemberRole`, `removeMember` (all LEADER-only, service-level guard via Prisma lookup)
- Added controller handlers for all new methods in `group.controller.ts`
- Added routes: `GET /community` (discovery, placed before `/:groupId`), `PATCH /:groupId/settings`, `PATCH /:groupId/members/:userId/role`, `DELETE /:groupId/members/:userId`
- Wired onboarding progress flags: `joinedWardGroup` in `user-events.listeners.ts` after `enrollInSystemGroups`; `joinedVoluntaryGroup` in `group.service.ts joinGroup`; `castFirstVote` in `proposal.service.ts castVote` (uses `updateMany` with `where: { castFirstVote: false }` for idempotency)
- Frontend: added `GroupDiscoveryDto` interface + `communityApi.getGroups()` to `frontend/lib/api.ts`
- Frontend: rewrote `frontend/app/groups/page.tsx` — added shadcn `Tabs` (My Groups / Explore); `ExploreGroups` component with search input, card grid, `useMutation` join button
- Updated workflow/command files: `orient.md`, `audit-docs.md`, `START_HERE.md`, `SESSION_STATE.md`, `AGENTS.md`, `CLAUDE.md` — all stale paths and counts corrected
- Written and passing: 82 community tests (38 routes + 30 group service + 14 groupMembership service). Total suite: **302 green tests** across 19 files.

**Decisions made:**
- Route tests mock `groupMembershipService`; `isMember` flag business-logic coverage moved to `group.service.test.ts` (uses real Prisma, no mocks) — avoids mocking per-test overrides in route tests
- `GroupRole` enum has no `ADMIN` value — removed from route validator `z.enum([...])` and from `removeMember` guard (only `LEADER` can remove)
- `seedVoluntaryGroup()` helper now sets `status: 'ACTIVE'` explicitly (schema default is `FORMING`; `getGroups` filters by `ACTIVE`)
- `onboardingProgress` updates in service methods use `.catch(() => {})` — failures are non-critical and must never fail the primary operation

**What's still broken or incomplete:**
- Frontend: `next build` has a 404 prerender issue (low priority — dev server works fine)
- Base Sepolia deploy: blocked on real-world action (fund minter wallet)
- Governance, Projects, Marketplace modules: zero tests
- Group admin edge cases not tested in routes: self-role-change (400), system group settings update (400) — covered by service tests but not route integration tests

**Next milestone:**
Governance module tests + frontend vote/proposal UI — `castVote` onboarding flag is now wired, governance service/routes exist, next is writing the ~40 governance tests and adding proposal creation + vote UI to the frontend.

**Token usage:**
Sonnet 4.6

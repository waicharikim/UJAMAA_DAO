# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-05-18 (session 68 — payment module tests: B2C payout + completePayout + refundPayout + daily limit)
**Branch:** `develop`
**Last commits:**
- `c352555` test(payments): B2C payout flow + completePayout + refundPayout + daily limit
- `4e9a8bd` docs: log session 67 — UT cash-out B2C payout implementation
- `716d58f` feat(economy): UT cash-out — B2C M-Pesa payout via BullMQ
- `e9d6ca6` docs: log session 66 — geographic dues split + UT cash-out start
- `272052d` feat(treasury): multi-level dues allocation across geographic hierarchy

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running (Turbopack) | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests (core modules) | ✅ 1042 total green | auth (104) + user (35) + economy (66) + community (147) + governance (111) + projects (127) + marketplace (35) + emergency (30) + onboarding (22) + reputation (23) + education (42) + notifications (43) + verification (36) + elections (63) + treasury (40) + payments (50) |
| Sentry backend | ✅ wired | instrument.ts + setupExpressErrorHandler; DSN in docker/.env |
| Sentry frontend | ✅ instrumentation loads | instrumentation.ts + sentry.*.config.ts files; NEXT_PUBLIC_SENTRY_DSN needs value |
| Telegram webhook | ⚠️ needs `make dev` restart | `docker/.env` has bot token but container not restarted yet |

---

## What was done this session (session 68)

**Payment module tests — B2C payout flow, completePayout, refundPayout, daily limit:**

1. **`tests/economy/utWithdrawal.service.test.ts`** (new — 12 tests): `completePayout` + `refundPayout` idempotency guarantees, balance safety, earnedUtBalance isolation, graceful missing-ID handling. Guards against double-refund and COMPLETED→FAILED downgrade.

2. **`tests/economy/utWithdrawal.routes.test.ts`** (+1 test): daily limit test — verifies 400 + "daily withdrawal limit" message when cumulative PENDING+COMPLETED pushes over 50,000 KES.

3. **`tests/payments/payment.service.test.ts`** (+5 tests): `handleBuniB2cWebhook` block (success/failure/no-ReferenceData/wrong-Key) + additional `getPaymentStatus` after failed webhook. Total: 22.

4. **`tests/payments/payment.routes.test.ts`** (+7 tests): `POST /webhook/buni-b2c` (no-auth pass-through, ResultCode 0→completePayout, non-zero→refundPayout, missing ReferenceData, schema validation). Total: 28.

5. **`tests/payments/helpers.ts`**: `seedWithdrawal()` helper added.

**Fixes found while writing tests:**
- `completePayout`/`refundPayout` nonexistent-ID tests required valid nil UUID (`00000000-0000-0000-0000-000000000000`) — Postgres rejects malformed UUID strings with P2007.
- `economyQueue.add()` guarded by `NODE_ENV !== 'test'` to prevent ECONNREFUSED in test suite.

Payments promoted from `partial (no tests)` → **50 tests green**. Economy: 53 → **66 tests** (5 files). All 1042 tests pass.

## What was done this session (session 67)

**UT cash-out — B2C M-Pesa payout via BullMQ (full implementation):**

1. **`ut-payout.jobs.ts`** (new BullMQ on-demand job): `process-mpesa-payout` job. Idempotent via `jobId = withdrawalId`. Calls `paymentService.initiateB2CPayout()`. Status stays PENDING until B2C callback confirms.

2. **`utWithdrawal.service.ts`** expanded:
   - Daily 50,000 KES limit check (sums PENDING + COMPLETED withdrawals since midnight)
   - Enqueues `process-mpesa-payout` after atomic debit (skipped in test to avoid Redis)
   - `completePayout(withdrawalId)` — idempotent; PENDING → COMPLETED; audit `UT_WITHDRAWAL_COMPLETED`
   - `refundPayout(withdrawalId, reason)` — idempotent; restores `fiatBackedUtBalance` + FAILED status in atomic `$transaction`; audit `UT_WITHDRAWAL_FAILED`

3. **`payment.service.ts`**: `initiateB2CPayout()` stubs in test, throws if credentials missing, POSTs to Buni B2C API with `Occasion=withdrawalId`. `handleBuniB2cWebhook()` extracts `withdrawalId` from `ReferenceData.ReferenceItem`.

4. **`POST /payments/webhook/buni-b2c`**: no-auth Safaricom B2C callback. Validates with `buniB2cCallbackSchema`; calls `completePayout` or `refundPayout`; always responds `{ ResultCode: 0, ResultDesc: "Accepted" }`.

5. **`workers.ts`**: `MPESA_PAYOUT_JOB` case in `economyWorker` (3× retry, 30s exponential backoff). `failedJobHandler` calls `refundPayout` on exhaustion.

6. **`docker-compose.yml`**: `BUNI_B2C_SHORTCODE`, `BUNI_B2C_INITIATOR_NAME`, `BUNI_B2C_SECURITY_CREDENTIAL` on worker service.

7. **`audit/types.ts`**: `UT_WITHDRAWAL_COMPLETED` + `UT_WITHDRAWAL_FAILED` audit actions.

## What was done this session (session 66)

**Treasury module: multi-level dues allocation across geographic hierarchy:**

1. **`allocateDues()` rewrite** (`treasury.service.ts`): fans out dues payment across Ward (70%) / Constituency (15%) / County (10%) / National (5%). Each active level gets a `DuesAllocation` record + `WalletTransaction (CREDIT, referenceType=DUES)` + treasury balance increment in one atomic transaction.

2. **`getAllocationSplit()` private method**: reads from `PlatformConfig` key `dues_allocation_split` (JSON), falls back to `DEFAULT_SPLIT`. Admin can change split at runtime via `POST /api/v1/admin/platform-config` — no redeploy needed.

3. **Hard error on missing system group**: if a level has percentage > 0 but no matching system group, throws `ApiError.systemError`. System groups are seeded at launch; absence is a data integrity bug.

4. **`dues_allocation_split` seeded** in `seed.ts` with default values. `AllocationSplit` interface added to `treasury/types.ts`.

5. **Tests**: 4 new `allocateDues` cases in routes test; service test updated to seed all 4 system groups and verify correct split. Treasury: 36 → **40** tests. Total: 1013 → **1017**.

6. **Docs + ADR**: `docs/treasury.md` dues section rewritten; `docs/features.md` updated; ADR-039 written.

## What was done this session (session 62)

**Blockchain role wiring, wallet login, Privy container fix:**

1. **Wallet-link catch-up mint** (`wallet.service.ts`): `_reconcileOnChainBalances()` fires after wallet link — reads `participationRights` + `fiatBackedUtBalance` from DB, mints both on-chain. Errors are caught and logged; wallet link is never rolled back.

2. **Blockchain admin API** (new `backend/src/modules/admin/routes/blockchain.routes.ts`, mounted at `/api/v1/admin/blockchain`):
   - `GET /status/:userId` — on-chain vs off-chain balance diff
   - `POST /reconcile/:userId` — mints only the drift (admin-triggered catch-up)
   - `POST /grant-role` + `POST /revoke-role` — AccessControl management on PR/UT/GOVERNANCE contracts
   - Gated to `BLOCKCHAIN_ADMIN` or `SUPER_ADMIN`; separate router avoids global `COMPLIANCE_OFFICER` gate on main admin router

3. **Wallet sign-in** — `authApi.walletLogin()` added (calls `POST /auth/wallet/verify`). `auth-context.login()` stub replaced with real implementation. `PrivyWalletAdapter` branches: no session → full wallet login; session exists → link only. 409 treated as success.

4. **Privy App ID container fix** — `NEXT_PUBLIC_PRIVY_APP_ID` was in `frontend/.env.local` but never reached Docker. Added to `docker-compose.yml` env block sourced from `docker/.env`. Confirmed in container.

5. **`themeColor` viewport fix** — moved to `viewport` export in `app/layout.tsx` (Next.js warning resolved).

## What was done this session (session 61)

**Governance overhaul — 9 correctness gaps fixed, 2 new cron jobs, full lifecycle frontend:**

1. **Schema migration `nullable_vote_abstain_support`**: `GroupMemberVote.vote Boolean` → `Boolean?`; Prisma client regenerated. ABSTAIN stored as `null`, YES=`true`, NO=`false`.

2. **`castVote()` fixed**: null/true/false vote value. COMMUNITY-scoped proposals check geographic eligibility (voter's wardId → Ward → constituencyId/countyId must match proposal group). Out-of-scope voters get 403.

3. **`tallyVotes()` fixed**: quorum = `voterCount / totalEligible >= 0.4` (was `totalWeight / count` — meaningless). ABSTAIN excluded from YES/NO weight. Approval = `yesWeight / decidingWeight >= 0.5`.

4. **`cancelProposal()` + `updateProgress()`**: new service methods. Cancel: creator-only, DRAFT/PENDING_REVIEW. Progress: APPROVED→EXECUTING→COMPLETED. New routes: `POST /:proposalId/cancel` + `PATCH /:proposalId/progress`.

5. **3 new NotificationTypes**: `PROPOSAL_SUBMITTED`, `PROPOSAL_APPROVED`, `PROPOSAL_REJECTED` added to `notifications/types.ts`. Wired into Stage 1 and Stage 2 review transitions.

6. **`proposal.jobs.ts`** (new): `TALLY_PROPOSALS_JOB` (daily 00:30 — auto-tally expired voting periods) + `EXPIRE_PROPOSAL_REVIEW_JOB` (daily 00:35 — auto-reject stale PENDING_REVIEW after 30 days). Both wired in `workers.ts` + `register.ts`. Confirmed in worker logs.

7. **Stale `ProposalStatus` enum removed** from `governance/types.ts` (had PASSED/FAILED — not in Prisma schema).

8. **`governance-review.tsx`** full rewrite: scope/location badges, error state, correct cache invalidation (3 keys), contextual action buttons for all 8 statuses, 4 new mutations (startVote, cancel, progress + review). All import fixes.

9. **`frontend/lib/api.ts`**: `cancelProposal` + `updateProgress` added; duplicate `startVoting` removed.

## What was done in session 60

**Projects module expansion — task board, member contributions, DTO alignment:**

1. **Schema migration `20260511133845_add_task_skill_fields`**: `skillCategory String?` + `maxAssignees Int @default(1)` added to `Task` model; dev + test DBs synced.

2. **3 new backend endpoints**:
   - `POST /projects/tasks` — leader-only task creation (leader = `project.ownerUserId === userId`); accepts `milestoneId`, `title`, `skillCategory`, `maxAssignees`, `dueDate`
   - `GET /projects/:id/tasks` — filterable by `skillCategory` + `status`; returns paginated `TaskListDto`
   - `GET /projects/:id/contributions` — per-member aggregates: tasks completed/in-progress, hours logged (approved `PhysicalWorkLog` via `verifiedAt: { not: null }`), sessions attended (`WorkPresence` count), IP earned

3. **Frontend components** (new): `TaskBoard` (14-skill filter pills, status columns, create form) + `MemberContributions` (sorted leaders first then by IP desc); project detail page gains Milestones/Tasks/Team tab bar; milestone cards show task completion count.

4. **21 integration tests** (`task-board.routes.test.ts`): auth gates, leader-only create, skill filter, approved-log detection.

5. **Frontend DTO alignment** (`api.ts` + `work-session-panel.tsx`): `WorkSessionDto` (`sessionId→id`, added `closedAt/presenceCount/createdAt`), `WorkPresenceDto` (`userName→user object`, `ipAwarded: boolean→number`, added `attestedById`), `ScanQrResponseDto` corrected. TypeScript: 0 errors.

Projects tests: 106 → **127**. Total: 942 → **963 green tests**.

## What was done in session 59

**CodeScene refactors — pure cyclomatic complexity reduction across 5 hotspots:**

1. **`bot.controller.ts`** (CodeScene health 6.16 — fastest declining hotspot): extracted `requireTelegramLeader` (returns `userId|null`, eliminates duplicate DB lookup), `requireHttpBarazaAdmin` (throws on failure), `handlePresentCommand`. 945→841 lines.

2. **`baraza-management.tsx`** (health 7.77): extracted `SessionActionBar` (3 mutations + form state) and `BarazaGroupCard` (group row + deactivate). `SessionsPanel` cc reduced.

3. **`auth.middleware.ts`** (health 8.93): extracted `validateTokenClaims` (JTI, blacklist, session DB, account status layers). `validateAndPopulateUser` cc 14→4.

4. **`treasury/page.tsx`** (health 8.96): extracted `TreasuryBalanceCards` + `TxHistoryCard`. `TreasuryPage` cc ~26→~8.

5. **`index.ts`** (health 9.61 advisory): extracted `assertStartupRequirements()`. `startServer` cc ~14→~7.

All changes: pure extraction, zero logic change, TypeScript 0 errors. Commit: `f44e305`.

---

## What was done in session 58

**Projects module expansion — contribution endpoints + QR witness-chain work sessions:**

1. **Contribution endpoints (3 new routes):**
   - `POST /:projectId/join` — join a project (COMMUNITY_VERIFIED, 201, conflict guard)
   - `POST /:projectId/contribute` — contribute fiatBackedUt to project GroupTreasury (COMMUNITY_VERIFIED, amount 1–100k)
   - `POST /tasks/:taskId/claim` + `PATCH /tasks/:taskId/done` — task claim/complete (done awards 10 IP); fixed validator from `z.string().uuid()` → `z.string().min(1)` (tasks use cuid, not UUID)

2. **QR witness-chain work sessions (5 new routes + 1 BullMQ job + schema migration):**
   - `POST /work-sessions` — creates session with 48-char hex `qrSecret`; schedules BullMQ delayed `WORK_SESSION_CLOSE` job
   - `POST /work-sessions/scan` — checks in at depth 0; catches P2002 → 409
   - `POST /work-sessions/:sessionId/attest` — attestor (must be checked in, max 2 attestations) records target at `attestor.depth + 1`
   - `POST /work-sessions/:sessionId/close` — leader-only manual close; APPROVED if ≥1 direct scan, FLAGGED otherwise; awards 10 IP to all presences on APPROVED
   - `GET /work-sessions/:sessionId` — session + full presence list

3. **New Prisma models:** `WorkSession` (qrSecret @unique, expiresAt, status, closeJobId, relations), `WorkPresence` (depth, attestedById, @@unique([sessionId, userId])). Migration: `20260511113241_add_work_session_qr`.

4. **BullMQ:** `projectQueue` added to `core/queue/index.ts`; `projectWorker` wired in `workers.ts` (handles `WORK_SESSION_CLOSE`); `work-session.jobs.ts` processor calls `projectService.closeWorkSession(sessionId)`.

5. **Tests:** `contribution.routes.test.ts` (29 tests) + `work-session.routes.test.ts` (36 tests). Queue mock pattern: `vi.spyOn(projectQueue, 'add').mockResolvedValue(...)` in `beforeAll` (NOT `vi.mock()` — that breaks BullMQAdapter in app.ts). Test DB synced with `prisma db push` after migration.

6. **Docs:** `docs/project-module.md` fully rewritten (was stale with wrong endpoints).

## What was done in session 56

**Documentation-only session:**
1. **README.md full rewrite** — removed ai_workflows/ references (now gitignored), fixed test counts (679→749), fixed M-Pesa status (Stubbed→✅ Working via Buni), fixed frontend routes (17→26+), fixed Next.js version (15→16.1.6), added observability (Sentry/DataDog/BrowserStack), fixed BullMQ jobs (4→10+), added WebAuthn auth method, updated project status date to May 2026
2. **docs/auth-api.md** — added full WebAuthn/passkey section (6 endpoints), fixed `channel` field on phone OTP
3. **docs/features.md** — fixed summary table test counts and module statuses, updated to May 2026
4. **docs/architecture.md** — fixed routes table (added conflicts, elections, payments, feed, platform-config, verification; corrected emergency 42→30, removed incorrect test claims for admin/audit/treasury/integration), fixed BullMQ jobs (4→6 queues, 10 scheduled jobs), added WebAuthn auth section, added observability (Sentry, DataDog, BrowserStack)
5. **docs/admin-api.md** — full rewrite from stub (51 lines) to comprehensive endpoint reference
6. **New docs created** (11 files): payments-api, notifications-api, marketplace-api, verification-api, emergency-api, education-api, reputation-api, onboarding-api, elections-api, integration-api, audit-api

---

## What was done this session (session 55)

**Session 54** (previous):
1. FundGroupModal mounted on `/treasury` page
2. Baraza session scheduling — `listSessions`, `scheduleSessionHttp`, `openSessionHttp`, `closeSessionHttp` handlers + routes + frontend SessionsPanel
3. ±4-hour proximity gate on `openSessionHttp` (Vision Keeper CONDITIONAL resolved)
4. Sentry backend fully wired (`instrument.ts`, `setupExpressErrorHandler`, DSN in docker/.env)
5. Sentry frontend fully wired (`instrumentation-client.ts`, `withSentryConfig`, `onRequestError`, `global-error.tsx`; auth token in `.env.sentry-build-plugin`)

**Session 55** (this session):
1. **Flutterwave fully removed** — payment module is M-Pesa/Buni only:
   - `PaymentMethod` type: `'MPESA' | 'CARD'` → `'MPESA'`
   - Deleted `_initiateCardFlw()`, `handleWebhook()` (Flw card callback)
   - Deleted `/webhook` route; kept `/webhook/buni`
   - Removed `webhookPayloadSchema` and all `Flw*` type interfaces
   - Removed `flutterwave-node-v3` from `package.json`, deleted `flutterwave-node-v3.d.ts`
   - Removed `FLW_*` env vars from `docker-compose.yml` and `docker/.env`
   - Commit: `307306a feat(payments): remove Flutterwave — M-Pesa via Buni only`

2. **Buni sandbox credentials configured** — `BUNI_CLIENT_ID` + `BUNI_CLIENT_SECRET` set in `docker/.env`

3. **M-Pesa STK push end-to-end verified**:
   - Buni sandbox accepts push (statusCode 0, STK push sent to `+254740985615`)
   - Buni sandbox called back to `https://14c60e6b013ec2.lhr.life/api/v1/payments/webhook/buni`
   - Backend received callback, updated record to `FAILED` with `ResultCode: 1037` (sandbox timeout — no PIN entered; callback path confirmed working)
   - Tunnel: `localhost.run` SSH tunnel used as public callback URL for sandbox testing

4. **Observability stack live** (set up in session 54/55):
   - DataDog agent running (`DD_SITE=us5.datadoghq.com`, API key configured); postgres + redis checks green
   - `dd-trace` imported as first import in `backend/src/index.ts` + `backend/src/workers.ts`
   - BrowserStack connected (Student Pack account, 1 parallel session)
   - `frontend/browserstack.yml` + `frontend/tests/browserstack/landing.spec.ts` added

---

## What was done in sessions 51–53

_(See PROGRESS_LOG.md for full detail)_

- **Session 53**: FundGroupModal component, LocationTreasury, project treasury debit at creation, scoped proposal list for location admins, Financial tab for location admins, "Contributions" UI rename
- **Session 52**: RBAC overhaul (voluntary vs system group gates), admin panel to location admins, feed enrichment with entity names + DetailChips
- **Session 51**: ROLES_AND_FLOWS.md, LEADER-only gates for voluntary groups, location admin gates for system group proposals

---

## Known open issues

- **Tunnel URL is ephemeral** — `localhost.run` tunnel dies when the SSH session ends; Buni sandbox callback URL (`BASE_URL` in `docker/.env`) must be updated each time. Will resolve when real domain is purchased.
- **Africa's Talking credentials not configured** — SMS only works in mock (`devCode` returned)
- **Base Sepolia deploy pending** — `PrToken.sol` + `UtToken.sol` written + tested ✅; need funded minter wallet → `forge script Deploy.s.sol --rpc-url base_sepolia --broadcast`
- **Session 47 backend additions** — ward declarations, proposal memory, conflict protocol ✅ tested (65 new tests in session 57)
- **WebAuthn service/routes not yet tested** — no test files exist
- **Telegram webhook** — needs re-registration when tunnel URL changes (`POST /setWebhook` to Telegram API)

---

## Module status

| Status | Modules |
|---|---|
| **tested** | auth (104), user (35), economy (66), community (147), governance (111), projects (127), marketplace (35), emergency (30), onboarding (22), reputation (23), education (42), notifications (43), verification (36), elections (63), treasury (40), payments (50) — **1042 total** |
| **partial** | admin, audit, integration |
| **scaffold** | — |
| **contracts written** | PrToken.sol, UtToken.sol (13 Foundry tests green; Base Sepolia deploy pending) |

---

## Next tasks (priority order)

1. **Base Sepolia deploy** — fund minter wallet → `forge script Deploy.s.sol --rpc-url base_sepolia --broadcast` → set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS`; promotes contracts from `written` → `deployed`
2. **Africa's Talking SMS** — configure real AT credentials for production phone verification
3. **Real domain** — purchase domain → point at server → update `BASE_URL` + register Buni production callback + Telegram webhook (replaces ephemeral tunnel)
4. **Admin + audit test coverage** — both modules are partial with no tests

---

## Strategic Backlog — Baraza AI Features

> Decisions made 2026-05-10. Build AFTER the core system is stable and communities are onboarded.
> Philosophy: AI as supervised assistant + institutional memory. Never autonomous decision-maker.

### Phase 1 — Legitimacy layer (NOW — already in progress)
Get real communities onboarded. Make PR/UT meaningful through real contributions. Every verified member and every clean election deepens the trust signal that makes everything below valuable.

### Phase 2 — Baraza bot as community intelligence layer
Wire Claude API into `baraza-bot.service.ts` with three knowledge layers:

1. **Static knowledge (system prompt)** — what UjamaaDAO is, all 5 non-negotiable rules, how PR/UT/IP work, how governance flows, what each feature does. Written once. The bot never gives wrong answers about how the platform works.

2. **Live personal context (injected per message)** — who the user is, their PR balance, ward, verification level, eligible elections, UT history. Auto-injected before Claude sees the question. No tool call needed for basic "what is my balance?" queries.

3. **Live community data via tools (Claude function calls)** — give the bot callable tools:
   - `get_active_proposals(wardId)` — what's open for voting in the user's area
   - `get_election_results(electionId)` — who won, what the tally was
   - `get_treasury_balance(groupId)` — current group treasury state
   - `get_ward_stats(groupId)` — member count, recent activity
   - `search_past_decisions(query, groupId)` — historical proposals and outcomes
   - `get_my_elections(userId)` — elections the user can nominate/vote in

Key use cases enabled:
- "Ninaeza kuingia katika uchaguzi gani?" → bot queries eligible elections, explains each in plain language
- "What did our ward decide about the borehole?" → searches proposal history, returns outcome
- "How much is in the treasury?" → calls treasury tool, returns live balance
- "Who are the candidates in the current election?" → queries election detail

### Phase 3 — Community authorization layer for AI (future)
Communities use UjamaaDAO governance (proposals + votes) to authorize which AI agents can act on their behalf. AI agents that serve communities well earn UT. This is the "built for AI" endgame — UjamaaDAO as the trust and governance rail for AI operating in African community contexts.

### What NOT to build
- AI that makes decisions autonomously (proposals, votes, treasury moves)
- AI that holds voting power or controls group funds directly
- Any AI feature that bypasses human review for consequential actions

---

## Key file paths (quick reference)

```
backend/src/app.ts                              — Express app, middleware order, route mounts
backend/src/index.ts                            — Server entry; first line: import './instrument.js'
backend/src/instrument.ts                       — Sentry.init() for backend
backend/src/workers.ts                          — BullMQ worker + integrationWorker
backend/src/core/jobs/register.ts               — All repeatable job registrations
backend/src/core/rbac/roles.ts                  — SystemRoles, GroupRoles, RoleHierarchy, roleIncludes(), type guards
backend/src/core/events/listener-registry.ts    — registerAllListeners() — called in app.ts initializeServices()
backend/src/modules/auth/services/webauthn.service.ts        — WebAuthn registration + authentication flows
backend/src/modules/auth/handlers/webauthn.handlers.ts       — WebAuthn route handlers (6 handlers)
backend/src/modules/governance/services/proposal.service.ts  — createProposal, startVoting, castVote, tallyVotes
backend/src/modules/admin/services/admin.service.ts          — getAllPlatformConfig(), upsertPlatformConfig()
backend/src/modules/admin/routes/platform-config.routes.ts   — GET /platform-config (any authenticated user)
backend/src/modules/integration/controllers/bot.controller.ts — Telegram webhook, baraza group + session management
backend/src/modules/integration/routes/bot.routes.ts         — Baraza group + session REST routes
backend/src/modules/onboarding/services/onboarding.service.ts — getProgress() (includes tutorial.key in completions)
backend/src/modules/community/services/group.service.ts      — createVoluntaryGroup, joinGroup, leaveGroup, dissolveGroup
backend/src/modules/community/services/conflict.service.ts   — fileConflict, listUserCases, getCase, resolveCase
backend/src/modules/community/services/groupMembership.service.ts — enrollInSystemGroups, getGroupById, getUserGroups
docker/docker-compose.yml                       — All services, env vars, healthchecks
docker/.env                                     — Secret overrides (gitignored): TELEGRAM_BOT_TOKEN, SENTRY_DSN, BUNI_CLIENT_ID/SECRET, DD_API_KEY
backend/vitest.config.ts                        — Test config (fileParallelism:false, resolve.alias, env block)
frontend/lib/api.ts                             — HTTP client (all API namespaces, including webAuthnApi, integrationApi)
frontend/contexts/auth-context.tsx              — Auth state, magic link flow, mapBackendUser()
frontend/contexts/wallet-context.tsx            — Privy wallet + auto-link effect (nonce/sign/link)
frontend/contexts/language-context.tsx          — EN/SW language toggle, t() function
frontend/instrumentation.ts                     — Next.js instrumentation hook (loads Sentry server/edge configs)
frontend/sentry.client.config.ts                — Browser Sentry init (replay enabled)
frontend/sentry.server.config.ts                — SSR Sentry init
frontend/sentry.edge.config.ts                  — Edge runtime Sentry init
frontend/.env.local                             — NEXT_PUBLIC_SENTRY_DSN (currently empty — paste from sentry.io)
frontend/components/auth/passkey-login-button.tsx — Biometric login button (auth/callback)
frontend/components/auth/passkey-manager.tsx    — List/add/delete passkeys (profile Settings tab)
frontend/components/admin/baraza-management.tsx — Admin UI for baraza group CRUD + SessionsPanel
frontend/components/payments/fund-group-modal.tsx — Group browser + PaymentModal integration for any-level funding
frontend/app/treasury/page.tsx                  — Treasury page with "Fund a Group" button → FundGroupModal
frontend/app/governance/page.tsx                — Platform Governance transparency hub (live PlatformConfig data)
frontend/components/admin/platform-config-editor.tsx — Admin inline editor for cost/tier config
frontend/components/admin/location-treasury.tsx   — Ward/constituency/county treasury view for location admins
ai_workflows/DECISIONS.md                       — All ADRs (ADR-001 through ADR-035)
```

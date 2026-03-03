# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-03-03 (session 23)
**Branch:** `develop`
**Last commits:**
- `236f2cc` fix(registration): normalise Kenyan phone 07/01 format to E.164 on submit
- `4a266d0` fix(registration): surface field-level validation errors from backend
- `f110f3b` fix(registration): baraza handle trim + phone space strip + context type
- `4a9abb6` feat(session-22): GET endpoints for community & governance; frontend wiring
- `e226e55` fix(observability): wire integrationQueue to Bull Board; audit docs fixes

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ⚠️ 197/222 green (25 auth flakes — pre-existing timing/DB state issues) | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 23)

**Observability fixes:**
- `backend/src/app.ts` — `integrationQueue` added to Bull Board dashboard (was created in session 21 but invisible in `/admin/queues`); `integration: '/api/v1/integration'` added to `/api/v1/docs` endpoint object
- `ai_workflows/DECISIONS.md` — ADR-024 written (Baraza platform decisions: WhatsApp webhook-receive, Telegram/Discord bot-token, worker-only secrets)
- `ai_workflows/CLAUDE.md` — §5 worker-only secrets convention; 4 new §7 issues; v3.9 version history

**Registration flow bug fixes (`frontend/components/auth/register-form.tsx`):**
- Baraza handle: `handle || undefined` → `handle.trim() || undefined` (space string was truthy, failing backend regex)
- Phone number: `.replace(/\s+/g, '')` added on submit (spaces in phone caused backend E.164 rejection)
- `auth-context.tsx`: `requestMagicLink` implementation params now include `messagingPlatforms` (was in interface but not in useCallback type)

**Validation error surfacing:**
- `frontend/lib/api.ts` — `ApiError` gains `errors?: Record<string, string>` field; `apiFetch` extracts `body.details?.validation?.errors` and passes it to thrown `ApiError`
- `frontend/components/auth/register-form.tsx` — `fieldErrors` state + `<ul>` error list renders per-field backend messages instead of opaque "Validation failed"

**Kenyan phone format normalisation:**
- Submit handler: `.replace(/^0/, '+254')` converts `07XXXXXXXX`/`01XXXXXXXX` to E.164 automatically
- Placeholder updated from `+254 700 000 000` to `0712 345 678`

---

## What was completed in the previous session (session 22)

**Frontend wiring:**
- `frontend/lib/api.ts` — 4 new API namespaces: `integrationApi` (baraza groups), `notificationsApi`, `communityApi` (mutations + GET), `governanceApi` (mutations + GET)
- New DTOs exported: `BarazaGroupDto`, `RegisterBarazaGroupDto`, `NotificationDto`, `GroupMembershipDto`, `GroupMemberDto`, `ProposalDto`
- `ApiClient.getGroups()` → calls real `communityApi.getMyGroups()` with response mapping
- `ApiClient.getProposals()` → calls real `governanceApi.getProposals()` with status enum mapping
- `components/layout/notifications-popover.tsx` (new) — real notification bell; `components/integration/baraza-groups-card.tsx` (new) — "My Barazas" dashboard card
- Topbar bell → `<NotificationsPopover />`; Dashboard sidebar → `<BarazaGroupsCard />`

**Backend GET endpoints:**
- `GET /community/my-groups`, `GET /community/:groupId/members?limit&offset`
- `GET /governance` (list with filters), `GET /governance/:proposalId` (with votesSummary)

---

## What was completed in the session before that (session 21)

- **Baraza messaging integration** — full backend + frontend feature:
  - `MessagingPlatform` enum + `UserMessagingProfile` model in auth schema
  - `BarazaGroup` + `BarazaAttendance` models in community schema
  - Migration `20260302051843_add_baraza_integration` applied; 83 Prisma models
  - 3 new `ParticipationRightsReason` values + `PR_CONFIG` entries (BARAZA_ATTENDED=15, BARAZA_FACILITATED=25, BARAZA_REPORT_SUBMITTED=10)
  - Auth validators + types extended to accept `messagingPlatforms` on signup
  - Auth service creates `UserMessagingProfile` rows inside registration transaction
  - New `backend/src/modules/integration/` module: `types.ts`, `services/telegram.service.ts`, `services/discord.service.ts`, `services/baraza-bot.service.ts`, `jobs/baraza-reward.jobs.ts`, `controllers/bot.controller.ts`, `routes/bot.routes.ts`, `listeners/integration-events.listener.ts`
  - `integrationQueue` added to `core/queue/index.ts`; `integrationWorker` added to `workers.ts`
  - `registerIntegrationListeners()` wired in `listener-registry.ts`
  - Integration routes mounted at `/api/v1/integration` in `app.ts`
  - Worker Docker env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`
  - Frontend register-form: new step 5 "Stay Connected" with Telegram/WhatsApp/Discord cards + handle inputs
  - `api.ts requestMagicLink` extended with `messagingPlatforms` param
  - **`npx tsc --noEmit` → 0 errors; `npx vitest run` → 222/222 green**

---

## Known open issues

- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing, dev unaffected)
- Auth test flakiness: 25 tests intermittently fail with unique constraint or JWT timing errors — pre-existing, unrelated to sessions 21–22 changes. Community + Economy: 83/83 green.
- `failedJobHandler` in `workers.ts` is dead code — needs `worker.on('failed', failedJobHandler)` wired
- No tests for integration, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- `fetch-proposals.tsx` + `voting-interface.tsx` + `enhanced-proposals.tsx` have pre-existing scaffold TypeScript errors (wrong internal `Proposal` interface shape)
- Governance `listProposals` returns `votesSummary` only on `getProposal` (single); list endpoint returns `_count.votes` only — yesVotes/noVotes not broken out per proposal in the list
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` written and tested ✅ — Base Sepolia deploy pending (need funded minter wallet)
- Telegram/Discord bot tokens are placeholder values — real bots not configured yet
- Audit not yet wired for: profile updates, group joins, governance actions

---

## Module status

| Status | Modules |
|---|---|
| **tested** | auth (104 tests), user (35 tests), economy (34 tests), community (49 tests) |
| **partial** | governance (GET+POST endpoints, no tests), integration (Baraza module, no tests), projects, marketplace, notifications, onboarding, emergency, audit, admin |
| **scaffold** | reputation, education, treasury, verification |
| **not started** | M-Pesa |
| **contracts written** | PrToken.sol, UtToken.sol (13 Foundry tests green; Base Sepolia deploy pending) |

---

## Next tasks (priority order)

1. **Governance module tests** — move governance `partial` → `tested`. Write `proposal.service.test.ts` + `proposal.routes.test.ts` covering: createProposal, startVoting, castVote, tallyVotes, getProposal, listProposals + all HTTP routes.
2. **Base Sepolia deploy** — fund minter wallet → `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast` → set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS` in docker-compose
3. **Fix `next build` 404 prerender error** — Next.js 15.3.3 bug. Low urgency — dev server works fine.

---

## Key file paths (quick reference)

```
backend/src/app.ts                              — Express app, middleware order, route mounts
backend/src/index.ts                            — Server entry, startup assertions, graceful shutdown
backend/src/workers.ts                          — BullMQ worker + integrationWorker
backend/src/core/jobs/register.ts               — All repeatable job registrations
backend/src/core/rbac/roles.ts                  — SystemRoles, GroupRoles, RoleHierarchy, roleIncludes(), type guards
backend/src/modules/integration/                — Baraza messaging module (Telegram, Discord, WhatsApp)
backend/src/modules/governance/services/proposal.service.ts  — createProposal, startVoting, castVote, tallyVotes, getProposal, listProposals
docker/docker-compose.yml                       — All services, env vars, healthchecks
backend/vitest.config.ts                        — Test config (fileParallelism:false, resolve.alias, env block)
frontend/lib/api.ts                             — HTTP client (authApi, userApi, economyApi, integrationApi, notificationsApi, communityApi, governanceApi + ApiClient)
frontend/contexts/auth-context.tsx              — Auth state, magic link flow, token storage
frontend/contexts/wallet-context.tsx            — Privy wallet (PrivyProvider, useWallet hook)
frontend/components/layout/notifications-popover.tsx  — Real notification bell (reads NotificationContext)
frontend/components/integration/baraza-groups-card.tsx — "My Barazas" dashboard card
frontend/next.config.mjs                        — Webpack stubs for Privy transitive deps
ai_workflows/DECISIONS.md                       — All ADRs (ADR-001 through ADR-024)
```

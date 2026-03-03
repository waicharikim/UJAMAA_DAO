# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-03-03 (session 24)
**Branch:** `develop`
**Last commits:**
- `3d034cc` feat(community): group detail page + signup button in topbar
- `8e807c4` feat(dashboard): show system group memberships after registration
- `f502869` chore(frontend): upgrade Next.js 15.3.3 → 16.1.6, ESLint 8 → 9
- `a9eff07` fix(frontend): turbopack resolveAlias needs relative paths not absolute
- `53b6ae6` perf(frontend): enable Turbopack for next dev; add resolveAlias stubs

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running (Turbopack) | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ⚠️ 197/222 green (25 auth flakes — pre-existing timing/DB state issues) | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 24)

**Frontend dev performance:**
- Turbopack enabled: `package.json` `dev` script → `next dev --turbopack`
- `next.config.mjs` gains `turbopack.resolveAlias` with relative paths (`'./stubs/empty.js'`) for `unstorage`, `x402/client`, `@base-org/account` — fixes 500 errors that appeared when Turbopack tried to resolve the Privy transitive deps
- Webpack config retained unchanged for `next build`

**Next.js upgrade:**
- `next` 15.3.3 → 16.1.6, `eslint-config-next` 14.0.3 → 16.1.6, `eslint` ^8 → ^9
- Docker node_modules volume purged (`docker volume prune -f`) and rebuilt via `docker compose up --build`
- `tsconfig.json` auto-patched by Next.js 16 (`jsx: preserve` → `react-jsx`)

**System groups dashboard card:**
- `components/community/system-groups-card.tsx` — each community row now wraps a `<Link href="/groups/[groupId]">` with hover highlight. Previously displayed-only.

**Group detail page (backend):**
- `groupMembership.service.ts` — new `getGroupById(groupId, userId)` method returning `GroupDetailDto`-shaped object with ward/constituency/county relations + user membership role
- `group.controller.ts` — new `getGroupDetail` static method
- `group.routes.ts` — `GET /:groupId` route (placed after `/my-groups`, before `/:groupId/members`)

**Group detail page (frontend):**
- `frontend/lib/api.ts` — `GroupDetailDto` interface exported; `communityApi.getGroupDetail(groupId)` added; `apiClient.getGroup()` wired from `return null` stub to real API
- `components/groups/group-detail.tsx` — full rewrite: level icon (NATIONAL/COUNTY/CONSTITUENCY/WARD), location breadcrumb, member count, created date, user role + joined date, description; join/leave `useMutation` for voluntary groups (invalidates group + system-groups + groups queries)
- `components/groups/group-members.tsx` — full rewrite: uses `GroupMemberDto` fields directly (`userId`/`userName`/`avatarUrl`/`verificationLevel`/`role`/`joinedAt`); verification shield icon; role badges in Chai palette

**Topbar signup button:**
- `components/layout/topbar.tsx` — `useAuth().isAuthenticated` guards actions: authenticated → notifications + wallet; unauthenticated → "Get Started" (→ `/auth/register`) + "Sign In" (→ `/auth/callback`)

---

## What was completed in the previous session (session 23)

**Observability fixes:**
- `backend/src/app.ts` — `integrationQueue` added to Bull Board dashboard (was invisible); `integration: '/api/v1/integration'` added to `/api/v1/docs` endpoint object
- `ai_workflows/DECISIONS.md` — ADR-024 written (Baraza platform decisions)
- `ai_workflows/CLAUDE.md` — §5 worker-only secrets convention; 4 new §7 issues; v3.9 version history

**Registration flow bug fixes (`frontend/components/auth/register-form.tsx`):**
- Baraza handle: `handle || undefined` → `handle.trim() || undefined`
- Phone number: `.replace(/\s+/g, '')` added on submit
- `auth-context.tsx`: `requestMagicLink` implementation params now include `messagingPlatforms`

**Validation error surfacing:**
- `ApiError` gains `errors?: Record<string, string>` field; `apiFetch` extracts `body.details?.validation?.errors`
- `register-form.tsx` — `fieldErrors` state + `<ul>` renders per-field backend messages

**Kenyan phone format normalisation:**
- `.replace(/^0/, '+254')` converts `07XXXXXXXX`/`01XXXXXXXX` to E.164 on submit
- Placeholder updated to `0712 345 678`

---

## Known open issues

- `next build` fails at `/404` static generation — pre-existing bug (unrelated to Next.js upgrade)
- Auth test flakiness: 25 tests intermittently fail — pre-existing, unrelated to recent changes. Community + Economy: 83/83 green.
- `failedJobHandler` in `workers.ts` is dead code — needs `worker.on('failed', failedJobHandler)` wired
- No tests for integration, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin
- `fetch-proposals.tsx` + `voting-interface.tsx` + `enhanced-proposals.tsx` have pre-existing scaffold TypeScript errors (wrong internal `Proposal` interface shape)
- Governance `listProposals` returns `_count.votes` only — yesWeight/noWeight not broken out per proposal in list endpoint
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` written and tested ✅ — Base Sepolia deploy pending (need funded minter wallet)
- Telegram/Discord bot tokens are placeholder values — real bots not configured yet
- Audit not yet wired for: profile updates, group joins, governance actions
- Groups page (`app/groups/page.tsx`) stats are still hardcoded placeholder values

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
3. **Fix `next build` 404 prerender error** — Next.js 16 upgrade did not resolve this. Low urgency — dev server works fine.

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
backend/src/modules/community/services/groupMembership.service.ts — enrollInSystemGroups, getGroupById, getUserGroups, getGroupMembers
docker/docker-compose.yml                       — All services, env vars, healthchecks
backend/vitest.config.ts                        — Test config (fileParallelism:false, resolve.alias, env block)
frontend/lib/api.ts                             — HTTP client (authApi, userApi, economyApi, integrationApi, notificationsApi, communityApi, governanceApi + ApiClient)
frontend/contexts/auth-context.tsx              — Auth state, magic link flow, token storage
frontend/contexts/wallet-context.tsx            — Privy wallet (PrivyProvider, useWallet hook)
frontend/components/layout/notifications-popover.tsx  — Real notification bell (reads NotificationContext)
frontend/components/integration/baraza-groups-card.tsx — "My Barazas" dashboard card
frontend/components/community/system-groups-card.tsx  — "My Communities" dashboard card (links to /groups/[id])
frontend/components/groups/group-detail.tsx     — Group detail with real GroupDetailDto, join/leave mutation
frontend/components/groups/group-members.tsx    — Group members with real GroupMemberDto
frontend/next.config.mjs                        — Turbopack resolveAlias stubs + webpack stubs for Privy deps
ai_workflows/DECISIONS.md                       — All ADRs (ADR-001 through ADR-024)
```

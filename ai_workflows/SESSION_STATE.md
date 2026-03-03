# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-03-03 (session 25)
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
| Tests | ✅ 269/269 green | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 25)

**Enrollment race condition fix:**
- `groupMembership.service.ts` — `ensureSystemGroupAndEnroll` + `ensureNationalGroupAndEnroll` both replaced `findFirst → create` with atomic `upsert` on `Group.name`. Two simultaneous registrations were both inserting the same system group name → unique constraint violation. Upsert serialises via PostgreSQL `INSERT ... ON CONFLICT DO UPDATE`.

**UT token balance:**
- `frontend/lib/types.ts` — `utBalance: number` added to `User` type
- `frontend/contexts/auth-context.tsx` — `mapBackendUser()` maps `raw.economic?.utilityTokens ?? raw.utilityTokens ?? 0`

**Desktop topbar token chips:**
- `components/layout/topbar.tsx` — `TokenChip` component + `hidden md:flex` strip showing PR/IP/UT between page title and action buttons (auth-gated)

**Dashboard real data:**
- `dashboard-content.tsx` — proposals count, community count, notifications (real activity) all wired via `useQuery`. Mobile token bar (`md:hidden`) below greeting.

**Groups page real stats:**
- `app/groups/page.tsx` — fake 1s delay + hardcoded stats replaced with `useQuery(communityApi.getMyGroups)`. 4 stats: My Groups, Admin Roles, System Groups, Voluntary.

**Proposals page real stats:**
- `app/proposals/page.tsx` — 4 hardcoded stats replaced with 2 real counts (Active = VOTING status, Total = all).

**User profile UT chip:**
- `user-profile.tsx` — 2-col token grid expanded to 3-col; UT chip (Zap icon, warm-brown) added alongside PR and IP.

**PWA noted:**
- `SESSION_STATE.md` + `CLAUDE.md §7` — PWA non-installability documented with full diagnosis (deferred until core features stable).

**Orphaned user re-enrollment:**
- `backend/scripts/re-enroll-orphaned-users.ts` — one-time remediation script. Ran successfully: 7 real users re-enrolled (kisombe, joan, joe, waichari, jane + 2 e2e_v2 users). All now have 5–7 group memberships. 1 test user skipped intentionally.

---

## What was completed in the previous session (session 24)

**Frontend dev performance:**
- Turbopack enabled: `package.json` `dev` script → `next dev --turbopack`
- `next.config.mjs` gains `turbopack.resolveAlias` with relative paths (`'./stubs/empty.js'`) for `unstorage`, `x402/client`, `@base-org/account`
- Webpack config retained unchanged for `next build`

**Next.js upgrade:**
- `next` 15.3.3 → 16.1.6, `eslint-config-next` 14.0.3 → 16.1.6, `eslint` ^8 → ^9
- Docker node_modules volume purged and rebuilt via `docker compose up --build`

**Group detail page (backend + frontend):**
- `groupMembership.service.ts` — `getGroupById(groupId, userId)` method returning `GroupDetailDto`
- `group.controller.ts` + `group.routes.ts` — `GET /:groupId` route
- `frontend/lib/api.ts` — `GroupDetailDto` interface + `communityApi.getGroupDetail(groupId)`
- `components/groups/group-detail.tsx` + `group-members.tsx` — full rewrites using real DTO shapes; join/leave mutation for voluntary groups

**Topbar signup button:**
- `components/layout/topbar.tsx` — `useAuth().isAuthenticated` guards: authenticated → notifications + wallet; unauthenticated → "Get Started" + "Sign In"

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
- PWA not installable — `next-pwa` package installed but not wired (`withPWA` missing from `next.config.mjs`), no `manifest.json`, no app icons in `public/`, no PWA metadata in `layout.tsx`. Defer until core features are stable.

---

## Module status

| Status | Modules |
|---|---|
| **tested** | auth (104 tests), user (35 tests), economy (34 tests), community (49 tests), governance (47 tests) |
| **partial** | integration (Baraza module, no tests), projects, marketplace, notifications, onboarding, emergency, audit, admin |
| **scaffold** | reputation, education, treasury, verification |
| **not started** | M-Pesa |
| **contracts written** | PrToken.sol, UtToken.sol (13 Foundry tests green; Base Sepolia deploy pending) |

---

## Next tasks (priority order)

1. **Base Sepolia deploy** — fund minter wallet → `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast` → set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS` in docker-compose
2. **Fix `next build` 404 prerender error** — Next.js 16 upgrade did not resolve this. Low urgency — dev server works fine.
3. **Integration module tests** — move integration `partial` → `tested`. Test Baraza bot routes and reward job logic.

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
backend/src/modules/community/services/groupMembership.service.ts — enrollInSystemGroups (upsert), getGroupById, getUserGroups, getGroupMembers
backend/scripts/re-enroll-orphaned-users.ts     — one-time remediation script (keep for reference)
docker/docker-compose.yml                       — All services, env vars, healthchecks
backend/vitest.config.ts                        — Test config (fileParallelism:false, resolve.alias, env block)
frontend/lib/api.ts                             — HTTP client (authApi, userApi, economyApi, integrationApi, notificationsApi, communityApi, governanceApi + ApiClient)
frontend/lib/types.ts                           — User interface (includes utBalance)
frontend/contexts/auth-context.tsx              — Auth state, magic link flow, token storage, mapBackendUser()
frontend/contexts/wallet-context.tsx            — Privy wallet (PrivyProvider, useWallet hook)
frontend/components/layout/topbar.tsx           — TokenChip strip (desktop) + auth-gated nav buttons
frontend/components/layout/notifications-popover.tsx  — Real notification bell (reads NotificationContext)
frontend/components/dashboard/dashboard-content.tsx   — Real proposal count, community count, notification activity, mobile token bar
frontend/components/integration/baraza-groups-card.tsx — "My Barazas" dashboard card
frontend/components/community/system-groups-card.tsx  — "My Communities" dashboard card (links to /groups/[id])
frontend/components/groups/group-detail.tsx     — Group detail with real GroupDetailDto, join/leave mutation
frontend/components/groups/group-members.tsx    — Group members with real GroupMemberDto
frontend/next.config.mjs                        — Turbopack resolveAlias stubs + webpack stubs for Privy deps
ai_workflows/DECISIONS.md                       — All ADRs (ADR-001 through ADR-024)
```

# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-03-03 (session 26 — planning only)
**Branch:** `develop`
**Last commits:**
- `3d034cc` feat(community): group detail page + signup button in topbar
- `8e807c4` feat(dashboard): show system group memberships after registration
- `f502869` chore(frontend): upgrade Next.js 15.3.3 → 16.1.6, ESLint 8 → 9
- `a9eff07` fix(frontend): turbopack resolveAlias needs relative paths not absolute
- `53b6ae6` perf(frontend): enable Turbopack for next dev; add resolveAlias stubs

*(No new commits this session — planning only)*

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running (Turbopack) | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ✅ 269/269 green | `cd backend && npx vitest run` |

---

## What was done in the last session (session 26 — planning)

**No code committed.** This was a pure planning session.

**Onboarding lifecycle analysed:**
- `OnboardingProgress` created at registration (`currentStep: 'EMAIL_VERIFICATION'`, `profileCompleted/industriesSelected/goodsServicesSelected: true`)
- Advances once at email verification (`currentStep: 'PLATFORM_INTRO'`, `emailVerified: true`)
- After that: **nothing** — `joinedWardGroup`, `joinedVoluntaryGroup`, `castFirstVote`, `phoneVerified`, `communityVerified`, `walletConnected` are all designed but never written by any code path

**Community module gaps identified:**
- `Group.memberCount` never incremented/decremented by `joinGroup`/`leaveGroup`/`createVoluntaryGroup`
- No `GET /community/groups` discovery endpoint — users can't browse all groups
- Group admin routes commented out — no settings update, member role change, or kick
- Community listener enrolls users in system groups but never sets `OnboardingProgress.joinedWardGroup`

**Plan saved** at `.claude/plans/wiggly-conjuring-nygaard.md` — ready to execute next session.

---

## What was completed in the previous session (session 25)

**Enrollment race condition fix:**
- `groupMembership.service.ts` — `ensureSystemGroupAndEnroll` + `ensureNationalGroupAndEnroll` both replaced `findFirst → create` with atomic `upsert` on `Group.name`.

**Frontend data wiring:**
- `utBalance` added to User type + mapped in `mapBackendUser()`
- Topbar PR/IP/UT `TokenChip` strip (desktop `hidden md:flex`)
- Dashboard: real proposals count, real community count, real notification activity, mobile token bar
- Groups page: real stats from `useQuery(communityApi.getMyGroups)`
- Proposals page: 2 real counts (Active VOTING, Total)
- Profile: UT chip in 3-col grid

**Governance tests:**
- 47 new tests (25 service unit + 22 route integration) — 269/269 green total
- Governance status: `partial` → `tested`

**Orphaned user re-enrollment:**
- `backend/scripts/re-enroll-orphaned-users.ts` ran: 7 real users re-enrolled

---

## Known open issues

- `next build` fails at `/404` static generation — pre-existing
- Auth test flakiness: ~25 tests intermittently fail — pre-existing
- `failedJobHandler` in `workers.ts` is dead code — needs `worker.on('failed', ...)` wired
- `fetch-proposals.tsx` + `voting-interface.tsx` + `enhanced-proposals.tsx` have pre-existing scaffold TypeScript errors
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` written and tested ✅ — Base Sepolia deploy pending (need funded minter wallet)
- Telegram/Discord bot tokens are placeholder values — real bots not configured
- Audit not yet wired for: profile updates, group joins, governance actions
- PWA not installable — `next-pwa` installed but not wired (deferred)
- `Group.memberCount` stale for existing groups — will self-correct after fix on next join/leave
- `OnboardingProgress.joinedWardGroup` is `false` for all existing users — will need one-time backfill if progress UI is ever surfaced

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

1. **Community + onboarding plan** (plan saved, ready to execute):
   - Fix `Group.memberCount` increment/decrement in `group.service.ts`
   - Add `GET /community/groups` discovery endpoint with filters + pagination
   - Add group admin: `PATCH /:groupId/settings`, role change, kick member
   - Wire onboarding booleans: `joinedWardGroup` (community listener), `joinedVoluntaryGroup` (joinGroup), `castFirstVote` (castVote)
   - Frontend: "Explore" tab on groups page
   - Tests: extend 49 community tests; target ~70+ new tests
2. **Base Sepolia deploy** — fund minter wallet → `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast`
3. **Fix `next build` 404 prerender error** — low urgency, dev server works fine

---

## Key file paths (quick reference)

```
backend/src/app.ts                              — Express app, middleware order, route mounts
backend/src/index.ts                            — Server entry, startup assertions, graceful shutdown
backend/src/workers.ts                          — BullMQ worker + integrationWorker
backend/src/core/jobs/register.ts               — All repeatable job registrations
backend/src/core/rbac/roles.ts                  — SystemRoles, GroupRoles, RoleHierarchy, roleIncludes(), type guards
backend/src/core/events/listener-registry.ts    — registerAllListeners() — called in app.ts initializeServices()
backend/src/modules/integration/                — Baraza messaging module (Telegram, Discord, WhatsApp)
backend/src/modules/governance/services/proposal.service.ts  — createProposal, startVoting, castVote, tallyVotes, getProposal, listProposals
backend/src/modules/community/services/group.service.ts      — createVoluntaryGroup, joinGroup, leaveGroup (memberCount BUG: not maintained)
backend/src/modules/community/services/groupMembership.service.ts — enrollInSystemGroups (upsert), getGroupById, getUserGroups, getGroupMembers
backend/src/modules/community/listeners/user-events.listeners.ts  — email.verified → enrollInSystemGroups (does NOT update joinedWardGroup yet)
backend/src/modules/onboarding/services/onboarding.service.ts — getProgress, completeTutorial, markMilestone
backend/src/modules/user/prisma/schema.prisma   — OnboardingProgress model (lines 126-173) — all boolean fields
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
.claude/plans/wiggly-conjuring-nygaard.md       — Community + onboarding plan (ready to execute next session)
```

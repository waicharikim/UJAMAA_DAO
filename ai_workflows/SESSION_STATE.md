# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-03-11 (session 28 — community plan executed end-to-end)
**Branch:** `develop`
**Last commits:**
- `090d199` chore(frontend): replace auth buttons with Coming Soon while backend is offline
- `0b42e3e` fix(frontend): update Nguzo Saba principles and add About to navbar
- `486e56d` chore(deploy): add netlify.toml with Next.js runtime plugin
- `5feb305` fix(ci): run prettier on 16 files to clear lint errors
- `473fa5f` docs: session 26 log — community/onboarding gap analysis, plan saved

*(No new commits this session — tests run, all green. Needs commit + lint check before push.)*

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running (Turbopack) | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ✅ 302/302 green | `cd backend && npx vitest run` |

---

## What was done in the last session (session 28 — community plan)

**Community module plan executed end-to-end (11 items from `.claude/plans/wiggly-conjuring-nygaard.md`):**

**Backend:**
- `group.service.ts` — fixed `memberCount` (create=1, join increment, leave decrement); added `updateGroupSettings`, `changeMemberRole`, `removeMember` (all LEADER-only)
- `groupMembership.service.ts` — added `getGroups()`: paginated discovery, filters (isSystem/voluntaryType/search), returns `isMember`+`myRole` per user, status=ACTIVE filter
- `group.controller.ts` — added handlers for `getGroups`, `updateGroupSettings`, `changeMemberRole`, `removeMember`
- `group.routes.ts` — added `GET /` (discovery, before `/:groupId`), `PATCH /:groupId/settings`, `PATCH /:groupId/members/:userId/role`, `DELETE /:groupId/members/:userId`
- `user-events.listeners.ts` — wires `joinedWardGroup: true` after `enrollInSystemGroups`
- `proposal.service.ts` — wires `castFirstVote: true` after vote creation (idempotent via `updateMany { where: { castFirstVote: false } }`)

**Frontend:**
- `frontend/lib/api.ts` — added `GroupDiscoveryDto` interface + `communityApi.getGroups(params?)`
- `frontend/app/groups/page.tsx` — rewrote: shadcn `Tabs` (My Groups / Explore); `ExploreGroups` component (search input, card grid, join mutation)

**Tests:**
- `tests/community/group.routes.test.ts` — +18 new tests (GET /, settings, role, kick)
- `tests/community/group.service.test.ts` — +15 new tests (memberCount tracking, updateGroupSettings, changeMemberRole, removeMember, getGroups isMember)
- `tests/community/helpers.ts` — `seedVoluntaryGroup` now sets `status: 'ACTIVE'`
- **Total: 302/302 green** across 19 test files

---

## What was done in the previous session (session 27 — docs)

**No code committed.** Docs-only session.

**docs/white.docx extracted into 6 new files** + 7 existing docs rewritten.
**ADR-025** (activity-gated PR regen) + **ADR-026** (soft PR inactivity decay) added.
**Workflow files corrected** (`orient.md`, `audit-docs.md`, `START_HERE.md`, `AGENTS.md`, `CLAUDE.md`).

---

## Known open issues

- `next build` fails at `/404` static generation — pre-existing
- Auth test flakiness: ~25 tests intermittently fail — pre-existing
- `failedJobHandler` in `workers.ts` is dead code — needs `worker.on('failed', ...)` wired
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` written and tested ✅ — Base Sepolia deploy pending (need funded minter wallet)
- Telegram/Discord bot tokens are placeholder values — real bots not configured
- Audit not yet wired for: profile updates, group joins, governance actions
- PWA not installable — `next-pwa` installed but not wired (deferred)
- `OnboardingProgress.joinedWardGroup` is `false` for existing users — needs one-time backfill if progress UI ever surfaces
- Changes from this session need a commit + `npm run lint` before push

---

## Module status

| Status | Modules |
|---|---|
| **tested** | auth (104 tests), user (35 tests), economy (34 tests), community (82 tests), governance (47 tests) |
| **partial** | integration (Baraza module, no tests), projects, marketplace, notifications, onboarding, emergency, audit, admin |
| **scaffold** | reputation, education, treasury, verification |
| **not started** | M-Pesa |
| **contracts written** | PrToken.sol, UtToken.sol (13 Foundry tests green; Base Sepolia deploy pending) |

---

## Next tasks (priority order)

1. **Commit this session's changes** — `cd backend && npm run lint && npx tsc --noEmit` first
2. **Governance tests + frontend** — `castVote` onboarding flag is now wired; governance service + routes already exist; write ~40 governance tests + add proposal creation UI + vote UI to frontend
3. **Base Sepolia deploy** — fund minter wallet → `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast`
4. **Fix `next build` 404 prerender error** — low urgency, dev server works fine

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
backend/src/modules/governance/services/proposal.service.ts  — createProposal, startVoting, castVote (now wires castFirstVote), tallyVotes
backend/src/modules/community/services/group.service.ts      — createVoluntaryGroup, joinGroup (wires joinedVoluntaryGroup), leaveGroup, updateGroupSettings, changeMemberRole, removeMember
backend/src/modules/community/services/groupMembership.service.ts — enrollInSystemGroups (upsert), getGroupById, getUserGroups, getGroupMembers, getGroups (discovery)
backend/src/modules/community/listeners/user-events.listeners.ts  — email.verified → enrollInSystemGroups + joinedWardGroup flag
backend/src/modules/onboarding/services/onboarding.service.ts — getProgress, completeTutorial, markMilestone
backend/src/modules/user/prisma/schema.prisma   — OnboardingProgress model — all boolean flags
docker/docker-compose.yml                       — All services, env vars, healthchecks
backend/vitest.config.ts                        — Test config (fileParallelism:false, resolve.alias, env block)
frontend/lib/api.ts                             — HTTP client (authApi, userApi, economyApi, integrationApi, notificationsApi, communityApi, governanceApi)
frontend/contexts/auth-context.tsx              — Auth state, magic link flow, mapBackendUser()
frontend/contexts/wallet-context.tsx            — Privy wallet (PrivyProvider, useWallet hook)
frontend/app/groups/page.tsx                    — Groups page with Tabs (My Groups / Explore) + ExploreGroups component
frontend/components/groups/group-detail.tsx     — Group detail with real GroupDetailDto, join/leave mutation
frontend/next.config.mjs                        — Turbopack resolveAlias stubs + webpack stubs for Privy deps
ai_workflows/DECISIONS.md                       — All ADRs (ADR-001 through ADR-026)
docs/architecture.md                            — Full system architecture (rewritten 2026-03-10)
docs/group-api.md                               — Community groups API (now reflects 9 endpoints incl. discovery + admin)
docs/economy-design.md                          — Token mechanics: PR regen, UT two-pool, earning tables, decay rules
```

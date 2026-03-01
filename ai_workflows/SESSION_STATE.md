# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-03-02 (session 18)
**Branch:** `develop`
**Last commits:**
- `9a1227b` docs: session 17 log — audit pass, 8 doc contradictions corrected
- `df6d74e` docs: audit pass — correct 8 doc contradictions, add missing conventions
- `58ee904` feat(frontend): collapsible sidebar + logout button

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ✅ 173/173 green | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 18)

- **Roles system hardened** — `roles.ts` rewritten per `roles.md` decisions: 5 new system roles (compliance_officer, county_coordinator, blockchain_admin, contract_deployer, multisig_signer), 2 new group roles (SECRETARY, MODERATOR), `RoleHierarchy`, `roleIncludes()`, type guards, display names, `AssignmentMethod`, `ElectionThresholds`. Seed updated. Raw string literals in admin/audit routes + password-reset service replaced with `SystemRoles.*`.
- **Notification type bug fixed** — `notification.service.ts` was hardcoding `PrismaNotificationType.SYSTEM` for all types. Added `toPrismaType()`: DUES_* → ECONOMIC, PROPOSAL_* → PROPOSAL, rest → SYSTEM.
- **Audit logging wired into auth + economy** — `GET /api/v1/audit/search` now returns real records:
  - Auth: `USER_CREATED` (on registration), `EMAIL_VERIFIED` (on first verification)
  - Economy: `PR_AWARDED` + `PR_SPENT` (every award/spend), `DUES_PAID`, `COMMITMENT_CREATED`
  - Both economy services refactored from `return prisma.$transaction(...)` to `const result = await ...` pattern to allow post-transaction audit calls
- **Test helper fixed** — `createTestAdmin()` now upserts `system:super_admin` (was creating non-existent `'ADMIN'` role that matched the old raw-string check)

---

## Known open issues

- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing, dev unaffected)
- `failedJobHandler` in `workers.ts` is dead code — needs `worker.on('failed', failedJobHandler)` wired; `sendJobFailureAlert` is never called at all
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin modules
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` not written
- Raw-string role literals remain in `admin.validators.ts` + `emergency.routes.ts` (pre-existing)
- Audit not yet wired for: profile updates, group joins, governance actions (wire when those modules are tested)
- Notifications: no DUES_REMINDER BullMQ job, no preference routes, only emergency module sends notifications
- Deep scaffold components (MilestoneTracker, AdminDashboard, GroupDetail, FetchProposals) still use internal blue/slate colours

---

## Module status

| Status | Modules |
|---|---|
| **tested** | auth (104 tests), user (35 tests), economy (34 tests) |
| **partial** | community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin |
| **scaffold** | reputation, education, treasury, integration, verification |
| **not started** | M-Pesa, blockchain contracts |

---

## Next tasks (priority order)

1. **Community module tests** — move community `partial` → `tested` (highest backend priority; directly imported by auth)
2. **Blockchain session** — `PrToken.sol` (soulbound ERC-20) + `UtToken.sol` + Foundry tests + Base Sepolia deploy + wire `participationRights.service.ts`
3. **Fix `next build` 404 prerender error** — Next.js 15.3.3 bug. Low urgency — dev server works fine.

---

## Key file paths (quick reference)

```
backend/src/app.ts                          — Express app, middleware order, route mounts
backend/src/index.ts                        — Server entry, startup assertions, graceful shutdown
backend/src/workers.ts                      — BullMQ worker, 4 jobs (economy x2, user-cleanup, auth-cleanup)
backend/src/core/jobs/register.ts           — All repeatable job registrations
backend/src/core/rbac/roles.ts              — SystemRoles, GroupRoles, RoleHierarchy, roleIncludes(), type guards
docker/docker-compose.yml                   — All services, env vars, healthchecks
backend/vitest.config.ts                    — Test config (fileParallelism:false, resolve.alias, env block)
frontend/lib/api.ts                         — HTTP client (authApi, userApi, economyApi)
frontend/contexts/auth-context.tsx          — Auth state, magic link flow, token storage
frontend/contexts/wallet-context.tsx        — Privy wallet (PrivyProvider, useWallet hook)
frontend/components/auth/wallet-button.tsx  — Connect Wallet pill / address dropdown
frontend/next.config.mjs                    — Webpack stubs for Privy transitive deps
frontend/stubs/empty.js                     — Canonical empty stub (module.exports = {})
frontend/app/auth/callback/page.tsx         — Token type detection → routes to correct verify function
frontend/components/layout/page-header.tsx  — Shared page header (cream gradient + amber badge)
frontend/components/layout/stats-grid.tsx   — Shared stats grid (cream cards + Chai change pills)
ai_workflows/DECISIONS.md                   — All ADRs (ADR-001 through ADR-023)
```

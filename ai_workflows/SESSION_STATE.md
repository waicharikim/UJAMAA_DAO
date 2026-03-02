# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-03-02 (session 20)
**Branch:** `develop`
**Last commits:**
- `99bc298` feat(community): 49 new tests green, community partial → tested, listener registration fixed
- `2fd236a` feat: roles hardened, notification type bug fixed, audit wired into auth + economy
- `9a1227b` docs: session 17 log — audit pass, 8 doc contradictions corrected

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ✅ 173/173 green | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 20)

- **Blockchain contracts written** — `contracts/src/PrToken.sol` (soulbound ERC-20, non-transferable, `ParticipationRightsAwarded` event, role-gated mint/burn) and `contracts/src/UtToken.sol` (standard ERC-20, role-gated mint/burn)
- **Foundry tests green** — `contracts/test/PrToken.t.sol` (9 tests) + `contracts/test/UtToken.t.sol` (4 tests). `forge test -vv` → 13/13 [PASS]
- **Deploy script** — `contracts/script/Deploy.s.sol` reads `MINTER_WALLET_ADDRESS` env; ready to run against Base Sepolia when wallet is funded
- **OpenZeppelin v5 installed** — `contracts/lib/openzeppelin-contracts/`; remapping added to `foundry.toml`; `forge build` → ABIs in `contracts/out/`
- **Backend blockchain client** — `backend/src/core/blockchain/client.ts`: `getPrContract()` / `getUtContract()` with null-guard (no crash when env vars missing or placeholder key)
- **On-chain mint wired** — `participationRights.service.ts` `award()` method calls `prContract.mint()` after audit log, guarded by `NODE_ENV !== 'test'` + `walletAddress` check + `getPrContract()` null check
- **Anvil Docker service** — `ujamaa_anvil` added to `docker-compose.yml`; worker service gets `BASE_RPC_URL`, `MINTER_PRIVATE_KEY` (dev placeholder), `PR_TOKEN_ADDRESS`, `UT_TOKEN_ADDRESS` env vars
- **All 222 backend tests still green** — `npx vitest run` → 222/222; `npx tsc --noEmit` → 0 errors

---

## Known open issues

- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing, dev unaffected)
- `failedJobHandler` in `workers.ts` is dead code — needs `worker.on('failed', failedJobHandler)` wired; `sendJobFailureAlert` is never called at all
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin modules
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` written and tested ✅ — Base Sepolia deploy pending (need funded minter wallet)
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
| **not started** | M-Pesa |
| **contracts written** | PrToken.sol, UtToken.sol (13 Foundry tests green; Base Sepolia deploy pending) |

---

## Next tasks (priority order)

1. **Base Sepolia deploy** — fund minter wallet → `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast` → set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS` in docker-compose + `.env`
2. **Governance module tests** — move governance `partial` → `tested`
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

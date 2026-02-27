# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-02-28 (session 17)
**Branch:** `develop`
**Last commits:**
- `df6d74e` docs: audit pass — correct 8 doc contradictions, add missing conventions
- `58ee904` feat(frontend): collapsible sidebar + logout button
- `b6ac189` docs: session 15 log — Chai palette extended to all frontend pages

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ✅ 173/173 green | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 17)

- **Full `/audit-docs` pass** — read 8 files (CLAUDE.md, DECISIONS.md, app.ts, index.ts, workers.ts, auth.service.ts, schema.prisma, docker-compose.yml)
- **8 doc contradictions corrected** in `CLAUDE.md` + `DECISIONS.md`:
  1. JWT_SECRET minimum: ≥32 chars (not 64)
  2. DASHBOARD_PASSWORD default: `admin123` (not `YourVeryStrongPassword123!`)
  3. ENCRYPTION_KEY default: 64 zero chars (not empty string)
  4. Traefik state: fully commented out (not "runs but ports not bound")
  5. `failedJobHandler`: dead code, never registered on any worker event (stronger than "doesn't email")
  6. ADR-009 Privy login: `loginMethods: ['email','wallet','google']` (not `loginWithPhone()`)
  7. ADR-010 build order: Auth→User→Economy→Community→Governance (not Marketplace second)
  8. Wagmi stale note removed (Privy active since session 13)
- **Missing conventions added to §5**: 10 MB body limit, `logSecurityEvent()` utility, event bus registry
- **Gaps filled**: dev port map (Redis=6380), graceful shutdown full order, Docker services list corrected

---

## Known open issues

- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing, dev unaffected)
- `failedJobHandler` in `workers.ts` is dead code — needs `worker.on('failed', failedJobHandler)` wired; `sendJobFailureAlert` is never called at all
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin modules
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` not written
- Deep scaffold components (MilestoneTracker, AdminDashboard, GroupDetail, FetchProposals) still use internal blue/slate colours — blocked until those modules are actively built

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

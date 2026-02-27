# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-02-27 (session 14)
**Branch:** `develop`
**Last commits:**
- `29a4b87` feat(frontend): landing page — 3D orbital system + higher-purpose content
- `276e0ce` chore: repo cleanup before collaborator onboarding
- `bf759fd` feat(frontend): activate Privy wallet — stub transitive deps, fix build

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ✅ 173/173 green | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 14)

- **Repo cleanup** — deleted: `scripts/` (3 stale/insecure scripts), root `package.json`/`package-lock.json`, `blockchain/` (redundant), `tall rate-limit-redis` (git accident). Relocated stale docs to `ai_workflows/` and `docs/`. Rewrote `backend/INFRASTRUCTURE.md`. Added `SETUP.md` at repo root and `frontend/.env.local.example`.
- **Traefik disabled in dev** — ports were never bound to host; commented out in `docker-compose.yml`. ADR-023 added to DECISIONS.md.
- **MailHog docs fixed** — corrected `SMTP_HOST` from `172.19.0.1` → `mailhog` (container name). All prior docs claiming MailHog needed manual start were wrong — it auto-starts with `make dev`.
- **Landing page full rewrite** — `frontend/components/landing/landing-page.tsx`:
  - 3D OrbitalSystem canvas: true 3-D tilted ellipses (dim back arc / bright front arc), depth-sorted dots with scale+alpha by z-depth, pulsing sun with 8 animated rays, mouse parallax
  - New VisionSection: "Africa has always known how to build together" — manifesto body, three philosophy pillars (Not DeFi / Not Charity / Not Governance Theater), Nyerere/Arusha Declaration quote
  - Hero reframed around cooperative tradition (chama, harambee, sacco), not ward mechanics
  - All 7 Nguzo Saba in marquee, footer, and dedicated Nguzo Saba strip in ProtocolSection
  - New ProtocolSection: PR tokens (soulbound) / Impact Points (non-transferable) / Community Treasury (onchain)
  - HowItWorks, UseCases: descriptions rewritten around economic self-determination language
- **Known build issue** — `next build` fails at static generation of `/404` with `<Html> should not be imported outside of pages/_document` (Next.js 15.3.3 bug: uses development React bundle during static generation). TypeScript compilation is clean. Site runs correctly in dev (`make dev`). Pre-existing — present on the codebase before session 14.

---

## Known open issues

- `sendJobFailureAlert` in `workers.ts` is effectively dead code — job failures log but no human is alerted
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin modules
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` not written
- Chai palette not extended to dashboard/profile/proposals screens (still use old inline hex values)

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

1. **Fix `next build` 404 prerender error** — Next.js 15.3.3 bug. Options: upgrade Next.js (risky), or configure `output: 'standalone'` to check if it changes static gen behavior. Low urgency — dev server works fine.
2. **Community module tests** — move community `partial` → `tested` (highest backend priority; directly imported by auth)
3. **Blockchain session** — `PrToken.sol` (soulbound ERC-20) + `UtToken.sol` + Foundry tests + Base Sepolia deploy + wire `participationRights.service.ts`
4. **Extend Chai palette** — apply to dashboard, profile, proposals screens

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
ai_workflows/DECISIONS.md                   — All ADRs (ADR-001 through ADR-022)
```

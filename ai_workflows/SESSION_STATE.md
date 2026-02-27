# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-02-27 (session 15)
**Branch:** `develop`
**Last commits:**
- `a0dca9f` feat(frontend): apply Chai palette to all pages
- `2e8a087` docs: session 14 log — landing page rewrite + repo cleanup complete
- `29a4b87` feat(frontend): landing page — 3D orbital system + higher-purpose content

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running | http://localhost:3000 |
| MailHog | ✅ auto-started by `make dev` | http://localhost:8025 |
| Tests | ✅ 173/173 green | `cd backend && npx vitest run` |

---

## What was completed in the last session (session 15)

- **About page full rewrite** — `frontend/app/about/page.tsx`:
  - Dark `#0A1F14` background matching landing page
  - Hero: Ujamaa etymology — "the word that changed how Africa thinks about building together"
  - Philosophy section: chama/harambee/tontine/stokvel cooperative tradition + Nyerere 1962 quote
  - Three pillars: Govern Together / Work Together / Prosper Together
  - All 7 Nguzo Saba with full Swahili names, English translations, and principle meanings
  - Protocol section: soulbound PR tokens / Impact Points / Community Treasury
  - CTA → `/auth/register`, footer Nguzo Saba name strip
- **Chai palette extended to all authenticated pages:**
  - `components/layout/page-header.tsx` — cream gradient, amber badge, `font-display` chai title
  - `components/layout/stats-grid.tsx` — cream cards, Chai change pills (tea-green/ember/chai)
  - `app/groups/page.tsx`, `app/proposals/page.tsx`, `app/projects/page.tsx`, `app/admin/page.tsx` — Chai stat icon colors (`#C9922A`/`#1E3D2F`/`#B03A1E`/`#2A5240`), amber spinners, amber pill CTAs
  - `app/groups/[id]/page.tsx` — amber-tinted skeleton pulses
  - `app/projects/[id]/page.tsx` — full redesign: `InfoCard`, custom amber progress bar, `StatusBadge`, tea-green participant avatars, amber `TabsList`
  - `app/dashboard/page.tsx` — cream gradient loading fallback

---

## Known open issues

- `next build` fails at `/404` static generation (Next.js 15.3.3 bug, pre-existing, dev unaffected)
- `sendJobFailureAlert` in `workers.ts` is effectively dead code — job failures log but no human is alerted
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

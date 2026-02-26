# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-02-26 (session 13)
**Branch:** `develop`
**Last commits:**
- `bf759fd` feat(frontend): activate Privy wallet — stub transitive deps, fix build
- `4b93c66` feat(frontend): auth flows on landing + wallet scaffold
- `0db35ec` feat(frontend): redesign — Chai palette, v0 landing page, tea-green sidebar

---

## What's running right now

| Service | Status | URL |
|---|---|---|
| Backend API | ✅ healthy | http://localhost:4000/health |
| Frontend | ✅ running | http://localhost:3000 |
| MailHog | ⚠️ manual start required | http://localhost:8025 |
| Tests | ✅ 173/173 green | `cd backend && npx vitest run` |

**MailHog is NOT auto-started by `make dev`.** Run manually:
```
docker compose -f docker/docker-compose.yml up -d mailhog
```

---

## What was completed in the last session (session 13)

- **Privy wallet integration** — `wallet-context.tsx` wired to real `PrivyProvider` + hooks (`usePrivy`, `useWallets`, `useConnectWallet`, `useLogout`). `wallet-button.tsx` added (amber pill / green address dropdown). App ID set in `.env.local`.
- **Auth flows on landing page** — `SignInModal` on landing page (was wrongly linked to `/auth/callback`). `onSignIn` prop threads through `LandingNavbar` and `HeroSection`.
- **Register page Chai palette** — tea-dark bg, cream card, amber badge.
- **Webpack stubs** — 4 Privy transitive deps stubbed in `next.config.mjs` (`@base-org/account`, `unstorage`, `x402/client` via `resolve.alias`; `DelegatedActionsConsentScreen` via `NormalModuleReplacementPlugin`).
- **Build green** — 15/15 routes compile, 0 errors.
- **Docker npm install** — `@privy-io/react-auth` + 659 transitive deps installed inside `ujamaa_frontend` container.

---

## Known open issues

- `sendJobFailureAlert` in `workers.ts` is effectively dead code — job failures log but no human is alerted
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin modules
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- `PrToken.sol` + `UtToken.sol` not written
- Chai palette not extended to dashboard/profile/proposals screens (still use old inline hex values)
- MailHog must be started manually

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
3. **Extend Chai palette** — apply to dashboard, profile, proposals screens

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

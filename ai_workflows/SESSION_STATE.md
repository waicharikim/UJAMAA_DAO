# SESSION_STATE.md — Live Project Snapshot

> **Always-current one-pager. Overwritten at the end of every session.**
> Read this before CLAUDE.md — it tells you exactly where the project is right now.
> For full history, see PROGRESS_LOG.md.

---

**Last updated:** 2026-02-26 (session 11)
**Branch:** `develop`
**Last commits:**
- `a5450ec` docs: session 11 log — auth email link fix, frontend flow verified
- `8a1a9cc` fix(auth): magic link and verification emails now point to frontend callback

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

## What was fixed in the last session (session 11)

- Auth email links pointed to backend (`:4000`) — now correctly point to frontend (`:3000`) `/auth/callback`
- `verifyEmailToken()` added to `api.ts` and `auth-context.tsx` for new-user hex token flow
- Callback page now detects token type: JWT (2 dots) → `verifyMagicLink`; hex → `verifyEmailToken`
- **This session (audit)**: fixed `verifyMagicLink` in `api.ts` + `auth-context.tsx` — was destructuring `accessToken` but backend returns `sessionToken`; existing-user login was broken

---

## Known open issues

- `sendJobFailureAlert` in `workers.ts` is effectively dead code — defined but `failedJobHandler` is never attached to a worker event; job failures log but no human is alerted
- `failedJobHandler` function body (lines 186-231) is unreachable in current wiring
- No tests for community, governance, projects, marketplace, notifications, onboarding, emergency, audit, admin modules
- M-Pesa verification in `user.service.ts` is stubbed — always returns success
- Privy frontend integration not started (`@privy-io/react-auth` not installed)
- `PrToken.sol` + `UtToken.sol` not written

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
3. **Frontend Phase 3** — install `@privy-io/react-auth`, replace wagmi mock, wire phone login

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
frontend/app/auth/callback/page.tsx         — Token type detection → routes to correct verify function
ai_workflows/DECISIONS.md                   — All ADRs (ADR-001 through ADR-022)
```

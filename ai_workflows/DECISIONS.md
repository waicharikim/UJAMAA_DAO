# DECISIONS.md — Architectural Decision Record

> Every significant technical or product decision gets logged here.
> This is not a to-do list. It's a record of choices made and why.
> When Claude asks "why did we do it this way?" — the answer is here.

---

## Decision Format

```markdown
## [ADR-XXX] — [Decision title]
**Date:** YYYY-MM-DD
**Status:** Decided / Superseded by ADR-XXX / Under Review
**Decision:** [one sentence — what was chosen]
**Why:** [the reasoning, including what alternatives were rejected and why]
**Consequences:** [what this means for future work]
```

---

## Decisions

---

## [ADR-001] — Marketplace is discovery-only, no payments

**Date:** 2026-02-19
**Status:** Decided (non-negotiable)
**Decision:** The marketplace facilitates discovery and matching between buyers and sellers. It does not process, hold, or facilitate payments of any kind.
**Why:** Reduces regulatory exposure, eliminates escrow liability, keeps platform scope focused. Payment processing in East Africa requires specific licensing and creates trust problems if anything goes wrong with a transaction. Real money flows via M-Pesa to platform-controlled accounts for structured activities (dues, project contributions), not marketplace trades.
**Consequences:** Marketplace features will never include "pay now," escrow, or in-app transaction history for trades. Chat and connection facilitation is fine. Any feature proposal that involves marketplace payments is automatically rejected.

---

## [ADR-002] — Blockchain hybrid model from day one

**Date:** 2026-02-19
**Status:** Decided
**Decision:** On-chain: PR token, UT token, governance votes, treasury. Off-chain: profiles, discovery, education, emergency coordination, chat, notifications.
**Why:** Full on-chain is too expensive and too slow for UX in Kenya. Full off-chain defeats the transparency and sovereignty purpose. The split puts verifiable collective decisions on-chain (votes, token balances, treasury movements) while keeping fast, cheap UX off-chain.
**Consequences:** Any new feature must explicitly state its on-chain vs off-chain position before implementation starts. Architect hat always makes this call.

---

## [ADR-003] — PR token is soulbound (non-transferable)

**Date:** 2026-02-19
**Status:** Decided (non-negotiable)
**Decision:** PR (Participation Rights) token is a soulbound ERC-20. All transfer functions revert.
**Why:** If PR were transferable, it would immediately become a speculative asset and lose its meaning as a participation signal. Whales could buy governance power. Ward members would sell votes. The entire legitimacy of collective decision-making depends on PR representing actual participation, not wealth.
**Consequences:** PR contract must override all standard ERC-20 transfer methods. Any feature that involves "sending" or "trading" PR is automatically rejected.

---

## [ADR-004] — UT earned in-app has no cash-out path

**Date:** 2026-02-19
**Status:** Decided (non-negotiable)
**Decision:** UT earned through platform activity (completing education, contributing to projects) cannot be exchanged for M-Pesa or any real-world currency. Only user-deposited UT (if that feature ships) may have a withdrawal path.
**Why:** An in-app cash-out path for earned UT would immediately create farming incentives and speculative behavior. Users would optimize for earning UT rather than for real contribution. The token's value must stay internal and cosmetic.
**Consequences:** Any endpoint or feature that converts earned UT to currency is rejected. UT uses are limited to visibility boosts, cosmetic features, and internal platform perks.

---

## [ADR-005] — Everything runs in Docker, always

**Date:** 2026-02-19
**Status:** Decided (non-negotiable)
**Decision:** All development, testing, and deployment happens via Docker Compose. No bare-metal Node.js, no local-only Postgres, no "just run it directly."
**Why:** Ensures environment consistency across development, staging, and production. Prevents "works on my machine" problems. Makes onboarding new contributors simple.
**Consequences:** All instructions reference service names (`postgres`, `redis`) not `localhost`. All Makefile commands wrap Docker operations. New services get added to `docker-compose.yml` before any code references them.

---

## [ADR-006] — BullMQ for all async/scheduled work

**Date:** 2026-02-19
**Status:** Decided (amended 2026-02-22 — setInterval exception)
**Decision:** All background jobs, scheduled tasks, and event-driven async work goes through BullMQ. No `setTimeout`, `setInterval`, or cron strings in application code.
**Why:** BullMQ gives us reliable retry, dead-letter queuing, observability (Bull Board), and distributed worker support. `setTimeout` is fragile, doesn't survive process restarts, and has no observability.
**Consequences:** New async features get a BullMQ job in the appropriate queue. Queue names are constants defined in the codebase. All queues register in `backend/src/core/jobs/register.ts`.
**Amendment (2026-02-22):** One narrow exception — ephemeral in-memory cleanup that explicitly does NOT need to survive process restarts may use `setInterval`. Current example: nonce store cleanup in `wallet.service.ts` (clears expired nonces from a Map every 5 minutes). This is not a job — it's housekeeping for an in-process cache. If nonces ever move to Redis, this setInterval goes away too.

---

## [ADR-007] — Event bus for cross-module communication

**Date:** 2026-02-19
**Status:** Decided
**Decision:** Modules communicate via the event bus (`backend/src/core/utils/eventBus.ts`), not by importing each other's services.
**Why:** Direct imports create tight coupling. Auth importing PR service, PR service importing profile service — this creates a dependency graph that's hard to test and harder to refactor. Event bus keeps modules independent. Auth publishes `user.email.verified`; PR listens. Neither knows about the other directly.
**Consequences:** New cross-module interactions get an event, not an import. Event names are typed strings. The event bus handles async dispatch, modules handle their own side effects.

---

## [ADR-008] — Base L2 for blockchain, not Ethereum mainnet

**Date:** 2026-02-19
**Status:** Decided
**Decision:** Deploy PR and UT contracts on Base (Coinbase's L2). Testnet: Base Sepolia. Prod: Base Mainnet.
**Why:** Gas costs on Ethereum mainnet would make governance voting prohibitively expensive for ward members earning in KES. Base offers EVM compatibility (can use existing Solidity tooling) with dramatically lower gas costs. Coinbase's backing provides reasonable confidence in long-term viability.
**Consequences:** Local dev uses Anvil fork of Base Sepolia. All blockchain tooling must be Base-compatible. Gas sponsorship via Pimlico paymaster for first user transaction.

---

## [ADR-009] — Embedded wallets via Privy or Dynamic

**Date:** 2026-02-19
**Status:** Under Review (Privy vs Dynamic decision pending)
**Decision:** Use embedded wallet SDK (Privy or Dynamic) rather than requiring users to install MetaMask or manage seed phrases.
**Why:** Target users are ward members in Kenya, many of whom have never used blockchain. Requiring MetaMask installation and seed phrase management would kill adoption. Embedded wallets abstract the complexity while still giving users real wallet ownership.
**Consequences:** Whichever SDK is chosen, it must support Base, allow social login (phone number primary), and support Pimlico paymaster for gasless transactions. Final choice (Privy vs Dynamic) to be made during blockchain module implementation.

---

## [ADR-010] — Auth module first, then marketplace, then governance

**Date:** 2026-02-19
**Status:** Decided
**Decision:** Build and harden modules in this order: Auth → Marketplace → Governance → Education → Emergency → Collective Project Loop.
**Why:** Everything depends on auth. Marketplace is the first user-facing feature that drives adoption. Governance requires users to exist and be verified. Education and emergency can be layered on. The collective project loop is the most complex and requires all other systems to be stable.
**Consequences:** Don't start marketplace until auth passes the module readiness checklist. Don't start governance until marketplace is solid. Frontend comes after at least auth + marketplace are running.

---

## [ADR-011] — Backend code lives under `backend/` subdirectory

**Date:** 2026-02-21
**Status:** Decided
**Decision:** All backend source lives under `backend/` (i.e. `backend/src/`, `backend/Makefile`, `backend/vitest.config.ts`). Docker Compose lives under `docker/`. The repo root is reserved for top-level project files.
**Why:** Separates concerns for a future monorepo (frontend will live at `frontend/`, blockchain at `contracts/`). Prevents the repo root from becoming a dumping ground as the project grows.
**Consequences:** All file path references in code, docs, and ai_workflow files must use the `backend/` prefix. Never reference `src/` from the root — it doesn't exist there.

---

## [ADR-012] — Vitest + Supertest as the testing framework

**Date:** 2026-02-21
**Status:** Decided
**Decision:** Unit and integration tests use Vitest as the test runner and Supertest for HTTP-layer integration tests. Config at `backend/vitest.config.ts`.
**Why:** Vitest is fast, native ESM, and has first-class TypeScript support without transpilation overhead. It shares the same config surface as Vite. Supertest integrates cleanly with Express without needing a running server. Jest was rejected due to slower startup and more complex TypeScript config.
**Consequences:** No Jest. No Mocha. All test files use `.test.ts` suffix. Unit tests mock Prisma client — never hit a real DB. Integration tests use the `postgres_test` service. Zero tests exist as of 2026-02-21 — writing them for auth is the next milestone.

---

## [ADR-013] — gRPC interfaces directory is an empty placeholder

**Date:** 2026-02-21
**Status:** Decided (2026-02-21 — supersedes Under Review)
**Decision:** `backend/src/interfaces/` exists but is empty. No gRPC is implemented. The directory is an empty placeholder with no current or planned use. Do not build anything depending on gRPC until a concrete use case justifies it.
**Why:** Audited the directory on 2026-02-21 — it is empty. No `.proto` files, no generated stubs, no services that call it. The single Express app + BullMQ worker architecture has no need for inter-service gRPC at this stage.
**Consequences:** Ignore `backend/src/interfaces/` entirely for now. If a future use case arises (e.g., mobile transport, microservice split), a new ADR must be created first.

---

## [ADR-014] — Per-module Prisma schemas merged via mergeSchema.ts

**Date:** 2026-02-21
**Status:** Decided
**Decision:** Each module owns its Prisma schema at `backend/src/modules/[name]/prisma/schema.prisma`. A merge script at `backend/src/core/database/mergeSchema.ts` combines them in a defined order into `backend/prisma/schema.prisma`. The merged file is the one Prisma CLI uses. Never edit `prisma/schema.prisma` directly.
**Why:** A single monolithic schema file becomes unmanageable as modules grow. Per-module schemas give teams clear ownership and make schema review easier. The merge script enforces ordering (modules that reference other modules' models must come after them), detects duplicate model names, and annotates sections for readability. This was adopted after the single-file approach grew to 1275 lines with all models in base.prisma.
**Consequences:** All schema changes go in the relevant module's `schema.prisma`. Run `npm run db:merge` after any schema change, then `npx prisma validate`, then `npx prisma migrate dev`. The merge order in `MODULE_ORDER` in `mergeSchema.ts` must be maintained (dependency order: modules that reference other modules' models must come after them).

---

## [ADR-015] — Event listeners registered atomically before server accepts traffic

**Date:** 2026-02-22
**Status:** Decided
**Decision:** `registerAllListeners()` is called inside `initializeServices()` in `backend/src/app.ts`, which is `await`ed by `index.ts` before the HTTP server begins listening. All cross-module event listeners are registered as a single atomic step at startup.
**Why:** If listeners registered lazily (e.g., on first request), early requests could fire events with no handlers — silently dropping cross-module side effects (PR award on email verification, group enrollment, etc.). Atomic registration eliminates this race condition entirely.
**Consequences:** Any new cross-module listener file must be added to `backend/src/core/events/listener-registry.ts` and registered in `registerAllListeners()`. Listener registration failures throw and abort startup (fail-fast). Do not add event listeners in route files or service constructors.

---

## [ADR-016] — JWT `jti` claim is NOT the session ID

**Date:** 2026-02-22
**Status:** Decided
**Decision:** The `jti` (JWT ID) in access tokens is a random hex string generated by `signJwtToken` at signing time. The session ID is carried separately in the JWT payload's `sessionId` field. They are never equal.
**Why:** `auth.service.ts` builds the JWT payload with `jti: session.id` but `signJwtToken` internally generates a fresh `jti` via `crypto.randomBytes`, overriding whatever is in the payload. This was discovered when debugging test failures. Changing `signJwtToken` to honour the caller's `jti` would be a bigger refactor than the benefit warrants — the `jti` only needs to be unique (which it is); the `sessionId` field already carries the session reference needed for revocation checks.
**Consequences:** Token revocation and session validation must read `payload.sessionId`, not `payload.jti`. Tests that verify the relationship between JWT claims and session records must use `sessionId`. The `jti` is only for JWT uniqueness guarantees.

---

## [ADR-017] — BullMQ is the sole scheduling system; node-cron and setInterval dead code deleted

**Date:** 2026-02-23
**Status:** Decided
**Decision:** All recurring scheduled work must use BullMQ. `node-cron` and `setInterval`-based schedulers are banned. Two dead scheduling files were deleted: `backend/src/core/jobs/auth-cleanup.jobs.ts` (node-cron) and `backend/src/modules/economy/jobs/economy.jobs.ts` (setInterval). These were never imported or called anywhere.
**Why:** Discovery during a scaffold audit (2026-02-23) found two parallel scheduling systems — node-cron dead code alongside active BullMQ jobs. The dead files scheduled overlapping work (auth cleanup, economy penalties) that was already registered in BullMQ, creating a future maintenance hazard. Keeping only BullMQ means one place to look (`core/jobs/register.ts`), one observability tool (Bull Board), and one retry/dead-letter strategy.
**Consequences:** `backend/src/core/jobs/` now contains only `register.ts`. Any new scheduled job gets a processor file in its module (`modules/[name]/jobs/[name].jobs.ts`), registers in `register.ts`, and dispatches in `workers.ts`. The `securityEventsService.cleanupOldEvents()` call (previously only in the deleted node-cron file) was migrated into the active BullMQ auth-cleanup job before deletion. The ADR-006 setInterval exception for ephemeral in-memory cleanup still applies.

---

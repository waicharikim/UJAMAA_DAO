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

## [ADR-009] — Embedded wallets: Privy chosen over Dynamic

**Date:** 2026-02-19 (closed 2026-02-24)
**Status:** Decided (Privy)
**Decision:** Use Privy for embedded wallet creation and social login. Dynamic was rejected.
**Why:** Privy wins on the factors that matter most for UjamaaDAO:
- Phone number is the primary Kenyan identity (Safaricom/M-Pesa number = the user's financial identity). Privy treats phone as a first-class login method; Dynamic treats it as secondary behind email/wallet.
- Target users have zero crypto experience. Privy hides seed phrases and shows no gas costs by default — designed for this use case. Dynamic's UX assumes some wallet familiarity (MetaMask users).
- Gasless-first via Pimlico paymaster is a first-class pattern in the Privy ecosystem (permissionless.js / viem account abstraction).
- Privy's SDK is lighter — suits low-data mobile users on 3G in rural wards.
- Dynamic is better for DeFi products where users arrive with existing MetaMask wallets. That is not UjamaaDAO's user.
- Cost: Privy has a generous free tier (usage-based). Dynamic is more expensive per MAU at scale.
**Consequences:** `@privy-io/react-auth` is installed and active (session 13). `frontend/contexts/wallet-context.tsx` wraps `PrivyProvider`. Implemented `loginMethods: ['email', 'wallet', 'google']` — phone login is not currently configured in the Privy SDK (phone remains the primary *identity* field on the User model, but the Privy entry point is email/embedded wallet). On wallet creation: `PATCH /api/v1/users/me/profile` with `walletAddress`. Gate on-chain features behind `user.walletAddress !== null`.

---

## [ADR-018] — Foundry as smart contract toolchain (over Hardhat)

**Date:** 2026-02-24
**Status:** Decided
**Decision:** Use Foundry (forge/cast/anvil) for all smart contract development, testing, and deployment. Hardhat rejected.
**Why:** Foundry is faster than Hardhat (Rust-based, no Node.js overhead), tests are written in Solidity (not JavaScript), has gas snapshots built in, and `anvil` provides a local EVM node with `--fork-url` for Base Sepolia forking. The `forge test` / `forge script` workflow is simpler and better matches a Solidity-native development style. Hardhat's advantage (extensive JavaScript integration) is unnecessary — we already have the TypeScript backend for off-chain logic.
**Consequences:** Smart contract source lives in `contracts/src/`. Tests in `contracts/test/` (Solidity `.t.sol` files). Deployment scripts in `contracts/script/`. Generated ABIs in `contracts/out/`. TypeScript bindings for the backend use `typechain` or `wagmi generate` against the ABI files. CI runs `forge build && forge test`.

---

## [ADR-019] — `contracts/` at repo root, not inside `backend/`

**Date:** 2026-02-24
**Status:** Decided
**Decision:** All smart contract code lives at `contracts/` (repo root), not under `backend/src/` or `backend/contracts/`.
**Why:** Smart contracts are a separate deployable artifact from the backend. They have their own build tool (Foundry), their own CI pipeline (`forge build`), and their own versioning / deployment lifecycle. Placing them inside `backend/` would create a dependency confusion (Foundry is not a Node.js tool). Placing them at root makes the monorepo structure explicit: `backend/` (TypeScript API), `frontend/` (Next.js), `contracts/` (Solidity), `docker/` (infrastructure).
**Consequences:** `contracts/` is a Foundry project. `backend/` imports compiled ABIs from `contracts/out/` for TypeScript bindings — ABI files are committed so the backend can compile without running `forge build`. ABI paths in backend: `contracts/out/PrToken.sol/PrToken.json` (relative path from repo root).

---

## [ADR-020] — Backend minter wallet pattern (hot wallet, separate from user wallets)

**Date:** 2026-02-24
**Status:** Decided
**Decision:** The backend uses a dedicated minter wallet (private key in `MINTER_PRIVATE_KEY` env var) to call `mint()` on the PR and UT contracts. This is entirely separate from user wallets (managed by Privy).
**Why:** On-chain PR and UT mint events must be signed by a trusted backend key, not by users. The minter wallet is a standard Ethereum EOA held by the platform. User wallets are created and managed by Privy (embedded wallets) — they receive minted tokens but cannot call `mint()` themselves (no `PR_MINTER_ROLE` or `UT_MINTER_ROLE`). Separating the minter wallet from Privy avoids coupling the platform's on-chain authority to a third-party SDK.
**Consequences:** `MINTER_PRIVATE_KEY` is a required env var for the backend worker (never the web process). The minter wallet address is stored in contract storage as the holder of `PR_MINTER_ROLE` / `UT_MINTER_ROLE`. Key rotation requires a `grantRole` / `revokeRole` transaction on both contracts. Backend `participationRights.service.ts` `award()` method will gain an `onChainMint()` call — skipped if `user.walletAddress` is null (unlinked wallet). Never commit `MINTER_PRIVATE_KEY` to git. Use a hardware wallet or KMS for production.

---

## [ADR-021] — Direct import exception: auth → user (`checkFullVerification`)

**Date:** 2026-02-24
**Status:** Decided (exception to ADR-007)
**Decision:** `auth.service.ts` directly imports `userService.checkFullVerification()` rather than publishing an event.
**Why:** `checkFullVerification` must run synchronously within the same request that completes email verification — the caller needs the updated verification level before issuing the JWT. An event would be fire-and-forget; the JWT could be issued before the FULL_VERIFIED promotion runs.
**Consequences:** This is the only permitted direct cross-module import in auth. All other cross-module side effects (PR award via `user.email.verified`, group enrollment) remain event-driven. Do not add further direct cross-module imports to auth without a new ADR.

---

## [ADR-022] — 7-day access token lifetime (no short-lived + refresh rotation)

**Date:** 2026-02-24
**Status:** Decided
**Decision:** Access tokens are valid for 7 days. There is no short-lived (15min) + refresh-token rotation pattern for the primary session flow.
**Why:** Magic link auth has no password. Re-authentication is low-friction — users just request a new link. A 7-day token prevents silent logout on mobile while users are in the field (variable connectivity). The `frontend/lib/api.ts` 401-refresh path exists as a safety net for edge cases but is not the primary session management strategy.
**Consequences:** Compromised sessions remain valid for up to 7 days unless explicitly revoked via `DELETE /auth/sessions/:id`. Revocation checks use `sessionId` in the JWT payload (see ADR-016, not `jti`). Revisit this decision if session revocation latency becomes a security concern at scale.

---

## [ADR-010] — Module build order

**Date:** 2026-02-19 (revised 2026-02-28)
**Status:** Revised — original proposed order was not followed
**Decision:** Original proposed order: Auth → Marketplace → Governance → Education → Emergency → Collective Project Loop. **Actual build order (as of 2026-02-28):** Auth → User → Economy → Community → Governance → Projects → Emergency → Education → Collective Project Loop.
**Why:** Everything depends on auth. The User and Economy modules turned out to be prerequisites for Community — community verification requires user profiles and PR economy to already exist. Governance requires verified community members, which in turn requires economy. Marketplace became lower priority because the core economic loop (dues, PR, commitments) had to exist before discovery was useful. Frontend development followed auth + user + economy (not auth + marketplace as originally planned).
**Consequences:** Marketplace is `partial` and lower priority than originally planned. Governance is the next major backend priority after community tests are green. The original build order should be treated as superseded — use the actual sequence above for planning future module work.

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

## [ADR-023] — Traefik disabled in dev; direct port access only

**Date:** 2026-02-27
**Status:** Decided
**Decision:** The Traefik reverse proxy service is commented out in `docker/docker-compose.yml` for the development environment. All services use direct host port mappings: API on `:4000`, frontend on `:3000`, MailHog on `:8025`, Redis on `:6380`, Postgres on `:5432`/`:5433`.
**Why:** Traefik was included early for production readiness but was never functional in dev — its ports (80, 443, 8080) were not binding to the host, routing through `localhost` was not working, and the dashboard was unreachable. It added a confusing non-functional container without providing any dev benefit. Direct port access is simpler, more debuggable, and sufficient for all current development work.
**Consequences:** In dev, access services at their direct ports — do not expect `app.localhost` or Traefik-routed hostnames to work. The `traefik.enable=true` labels and router labels on `web` and `frontend` services are harmless and stay in place — they will be picked up automatically when Traefik is re-enabled. Config files (`traefik/traefik.yml`, `traefik/acme.json`) are retained in the repo.
**To re-enable for production:** Uncomment the `traefik` service block in `docker/docker-compose.yml`, update `traefik/traefik.yml` with the production domain and Let's Encrypt email, ensure `traefik/acme.json` has `chmod 600`, remove direct `ports:` mappings from `web` and `frontend` services (or keep them alongside Traefik — both work), and run `make prod`.

---


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

## [ADR-004] — UT has two separate pools; only fiat-backed UT is cashable

**Date:** 2026-02-19 (clarified 2026-03-10)
**Status:** Decided (non-negotiable)
**Decision:** UT exists in two distinct, non-interchangeable pools. **Earned UT** (from education, referrals, contributions) has no cash-out path — ever. **Fiat-backed UT** (from M-Pesa deposits, 1 UT = 1 KES) can be withdrawn back to M-Pesa.
**Why:** An in-app cash-out path for earned UT creates farming incentives and speculative behavior — users would optimize for earning UT rather than real contribution. Fiat-backed UT must be cashable because it represents real money the user deposited; preventing withdrawal would be unacceptable and likely illegal. The two-pool design preserves the integrity of earned UT while respecting user ownership of deposited funds.
**Consequences:**
- DB schema must track `fiatBackedUtBalance` and `earnedUtBalance` as separate columns (never merged).
- Withdrawal endpoints draw only from `fiatBackedUtBalance`.
- UI must label earned UT clearly as "platform perks only" with no cash-out option shown.
- Any endpoint or feature that converts earned UT to currency is rejected.
- See `docs/treasury.md` for full cash-out flow design.

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
**Consequences:** No Jest. No Mocha. All test files use `.test.ts` suffix. All tests (both service unit tests and route integration tests) use the real `ujamaa_postgres_test` DB — no Prisma mocking. Always run inside the container: `docker exec -e RUNNING_IN_DOCKER=true ujamaa_web npx vitest run`. Never run vitest on the host shell — test DB is only reachable inside Docker.

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

## [ADR-024] — Baraza integration: WhatsApp webhook pattern, multi-group scope

**Date:** 2026-03-02
**Status:** Decided
**Decision:** The Baraza integration module supports Telegram, WhatsApp, and Discord.
WhatsApp uses a webhook-receive pattern (no bot token); Telegram and Discord use bot
token APIs. All three share a single `integrationQueue`. Bot tokens are worker-only env vars.
**Why:** WhatsApp's official API requires a business account + Meta approval and uses
an inbound webhook model — there is no "bot token" to send outbound messages without
prior user initiation. Telegram and Discord have first-class bot APIs. Keeping all three
in one module and one queue simplifies observability. Worker-only placement follows the
principle that secrets should be on the service that needs them, not broadcast to all.
**Consequences:** `DISCORD_BOT_TOKEN` goes in the `worker:` env block only. `TELEGRAM_BOT_TOKEN` goes on **both** `web` and `worker` — web needs it to validate incoming webhook signatures on `POST /api/v1/integration/telegram/webhook`; worker needs it to send messages and process bot jobs. No `WHATSAPP_BOT_TOKEN` env var — it would be unused. The `BarazaGroup`
model has `@@unique([groupId, platform, externalId])` to prevent duplicates when a user
joins multiple groups on the same platform. A user's messaging profile is global (not
per-group) — one `UserMessagingProfile` row per platform per user.

---

## [ADR-023] — Traefik disabled in dev; direct port access only

**Date:** 2026-02-27
**Status:** Decided
**Decision:** The Traefik reverse proxy service is commented out in `docker/docker-compose.yml` for the development environment. All services use direct host port mappings: API on `:4000`, frontend on `:3000`, MailHog on `:8025`, Redis on `:6380`, Postgres on `:5432`/`:5433`.
**Why:** Traefik was included early for production readiness but was never functional in dev — its ports (80, 443, 8080) were not binding to the host, routing through `localhost` was not working, and the dashboard was unreachable. It added a confusing non-functional container without providing any dev benefit. Direct port access is simpler, more debuggable, and sufficient for all current development work.
**Consequences:** In dev, access services at their direct ports — do not expect `app.localhost` or Traefik-routed hostnames to work. The `traefik.enable=true` labels and router labels on `web` and `frontend` services are harmless and stay in place — they will be picked up automatically when Traefik is re-enabled. Config files (`traefik/traefik.yml`, `traefik/acme.json`) are retained in the repo.
**To re-enable for production:** Uncomment the `traefik` service block in `docker/docker-compose.yml`, update `traefik/traefik.yml` with the production domain and Let's Encrypt email, ensure `traefik/acme.json` has `chmod 600`, remove direct `ports:` mappings from `web` and `frontend` services (or keep them alongside Traefik — both work), and run `make prod`.

---

## [ADR-025] — Activity-gated PR regeneration (prevents inactive whale accumulation)

**Date:** 2026-03-10
**Status:** Decided
**Decision:** Monthly PR regeneration is only awarded to users who meet a minimum activity threshold in the prior month. Users who fail the threshold receive 0 regen that month.
**Why:** A pure additive regeneration model (everyone gets +X PR regardless of activity) creates a free-riding problem: inactive users slowly accumulate governance power over active contributors, because they never spend PR or incur penalties. This is the opposite of what a healthy DAO wants. Activity-gating ensures regeneration rewards continued participation, not mere existence.
**Activity threshold (must meet all of):**
- Logged in at least once in the prior 30 days
- AND at least one of: cast a vote / paid dues on time / made a marketplace transaction / gave a vouch
**Consequences:** Monthly regen job (`monthly-pr-regeneration`) must query for eligible users before awarding. Users should see a clear indicator in-app of whether they are on track to receive regen this month. See `docs/economy-design.md` for full regeneration table.

---

## [ADR-026] — Soft PR inactivity decay (60-day threshold, 5%/month, 100 PR floor)

**Date:** 2026-03-10
**Status:** Decided
**Decision:** After 60 consecutive days of no qualifying activity (same threshold as ADR-025), a user's PR balance decays by 5% per month until they return to activity. Decay stops at a minimum floor of 100 PR.
**Why:** Activity-gated regen (ADR-025) prevents inactive users from growing. Soft decay ensures that long-term inactive users also lose relative influence — their existing balance slowly decreases, not just stagnates. This preserves meritocracy without being punitive (100 PR floor means a returning user is never completely locked out of governance).
**Consequences:** `daily-commitment-penalties` job (or a new `monthly-inactivity-decay` job) must calculate decay for users past the 60-day threshold. Decay must be logged in the audit trail with reason `PR_INACTIVITY_DECAY`. Users approaching the 60-day mark should receive a notification warning. See `docs/economy-design.md` for full decay mechanics.

---

## [ADR-027] — Landing page rendered as static HTML; other pages remain SSR per Next.js defaults

**Date:** 2026-03-12
**Status:** Decided
**Decision:** `app/page.tsx` exports `export const dynamic = 'force-static'`, pre-rendering it at build time. All authenticated pages remain SSR.
**Why:** Netlify Lighthouse showed TTFB of 2,550ms on the landing page — caused by a cold start on the Netlify Lambda that wraps SSR pages. The landing page has zero dynamic server-side data; it is a pure marketing page. Static generation moves it to CDN edge with ~10ms TTFB. Authenticated pages cannot be statically generated because they depend on user sessions.
**Consequences:** Landing page content that changes between deploys must be fetched client-side via `useEffect` + TanStack Query, not at render time.

---

## [ADR-028] — `modularizeImports` for lucide-react is incompatible with `@privy-io/react-auth` v3.14+

**Date:** 2026-03-12
**Status:** Decided
**Decision:** `modularizeImports` for `lucide-react` must not be added to `next.config.mjs` while Privy is a dependency.
**Why:** `modularizeImports` rewrites all `import { X } from 'lucide-react'` — including Privy's internal imports. Privy v3.14+ uses `FingerprintIcon` internally, which was added to lucide-react after v0.294 (our pinned version). With the transform applied, Webpack resolves to `lucide-react/dist/esm/icons/fingerprint-icon` which does not exist in v0.294, causing a hard build error. The documented comment in `next.config.mjs` records this for future maintainers.
**Consequences:** lucide-react tree-shaking relies on Webpack/Turbopack default behaviour. If lucide-react is upgraded past v0.355+, `modularizeImports` can be reconsidered.

---

## [ADR-029] — Internal GraphQL layer deferred until post-launch profiling confirms N+1 problems

**Date:** 2026-03-16
**Status:** Deferred — revisit after all modules reach `tested` status and real traffic data exists
**Decision:** Do not implement an internal GraphQL layer (REST public + GraphQL internal + DataLoader) at this stage of development.
**Why:** The exploration document (`ai_workflows/graphql-exploration.md`) correctly identifies the architectural pattern and its benefits. However, three conditions must be true before the investment is justified — and none are currently met:
1. **The N+1 problem doesn't exist yet.** All current services use `prisma.findMany({ include: {...} })`, which Prisma resolves as a single JOIN. The document's worst-case scenario (for-loop with individual queries) is not the current coding pattern.
2. **Modules are still being built.** Adding a GraphQL resolver layer before the remaining modules (education, marketplace, emergency, treasury, verification, reputation) are complete doubles the implementation work for each — REST handler AND GraphQL resolver for every endpoint.
3. **No production profiling data.** We do not know which endpoints are actually slow. Optimising without measurement is premature.
The current `Promise.all([...])` pattern for multi-table aggregation (e.g. admin stats: 8 concurrent Prisma calls) performs adequately and is straightforward to reason about.
**Consequences:** When to revisit:
- All modules reach `tested` status
- Real or load-tested traffic shows specific slow endpoints
- The governance/proposal list endpoint (proposals + authors + vote tallies + ward info at scale) is the most likely first candidate for DataLoader batching
**Reference:** `ai_workflows/graphql-exploration.md` — full implementation plan preserved for when the time is right.

---

## [ADR-030] — Marketplace listings require COMMUNITY_VERIFIED verification level

**Date:** 2026-03-16
**Status:** Decided
**Decision:** `POST /marketplace/create` and `PATCH /marketplace/:id/deactivate` require the caller to have `verificationLevel: COMMUNITY_VERIFIED` or higher. `EMAIL_VERIFIED` users may browse but not post.
**Why:** The marketplace connects ward members for real-world transactions. A listing is a public claim of identity and availability — it should only be made by someone who has been vouched for by the community. Community verification is the accountability layer that justifies the trust implied by a marketplace listing. Allowing email-only users to list would undermine this trust signal and conflict with the "verified ward members" intent in the product brief.
**Consequences:** `authorize({ verificationLevel: 'COMMUNITY_VERIFIED' })` middleware is applied to all listing mutation routes. The frontend hides the "List" button for non-verified users and shows a verification gate banner with an explanation. `makeMarketplaceToken` in test helpers must emit `COMMUNITY_VERIFIED` tokens — update when adding new marketplace test helpers.

---

## [ADR-031] — PostgreSQL enum value migration via type recreation, not `ADD VALUE`

**Date:** 2026-03-16
**Status:** Decided
**Decision:** When renaming or replacing enum values in a Prisma migration, use `CREATE TYPE _new AS ENUM (...)` + `ALTER COLUMN ... USING CASE` + `DROP TYPE` + `RENAME` in a single migration SQL file. Do not use `ADD VALUE IF NOT EXISTS` followed by column data updates in the same transaction.
**Why:** PostgreSQL error `55P04` ("unsafe use of new enum value within a transaction") is triggered when `ADD VALUE` is used to add enum values and those new values are then referenced in the same transaction (e.g. via `UPDATE ... SET col = 'NEW_VALUE'` or a `USING CASE` expression). Prisma migration files run as single transactions by default. The type-recreation pattern bypasses this restriction entirely because no single statement references a "newly added" value — the old type is replaced atomically.
**Consequences:** Any future migration that renames or replaces enum values must follow the full recreation pattern. The pattern is: (1) `CREATE TYPE "T_new" AS ENUM ('val1', 'val2', ...)`, (2) `ALTER TABLE t ALTER COLUMN c TYPE "T_new" USING CASE WHEN c::text = 'OLD' THEN 'NEW'::"T_new" ELSE c::text::"T_new" END`, (3) `DROP TYPE "T"`, (4) `ALTER TYPE "T_new" RENAME TO "T"`. Adding entirely new values that don't require data migration can still use `ADD VALUE`, as long as no query in the same transaction references the new value.

---

## [ADR-032] — Governance review chain uses actual location IDs, not locationScope enum

**Date:** 2026-03-17
**Status:** Decided
**Decision:** Proposal review routing reads the group's `wardId`, `constituencyId`, and `countyId` fields directly, rather than the `locationScope` enum value, to determine which system role can approve a proposal moving from `PENDING_REVIEW` to `APPROVED_FOR_VOTING`.
**Why:** The `locationScope` field on voluntary groups was hardcoded to `WARD` at creation time regardless of whether the group had actually set a wardId. Using the enum for routing produced incorrect results — a group with no wardId and `locationScope: WARD` would appear to have a ward-level approver when there was none. Reading the concrete ID fields (`wardId` / `constituencyId` / `countyId`) reflects the real affiliation and maps cleanly to the correct role: `location:ward_admin` for wardId, `location:constituency_admin` for constituencyId, `location:county_admin` for countyId, and `system:compliance_officer` as the final fallback. This is implemented via the `canLocationAdminApprove()` helper in `governance.service.ts`.
**Consequences:**
- `createVoluntaryGroup` must accept optional `wardId`, `constituencyId`, `countyId` parameters so groups can declare their location affiliation at creation. Groups without any location set may only create GROUP-scoped proposals (internal group matters that need no external review).
- `ProposalScope` enum (GROUP / COMMUNITY) determines the review path: GROUP-scoped proposals for voluntary groups go directly from LEADER approval → `APPROVED_FOR_VOTING` (internal group matters do not require external oversight). COMMUNITY-scoped proposals require a location affiliation to be set; if none is set, the creation call is blocked with a clear error — floating proposals with no geographic anchor have no defined approval chain.
- Co-funding fields `groupFundingAmount` and `locationFundingRequest` are stored on the Proposal model now to prevent a future schema lock-in, but disbursement logic is intentionally deferred to the Treasury module. The fields exist, have no business logic wired, and will remain dormant until Treasury is built.
- `UNDER_REVIEW` is removed from Prisma's schema mapping (no code path produces this status) but is intentionally retained in the PostgreSQL enum definition — dropping PostgreSQL enum values is not supported. If a future migration replaces the entire `ProposalStatus` enum, the type-recreation pattern from ADR-031 applies.

---

## [ADR-033] — Activity feed is audit-log sourced, not social-post sourced

**Date:** 2026-03-19
**Status:** Decided
**Decision:** The platform activity feed (`GET /api/v1/feed`) reads from the existing `audit_logs` table filtered to 9 public-safe event types. There are no user-generated posts, reactions, or comments.
**Why:** UjamaaDAO is a civic governance platform, not a social network. A social feed would require content moderation infrastructure, create engagement-farming incentives, and shift the platform's identity toward interaction metrics rather than collective action. The audit log already captures the civic events worth surfacing (proposals submitted, votes cast, milestones approved, groups formed, emergencies reported) — surfacing these gives the platform visible pulse without building anything new.
**Consequences:**
- No `Post`, `PostReaction`, or `PostComment` models will be added to the schema. Any PR introducing these is rejected.
- Feed content is derived entirely from governance/community actions, not from user expression.
- Privacy rules are hard-coded in `feed.controller.ts`: voter identity is **never** shown (ballot secrecy); emergency reporter identity is **never** shown (reporter safety); other actors are shown as "First L." format only; financial fields are stripped from `meta` via `safeMeta()`.
- The 9 allowed event types: `PROPOSAL_CREATED`, `PROPOSAL_STATUS_CHANGED`, `PROPOSAL_VOTE_CAST`, `GROUP_CREATED`, `GROUP_JOINED`, `PROJECT_CREATED`, `MILESTONE_SUBMITTED`, `MILESTONE_VERIFIED`, `EMERGENCY_REPORTED`.
- Feed requires authentication (`router.use(authenticate)`) — no anonymous/public access even though the data is public-safe. This prevents scraping and keeps all interaction traceable.

---


## [ADR-034] — Dues earn UT only; PR comes from participation only

**Date:** 2026-03-25
**Status:** Decided
**Decision:** Monthly dues payments earn `fiatBackedUtBalance` (1 UT per 1 KES paid) only. Dues payments no longer award any Participation Rights (PR). PR is earned exclusively through participation: baraza attendance, casting votes, completing education modules, delivering projects, emergency responses, and peer vouches.
**Why:** Tying dues to PR made governance power partially proportional to wealth. A Sponsor member paying KES 1,000/month accumulated PR 5× faster than an Ordinary member paying KES 60/month. In a cooperative rooted in Ujamaa philosophy, one person's vote should not weigh more because they can afford a higher dues tier. Financial contribution funds the platform's operation — it does not confer political standing. Governance power should reflect engagement and commitment of time and effort, not money.
**Consequences:**
- `DUES_CONFIG.TIERS` no longer contains a `prReward` field. The `prReward` fields (100/200/500) are removed.
- `dues.service.ts recordPayment()` no longer calls `participationRightsService.award()`. The UT award (`fiatBackedUtBalance += amountKes`) remains.
- `ParticipationRightsReason.DUES_ORDINARY/SUPPORTER/SPONSOR` remain in the enum for historical log records but are never written by new code.
- Commitment breach penalties (`DUES_PENALTY` reason, PR spend) remain — opting into a commitment and then breaking it still has a governance consequence. Voluntary commitment is not the same as a one-time payment.
- The governance page tiers display now shows "+{kes} UT/month" instead of "+{pr} PR/month".
- Platform config keys `tier_ordinary_pr`, `tier_supporter_pr`, `tier_sponsor_pr` are removed from the database and from seed.ts.
- Higher dues tiers continue to be meaningful: more UT (marketplace standing, treasury participation, fiat-backed value) and platform sustainability contribution. They just don't buy votes.

---

## [ADR-035] — WebAuthn challenge state stored in database, not server session

**Date:** 2026-03-27
**Status:** Decided
**Decision:** WebAuthn registration and authentication challenge values are stored in a `WebAuthnChallenge` Prisma model (short-lived DB row, 5-minute TTL) rather than in a server session or in-memory store. Registration challenges are keyed by `userId`; authentication challenges are keyed by `email`.
**Why:** The backend is stateless and JWT-based — there are no server sessions (ADR-022 documents the 7-day stateless JWT approach). WebAuthn requires the server to store a challenge between the options request and the verify request. The alternatives were: (1) encode the challenge in a signed JWT returned to the client and verified on the second call — this works but requires the client to carry and present the challenge, which is non-standard and complicates the SimpleWebAuthn flow; (2) use Redis with a short TTL — adds an operational dependency for a small feature; (3) DB row with `expiresAt` — consistent with existing `EmailVerificationToken` and `PasswordReset` patterns in the auth module, adds no new infrastructure, and TTL enforcement is handled by querying `expiresAt > now()` at verify time. The DB pattern is already proven in the codebase and keeps the auth module self-contained.
**Consequences:**
- `WebAuthnChallenge` model added to `backend/src/modules/auth/prisma/schema.prisma`. Migration `20260326131514_add_webauthn_challenges`.
- `generateRegistrationOptions` writes `{ challenge, userId, expiresAt: now + 5min }`.
- `generateAuthenticationOptions` writes `{ challenge, email, expiresAt: now + 5min }`.
- `verifyRegistration` and `verifyAuthentication` read the challenge, check TTL, then delete the row.
- Stale challenges (TTL expired but not yet queried) accumulate in the DB. An auth-cleanup BullMQ job should be extended to prune `WebAuthnChallenge` rows older than 10 minutes. Not yet implemented — low volume, not urgent.
- Only one pending challenge per userId (or email) is stored at a time — new options calls overwrite the previous row via upsert to prevent unbounded accumulation.

---

## [ADR-036] — Buni (KCB) as the sole payment provider; Flutterwave removed

**Date:** 2026-05-09
**Status:** Decided
**Decision:** UjamaaDAO uses Buni by KCB exclusively for M-Pesa STK push payments. Flutterwave (card payments) has been removed entirely.
**Why:** UjamaaDAO is Kenya-focused and M-Pesa is the dominant payment rail for the target demographic — rural and peri-urban ward members. Card payments via Flutterwave added integration complexity, required a separate SDK, and served a use case (card payments) that almost none of the intended users would use. Buni by KCB provides the Safaricom STK push flow directly, aligns with Rule 2 (real money via M-Pesa to platform accounts), and reduces the payment surface to a single, well-understood path.
**Consequences:**
- `PaymentMethod` type is now `'MPESA'` only — no `'CARD'` value.
- `POST /payments/initiate` only triggers an STK push. No card payment link is ever returned.
- `POST /payments/webhook` (Flw card callback) removed; `POST /payments/webhook/buni` remains.
- `flutterwave-node-v3` package removed from `backend/package.json`.
- `FLW_*` env vars removed from `docker/docker-compose.yml` and `docker/.env`.
- Buni credentials: `BUNI_CLIENT_ID`, `BUNI_CLIENT_SECRET`, `BUNI_BASE_URL` (defaults to UAT sandbox URL) in `docker/.env`.
- Callback URL: Buni sandbox requires a publicly reachable HTTPS URL. In dev, use a `localhost.run` SSH tunnel and set `BASE_URL` in `docker/.env`. In production, this will be the real domain.
- The STK push flow is async: `initiatePayment` returns `{ txRef }` immediately; Buni calls `POST /payments/webhook/buni` when the user approves or the prompt times out.

---

## [ADR-037] — QR witness-chain model for physical work presence verification

**Date:** 2026-05-11
**Status:** Decided
**Decision:** Physical work presence is verified via a QR witness-chain model. A session creator generates a `WorkSession` with a cryptographically random `qrSecret` (48 hex chars from `crypto.randomBytes(24)`). Any participant who scans the QR is recorded at depth 0 (direct witness). Each checked-in member may attest up to 2 other people who are physically present but lack smartphones; attested members are recorded at `attestor.depth + 1`. Sessions auto-close via a BullMQ delayed job at `expiresAt`. Auto-close applies status `APPROVED` only if ≥1 `WorkPresence` at depth 0 exists; otherwise `FLAGGED` for leader review. On `APPROVED`, all presences receive 10 Impact Points regardless of depth.
**Why:** Physical community work (digging boreholes, building classrooms) must be verified without excluding members who do not own smartphones. A pure scan-only model penalises the demographic least likely to have phones — exactly the people UjamaaDAO is built for. A pure social-attestation model (no QR at all) is trivially gamed by false claims. The witness chain balances both: one person physically present with a phone anchors the chain; that person's word attests to their neighbours. The ≥1 depth-0 guard closes the remote-sharing loophole (sharing the QR link in a chat group to fake attendance) while keeping the attest flow open for legitimate non-smartphone users.
**Consequences:**
- `WorkSession` model: `qrSecret @unique`, `expiresAt`, `status WorkSessionStatus` (OPEN/APPROVED/FLAGGED), `closeJobId` (BullMQ job reference), relations to Milestone/Project/User.
- `WorkPresence` model: `depth Int`, `attestedById String?`, `@@unique([sessionId, userId])`.
- Migration: `20260511113241_add_work_session_qr`.
- `projectQueue` added to `core/queue/index.ts`; `WORK_SESSION_CLOSE` job in `work-session.jobs.ts`; `projectWorker` added to `workers.ts` (included in graceful shutdown).
- Queue `add()` is wrapped in try/catch — session creation succeeds and returns the QR secret even if Redis is temporarily unavailable (the session will require manual close if the job never fires).
- Attestation cap of 2 per person: prevents one person from attesting an entire group they did not actually witness; forces the chain to spread through multiple verified nodes.
- IP reward is flat (10 per person) not depth-weighted — depth-1+ members did the same work; their lower depth only reflects smartphone access, not contribution quality.

---

## [ADR-038] — Module-level Prisma schemas are the source of truth; merged output is never edited directly

**Date:** 2026-05-13
**Status:** Decided
**Decision:** All Prisma schema changes must be made in the module-level source files (`src/modules/[name]/prisma/schema.prisma` for module models; `src/core/database/base.prisma` for User back-relations and cross-cutting base types). The merged output at `prisma/schema.prisma` is generated by `mergeSchema.ts` and is overwritten on every container start. Editing it directly produces changes that silently disappear on the next `make dev` or container restart.
**Why:** The `start-web.sh` entrypoint runs `npm run db:merge` before `prisma generate` and `prisma migrate deploy` on every container start. Any edit to `prisma/schema.prisma` is overwritten within seconds of the next restart. This was discovered in session 63 when WorkSession/WorkPresence models were added to the merged file, regeneration confirmed 0 TS errors, but after a container restart `prisma generate` used the re-merged (reverted) schema and the errors returned. The root cause: the module-level schema files had never been updated.
**Consequences:**
- Schema changes require editing the module-level `.prisma` file (and `base.prisma` for User back-relations).
- After any schema edit, run `docker exec ujamaa_web npm run db:generate` inside the container — this runs the merge step first, then `prisma generate`. Never run bare `npx prisma generate` in the container; it skips the merge and leaves the client out of sync.
- The `prisma/schema.prisma` file should be committed after `db:merge` (its content reflects the latest module schemas), but it must never be hand-edited.
- Migrations are created and applied with `docker exec ujamaa_web npx prisma migrate dev --name <name>` after the merge and generate steps confirm the schema is correct.

---

## [ADR-039] — Dues allocation fans out across the geographic hierarchy; missing system group is a hard error

**Date:** 2026-05-18
**Status:** Decided
**Decision:** When a dues payment is recorded, `allocateDues()` distributes funds across all four geographic levels — Ward, Constituency, County, National — according to a configurable percentage split stored in `PlatformConfig` key `dues_allocation_split` (JSON). The default split is `{ WARD: 70, CONSTITUENCY: 15, COUNTY: 10, NATIONAL: 5 }`. Levels with percentage = 0 are silently skipped. If a level has a non-zero percentage but its system group does not exist in the database, the function throws `ApiError.systemError` rather than silently dropping the allocation.
**Why:** System groups for every geographic level (Ward, Constituency, County, and one National) are seeded at application launch from `seed.ts`, which walks the full Kenyan geographic hierarchy. A missing system group therefore indicates that the seed was not run, was interrupted, or data was manually deleted — a deployment or data integrity error, not a normal operating condition. Silently skipping would cause money to be permanently un-allocated with no alert. A hard error surfaces the problem immediately so an operator can re-run the seed. Percentage = 0 is intentional configuration and is legitimately skipped. The two cases must be treated differently.
**Consequences:**
- The seed must be run and complete fully before the first dues payment is processed. If any geographic system group is missing, dues payments will fail at the allocation step (the payment itself is already recorded; the allocation throws). Admin must re-run seed or manually create the missing group.
- Changing the split requires a SUPER_ADMIN to `POST /api/v1/admin/platform-config` with key `dues_allocation_split` and a new JSON value. No code change or redeploy is needed.
- The default 70/15/10/5 split is ward-first, reflecting UjamaaDAO's philosophy that local community has the strongest claim on dues. Higher levels get a share to sustain coordination infrastructure (constituency events, county initiatives, national platform operations).
- Treasury balances at constituency/county/national levels accumulate over time and can be disbursed via governance proposals at the appropriate geographic scope.

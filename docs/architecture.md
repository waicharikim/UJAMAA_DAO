# UjamaaDAO – System Architecture

**Last updated:** March 2026

---

## High-Level Overview

```
┌─────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│   Frontend      │────▶│   Backend REST API        │────▶│   Blockchain Layer   │
│   (Next.js)     │     │   Node.js / Express       │     │   Base L2 (Sepolia)  │
│   Port :3000    │     │   Port :4000              │     │   PrToken + UtToken  │
└─────────────────┘     └──────────────────────────┘     └──────────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         │   Worker Process    │
                         │   BullMQ queues     │
                         │   (background jobs) │
                         └─────────────────────┘
```

---

## Runtime Processes

Two fully decoupled processes run via Docker Compose:

| Process | Entry point | Purpose |
|---|---|---|
| `web` | `backend/src/index.ts` | REST API, serves all HTTP traffic |
| `worker` | `backend/src/workers.ts` | Background jobs + event listeners (no HTTP) |

Both connect to the same Postgres and Redis. Secrets with blast radius (`MINTER_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`) are on the `worker` env only — never `web`.

---

## Data Stores

| Store | Docker service | Host port | Purpose |
|---|---|---|---|
| PostgreSQL | `postgres` | 5432 | Primary database (Prisma ORM) |
| PostgreSQL test | `postgres_test` | 5433 | Isolated test DB |
| Redis | `redis` | 6380 | Rate limiting, sessions, BullMQ queues |
| MailHog | `mailhog` | 1025 (SMTP) · 8025 (UI) | Dev email catcher |
| Anvil | `ujamaa_anvil` | 8545 | Local EVM for blockchain dev |

---

## API Routes

All routes are mounted at `/api/v1/` in `backend/src/app.ts`.

| Module | Prefix | Status | Tests |
|---|---|---|---|
| auth | `/api/v1/auth` | tested | 104 |
| user | `/api/v1/users` | tested | 35 |
| economy | `/api/v1/economy` | tested | 34 |
| community | `/api/v1/community` | tested | 49 |
| governance | `/api/v1/governance` | tested | 47 |
| admin | `/api/v1/admin` | partial | 0 |
| projects | `/api/v1/projects` | partial | 0 |
| marketplace | `/api/v1/marketplace` | partial | 0 |
| notifications | `/api/v1/notifications` | partial | 0 |
| emergency | `/api/v1/emergency` | partial | 0 |
| audit | `/api/v1/audit` | partial | 0 |
| onboarding | `/api/v1/onboarding` | partial | 0 |
| integration | `/api/v1/integration` | partial | 0 |

Health endpoints: `GET /health` · `GET /ready` · `GET /api/v1/docs`

---

## Middleware Chain (Critical — order enforced in `app.ts`)

```
trust proxy → helmet/CORS → body parsing (10 MB limit)
→ context + correlation ID → request logging
→ global rate limiting → routes
→ cleanup → 404 handler → error handler
```

---

## Authentication

Primary authentication is **magic link (email-based)**:
- New users: `POST /auth/magic-link/send` → `GET /auth/verify-email?token=<hex>`
- Existing users: `POST /auth/magic-link/send` → `GET /auth/login?token=<jwt>`
- Token field: always `sessionToken`. Lifetime: 7 days. No short-lived/refresh rotation (ADR-022).

Secondary: wallet signature (`POST /auth/wallet/nonce` + `POST /auth/wallet/verify`).

---

## Verification Levels

```
UNVERIFIED
  └── EMAIL_VERIFIED        (after magic link verification)
       └── PHONE_VERIFIED   (after OTP)
            └── COMMUNITY_VERIFIED  (3 vouches or M-Pesa payment)
                 └── FULL_VERIFIED  (location proof — planned)
```

Most protected routes require `COMMUNITY_VERIFIED`. 2FA and wallet routes require `FULL_VERIFIED`.

---

## Background Jobs & Queues

Four BullMQ queues, all visible on Bull Board at `/admin/queues`:

| Queue | Jobs |
|---|---|
| `economy` | `monthly-pr-regeneration` (1st of month), `daily-commitment-penalties` (02:00) |
| `user-cleanup` | `user-cleanup` (every 4h), `auth-cleanup` (03:00) |
| `integration` | `baraza-attendance-reward`, `baraza-send-invite` |
| `dead-letter` | Failed jobs after max retries |

All new repeatable jobs must register in `backend/src/core/jobs/register.ts`.

---

## Event Bus

Cross-module communication uses the internal event bus (`backend/src/core/utils/eventBus.ts`).
Direct imports between modules are forbidden — use events.

| Event | Emitted by | Listeners |
|---|---|---|
| `user.created` | auth | economy, community, audit |
| `user.email.verified` | auth | economy (awards PR), community (enrolls system groups), audit |
| `auth.login` | auth | audit |
| `economy.commitment.breached` | economy | (no listeners yet) |

All new events must be typed in the event bus types file and documented here.

---

## Blockchain (Base L2)

**Status:** Contracts written and tested. Base Sepolia deploy pending (minter wallet not yet funded).

| Component | Status |
|---|---|
| `PrToken.sol` — soulbound ERC-20 | Written, 9 Foundry tests green |
| `UtToken.sol` — standard ERC-20 | Written, 4 Foundry tests green |
| `Deploy.s.sol` | Written, reads `MINTER_WALLET_ADDRESS` |
| Backend `getPrContract()` / `getUtContract()` | Live with null-guard |
| On-chain mint (PR award) | Wired in `participationRights.service.ts`, triple-guarded |
| Local dev via Anvil | `ujamaa_anvil` container on :8545 |

**Hybrid model (ADR-002):** On-chain = PR token, UT token, governance votes, treasury. Off-chain = profiles, discovery, education, emergency, chat, notifications.

**Embedded wallets:** Privy (`@privy-io/react-auth` v3.14.1) — ADR-009.

---

## Frontend

Next.js 16.1.6, React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Privy.

**Dev:** `next dev --turbopack` (port 3000)
**API client:** `frontend/lib/api.ts` — `authApi`, `userApi`, `economyApi`, `communityApi`, `governanceApi`, `integrationApi`, `notificationsApi`
**Auth context:** `frontend/contexts/auth-context.tsx` — magic link flow, auto-hydrate from localStorage
**Wallet context:** `frontend/contexts/wallet-context.tsx` — Privy integration

---

## Security

- **Helmet** — CSP/HSTS only in production.
- **CORS** — `ALLOWED_ORIGINS` env var (comma-separated). Defaults to `localhost:3000/3001`.
- **Rate limiting** — global + per-endpoint + dual (IP + per-user) on write endpoints.
- **RBAC** — `backend/src/core/rbac/roles.ts` — system roles: `SUPER_ADMIN`, `COMPLIANCE_OFFICER`, `COUNTY_COORDINATOR`, `BLOCKCHAIN_ADMIN`, `CONTRACT_DEPLOYER`, `MULTISIG_SIGNER`.
- **Correlation IDs** — `X-Correlation-ID` header generated per request, exposed in response.
- **Request body limit** — 10 MB.
- **Secrets** — `ENCRYPTION_KEY` (64-char hex) required for TOTP/2FA. Generate: `openssl rand -hex 32`.

---

## Dev Port Map

| Service | Host Port |
|---|---|
| Backend API | 4000 |
| Frontend | 3000 |
| Postgres | 5432 |
| Postgres test | 5433 |
| Redis | 6380 |
| MailHog SMTP | 1025 |
| MailHog UI | 8025 |
| Anvil (EVM) | 8545 |

Traefik is **disabled** in dev (ADR-023). Direct port access only.

---

## Key File Paths

| What | Path |
|---|---|
| App entry | `backend/src/app.ts` |
| Web server | `backend/src/index.ts` |
| Worker entry | `backend/src/workers.ts` |
| Docker Compose | `docker/docker-compose.yml` |
| Makefile | `backend/Makefile` |
| Jobs registry | `backend/src/core/jobs/register.ts` |
| Blockchain client | `backend/src/core/blockchain/client.ts` |
| Contracts | `contracts/src/PrToken.sol`, `contracts/src/UtToken.sol` |
| Frontend API client | `frontend/lib/api.ts` |
| Frontend auth context | `frontend/contexts/auth-context.tsx` |

---

## Observability

- **Logging** — Pino structured JSON, `operationType` field on every log line.
- **Bull Board** — `/admin/queues` (HTTP basic auth: `admin` / `DASHBOARD_PASSWORD`).
- **Audit log** — `GET /api/v1/audit/search` returns real records for active events.
- Prometheus + Grafana + Loki + Jaeger are configured but **disabled by default**.

# UjamaaDAO

UjamaaDAO is a neighborhood sovereignty platform for Kenyan wards — cooperative governance, community project funding, and a marketplace for skills and goods, rooted in Ujamaa philosophy (cooperative economics, familyhood).

**Core premise:** Real wards become self-reliant economic, governance, and resilience units. Money and labor are traceable to measurable outcomes — a borehole drilled, a skill trained, clean water flowing.

---

## Project Status (May 2026)

| Layer | Status |
|---|---|
| Backend API | ✅ Running — 22 routes mounted, **1398 tests green across 20 tested modules** |
| Prisma schema | ✅ 80 models, migrations applied, E2E flow verified |
| Docker/Infra | ✅ All services running (`make dev`) — API, worker, Postgres, Redis, frontend, MailHog, Anvil |
| Frontend | ✅ 30+ routes, Chai palette design system, magic-link + passkey auth, Privy wallet, PWA installable |
| Payments | ✅ M-Pesa STK push via Buni by KCB — end-to-end verified (push sent, callback received, DB updated) |
| Smart Contracts | 🔶 Written and tested — `PrToken.sol` (soulbound) + `UtToken.sol` + `GovernanceVoting.sol`, 13 Foundry tests green; Base Sepolia deploy pending (minter wallet not funded) |
| Observability | ✅ Sentry (backend + frontend), DataDog APM, BrowserStack wired |
| **Production** | ✅ **LIVE** — `ujamaadao.org` + `api.ujamaadao.org` on DigitalOcean droplet `167.71.55.51` |

---

## Repository Structure

```
UJAMAA_DAO/
├── backend/            # Node.js 22 + Express + Prisma backend
│   ├── src/
│   │   ├── app.ts          # Express app, middleware, route mounts (21 routes)
│   │   ├── index.ts        # Server entry, startup assertions, graceful shutdown
│   │   ├── workers.ts      # BullMQ worker (12 scheduled + 3 event-triggered jobs)
│   │   ├── core/           # Shared infrastructure (logger, queue, rbac, errors, blockchain)
│   │   └── modules/        # 21 feature modules
│   ├── prisma/             # Merged schema (80 models) + migrations
│   ├── tests/              # Vitest suites — 1398 tests, 20 tested modules
│   ├── Makefile            # All dev commands
│   └── .env.example
│
├── frontend/           # Next.js 16.1.6 frontend
│   ├── app/            # App Router pages (26+ routes)
│   ├── components/     # UI components (layout, auth, landing, dashboard, groups, …)
│   ├── contexts/       # Auth + wallet (Privy) + notification + language contexts
│   ├── lib/            # Typed API client (22 API namespaces)
│   └── stubs/          # Webpack stubs for unused Privy transitive deps
│
├── contracts/          # Solidity (Foundry) — Base L2
│   ├── foundry.toml
│   ├── src/            # PrToken.sol (soulbound ERC-20) + UtToken.sol
│   └── test/           # 13 Foundry tests green
│
├── docker/             # Docker Compose configs + environment
│   ├── docker-compose.yml          # Development stack (8 services)
│   └── docker-compose.prod.yml     # Production stack
│
├── traefik/            # Traefik reverse proxy config (disabled in dev — ADR-023)
│
└── docs/               # API and module documentation
```

---

## Getting Started

### Prerequisites
- Docker + Docker Compose
- Node.js 22 (for local schema tooling — all services run in Docker)

### Run Everything

```bash
cd backend
make dev
```

This starts: API (`:4000`), worker, PostgreSQL (`:5432`), PostgreSQL test (`:5433`), Redis (`:6380`), frontend (`:3000`), MailHog (`:8025`), Anvil EVM (`:8545`).

```bash
# On first run — apply migrations and seed
make db-migrate

# Check the API is healthy
curl http://localhost:4000/health
```

### Frontend
Visit **`http://localhost:3000`** — landing page, 4-step registration, dashboard, governance, groups, marketplace, and more.

### Dev Email (Magic Links)
Visit **`http://localhost:8025`** — MailHog catches all outgoing emails in development. No configuration needed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript strict mode |
| Framework | Express |
| Database | PostgreSQL 15 + Prisma ORM (80 models) |
| Queue | BullMQ + Redis — 12 scheduled jobs + 3 event-triggered |
| Logger | Pino (structured JSON, `operationType` context) |
| Testing | Vitest + Supertest — **1398 tests, 20 tested modules** |
| Auth | Email magic links (JWT + hex token), WebAuthn/passkeys, Africa's Talking SMS OTP |
| Payments | Buni by KCB — M-Pesa STK push (end-to-end verified) |
| Frontend | Next.js 16.1.6 (App Router + Turbopack), TanStack Query v5, Tailwind v3, shadcn/ui |
| Wallet | Privy (`@privy-io/react-auth` v3.14.1) — embedded wallets on Base L2 |
| Contracts | Foundry (forge/cast/anvil) — `PrToken` + `UtToken` + `GovernanceVoting`; Base Sepolia → Base Mainnet |
| Observability | Sentry (backend + frontend), DataDog APM, BrowserStack |
| Infra | Docker Compose (8 services), Traefik (disabled in dev) |
| CI | GitHub Actions — type-check · lint · prisma validate · build |

---

## Non-Negotiable Rules

1. **Marketplace = discovery only.** No payments, no escrow, no checkout UI.
2. **Real money via M-Pesa to platform accounts.** Never P2P.
3. **Blockchain is hybrid.** On-chain: governance records, PR/UT tokens. Off-chain: all UX.
4. **PR token is soulbound.** Earned UT has no cash-out path.
5. **Everything runs in Docker.** Use service names (`postgres`, `redis`), not `localhost`.

---

## Authentication Flow

UjamaaDAO supports three login methods — no passwords.

| Method | Flow |
|---|---|
| **Email magic link (new user)** | 4-step registration form → email verification link → session token |
| **Email magic link (returning user)** | Enter email → magic link email → click → session token |
| **WebAuthn / passkey** | Register biometric from profile → subsequent logins via `PasskeyLoginButton` (Face ID, Touch ID, etc.) |
| **Wallet signature** | Privy embedded wallet → nonce challenge → sign → session |

Token lifetime: 7 days. No short-lived/refresh rotation — single `sessionToken` field in all responses.

---

## Verification Levels

Users progress through verification gates. Most API endpoints require `COMMUNITY_VERIFIED`.

```
UNVERIFIED → EMAIL_VERIFIED → PHONE_VERIFIED → COMMUNITY_VERIFIED → FULL_VERIFIED
```

- `EMAIL_VERIFIED` — after clicking magic link or verification email
- `PHONE_VERIFIED` — after SMS OTP
- `COMMUNITY_VERIFIED` — 3 vouches from ward members OR M-Pesa verification payment
- `FULL_VERIFIED` — wallet linked + location proof

---

## Background Jobs

12 scheduled jobs + 3 event-triggered, running on 6 BullMQ queues:

| Queue | Scheduled Jobs |
|---|---|
| `economy` | Monthly PR regeneration (1st), monthly PR inactivity decay (1st), daily commitment penalties (02:00), dues reminder (08:00, fires days 26–28) |
| `governance` | Schedule elections (1st, 01:00), open nominations (daily 00:15), open voting (daily 00:20), tally results (daily 00:25) |
| `user-cleanup` | User cleanup (every 4h), auth cleanup (03:00) |
| `integration` | Baraza attendance reward, Baraza send invite, Baraza session reminder (event-triggered) |
| `notifications` | Dues reminder (scheduled above, visible here) |
| `dead-letter` | Failed jobs after max retries |

Bull Board dashboard: `http://localhost:4000/admin/queues` (HTTP basic auth: `admin` / `DASHBOARD_PASSWORD` env var).

---

## M-Pesa Payments

Payments use **Buni by KCB** — Kenya's KCB Bank M-Pesa STK push integration.

Flow:
1. `POST /api/v1/payments/initiate` — triggers STK push to user's phone
2. Buni calls `POST /api/v1/payments/webhook/buni` with the result (~30 seconds later)
3. `GET /api/v1/payments/status/:txRef` — poll payment status

All payments go to platform-controlled M-Pesa accounts. No P2P transfers.

---

## Documentation

| File | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System architecture, ports, middleware, queues, blockchain |
| [`docs/auth-api.md`](docs/auth-api.md) | Auth endpoints — magic link, passkeys, wallet, 2FA, sessions |
| [`docs/user-api.md`](docs/user-api.md) | User profile, industries, goods/services, verification |
| [`docs/group-api.md`](docs/group-api.md) | Community groups, members, declarations, conflicts |
| [`docs/proposal-api.md`](docs/proposal-api.md) | Governance proposals, voting, memory layer |
| [`docs/economy-api.md`](docs/economy-api.md) | PR balance, dues, commitments, UT withdrawals |
| [`docs/economy-design.md`](docs/economy-design.md) | Token mechanics — PR, UT, Impact Points design rationale |
| [`docs/payments-api.md`](docs/payments-api.md) | M-Pesa STK push via Buni — initiate, webhook, status |
| [`docs/notifications-api.md`](docs/notifications-api.md) | In-app notifications, preferences, mark-read |
| [`docs/marketplace-api.md`](docs/marketplace-api.md) | Listing discovery (no payments) |
| [`docs/verification-api.md`](docs/verification-api.md) | Community verification — vouching, payment fallback |
| [`docs/emergency-api.md`](docs/emergency-api.md) | Incident reporting and alert lifecycle |
| [`docs/education-api.md`](docs/education-api.md) | Learning modules, completion tracking |
| [`docs/reputation-api.md`](docs/reputation-api.md) | Impact Points, leaderboard, ward reputation |
| [`docs/onboarding-api.md`](docs/onboarding-api.md) | Onboarding progress, tutorial completion |
| [`docs/elections-api.md`](docs/elections-api.md) | Group elections, nominations, voting, tally |
| [`docs/integration-api.md`](docs/integration-api.md) | Baraza messaging (Telegram/WhatsApp/Discord) |
| [`docs/audit-api.md`](docs/audit-api.md) | Audit log search and activity feed |
| [`docs/admin-api.md`](docs/admin-api.md) | Admin panel — users, stats, config, Baraza management |
| [`docs/treasury.md`](docs/treasury.md) | Treasury structure, M-Pesa flows, UT two-pool model |
| [`docs/posts-api.md`](docs/posts-api.md) | Ward posts (notices, announcements, resources) — geo-cascade feed |
| [`docs/whitepaper.md`](docs/whitepaper.md) | Project vision and philosophy |
| [`docs/features.md`](docs/features.md) | Feature inventory by module |
| [`docs/ecosystem.md`](docs/ecosystem.md) | Ecosystem overview |

---

## License

[License TBD]

# UjamaaDAO

UjamaaDAO is a neighborhood sovereignty platform for Kenyan wards — cooperative governance, community project funding, and a marketplace for skills and goods, rooted in Ujamaa philosophy (cooperative economics, familyhood).

**Core premise:** Real wards become self-reliant economic, governance, and resilience units. Money and labor are traceable to measurable outcomes — a borehole drilled, a skill trained, clean water flowing.

---

## Project Status (March 2026)

| Layer | Status |
|---|---|
| Backend API | ✅ Running — 16 modules, 15 fully tested (679 tests green, 42 test files), CI green |
| Prisma schema | ✅ 83 models, migrations applied, E2E flow verified |
| Docker/Infra | ✅ All services running (`make dev`) — API, worker, postgres, redis, frontend, MailHog |
| Frontend | ✅ Active — 17 routes, Chai palette design system, magic-link auth, Privy wallet |
| M-Pesa | 🔶 Stubbed — service exists, always returns success (real Daraja API integration pending) |
| Smart Contracts | 🔶 Written and tested — `PrToken.sol` (soulbound) + `UtToken.sol`, 13 Foundry tests green; Base Sepolia deploy pending (minter wallet not funded) |

---

## Repository Structure

```
UJAMAA_DAO/
├── backend/            # Node.js 22 + Express + Prisma backend
│   ├── src/
│   │   ├── app.ts          # Express app, middleware, route mounts
│   │   ├── index.ts        # Server entry, startup assertions
│   │   ├── workers.ts      # BullMQ worker entry (4 background jobs)
│   │   ├── core/           # Shared infrastructure (logger, queue, rbac, errors…)
│   │   └── modules/        # Feature modules (auth, user, economy, community, …)
│   ├── prisma/             # Merged schema (83 models) + migrations
│   ├── tests/              # Vitest suites — 679 tests (42 test files, all modules)
│   ├── Makefile            # All dev commands
│   └── .env.example
│
├── frontend/           # Next.js 15 frontend
│   ├── app/            # App Router pages (15 routes)
│   ├── components/     # UI components (layout, auth, landing, dashboard…)
│   ├── contexts/       # Auth + wallet (Privy) contexts
│   ├── lib/            # Typed API client (authApi, userApi, economyApi)
│   └── stubs/          # Webpack stubs for unused Privy transitive deps
│
├── contracts/          # Solidity (Foundry) — Base L2
│   ├── foundry.toml
│   ├── src/            # PrToken.sol (soulbound ERC-20) + UtToken.sol
│   └── test/           # 13 Foundry tests green
│
├── docker/             # Docker Compose configs
│   ├── docker-compose.yml          # Development stack
│   └── docker-compose.prod.yml     # Production stack
│
├── traefik/            # Traefik reverse proxy config
│
├── ai_workflows/       # Claude AI context files (project brain)
│   ├── CLAUDE.md       # Full project context — read every session
│   ├── SESSION_STATE.md # Live snapshot — read this first
│   ├── PROGRESS_LOG.md # Session history
│   ├── DECISIONS.md    # All ADRs (ADR-001 through ADR-022)
│   └── AGENTS.md       # Claude agent hats and workflow
│
└── docs/               # API and module documentation (auth, user, economy, community, governance, …)
```

---

## Getting Started

### Prerequisites
- Docker + Docker Compose
- Node.js 22 (for local schema tooling and frontend build — all services run in Docker)

### Run Everything

```bash
cd backend
make dev
```

This starts: API (`:4000`), worker, PostgreSQL, Redis, frontend (`:3000`), MailHog (`:8025`).

```bash
# On first run — apply migrations
make db-migrate

# Check the API is healthy
curl http://localhost:4000/health
```

### Frontend
Visit **`http://localhost:3000`** — full UI with landing page, registration, and dashboard.

### Dev Email (Magic Links)
Visit **`http://localhost:8025`** — MailHog catches all outgoing emails in development.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript strict |
| Framework | Express |
| Database | PostgreSQL 15 + Prisma ORM (83 models) |
| Queue | BullMQ + Redis |
| Logger | Pino (structured, `operationType` context) |
| Testing | Vitest + Supertest — 679 tests, 42 test files, CI green |
| Auth | Email magic links (JWT + hex token), Africa's Talking SMS |
| Frontend | Next.js 16 (App Router + Turbopack), TanStack Query v5, Tailwind v3, shadcn/ui |
| Wallet | Privy (`@privy-io/react-auth` v3.14.1) — embedded wallets on Base L2 |
| Contracts | Foundry (forge/cast/anvil) — Base Sepolia → Base Mainnet |
| Infra | Docker Compose + Traefik reverse proxy |
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

UjamaaDAO uses **email magic links** — no passwords, no seed phrases.

- **New users**: 4-step registration form → email verification link → session token
- **Returning users**: Enter email on landing page → magic link email → session token
- **Wallet**: Privy embedded wallet created automatically on first login (invisible to user)

---

## Documentation

| File | Contents |
|---|---|
| [`ai_workflows/SESSION_STATE.md`](ai_workflows/SESSION_STATE.md) | Live project snapshot — read first each session |
| [`ai_workflows/CLAUDE.md`](ai_workflows/CLAUDE.md) | Full project context, module status, conventions |
| [`ai_workflows/DECISIONS.md`](ai_workflows/DECISIONS.md) | All architectural decisions (ADR-001 – ADR-031) |
| [`ai_workflows/PROGRESS_LOG.md`](ai_workflows/PROGRESS_LOG.md) | Session-by-session build history |
| [`backend/README.md`](backend/README.md) | Backend setup, commands, architecture |
| [`frontend/README.md`](frontend/README.md) | Frontend setup, design system, page inventory |
| [`contracts/README.md`](contracts/README.md) | Smart contract architecture and next steps |
| [`docs/`](docs/) | API documentation per module |

---

## License

[License TBD]

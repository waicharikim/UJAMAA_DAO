# UjamaaDAO

UjamaaDAO is a neighborhood sovereignty platform for Kenyan wards — cooperative governance, community project funding, and marketplace for skills and goods, rooted in Ujamaa philosophy (cooperative economics, familyhood).

**Core premise:** Real wards become self-reliant economic, governance, and resilience units. Money and labor are traceable to measurable outcomes — a borehole drilled, a skill trained, clean water flowing.

---

## Project Status (Feb 2026)

| Layer | Status |
|---|---|
| Backend API | Architecture complete, 12 partial modules, 0 tests |
| Prisma schema | 77 models, validated, fresh migration pending first run |
| Docker/Infra | Fully configured, not yet run end-to-end |
| Frontend | Not started |
| M-Pesa | Not started |
| On-chain (Base L2) | Not started |

---

## Repository Structure

```
UJAMAA_DAO/
├── backend/            # Node.js + Express + Prisma backend
│   ├── src/
│   │   ├── app.ts          # Express app
│   │   ├── index.ts        # Web server entry
│   │   ├── workers.ts      # BullMQ worker entry
│   │   ├── core/           # Shared infrastructure
│   │   └── modules/        # Feature modules (auth, user, economy, community, ...)
│   ├── prisma/             # Generated merged schema + migrations
│   ├── Makefile            # All dev commands
│   └── ...
│
├── docker/             # Docker Compose configs
│   ├── docker-compose.yml          # Development stack
│   ├── docker-compose.prod.yml     # Production stack
│   └── start-*.sh                  # Container startup scripts
│
├── traefik/            # Traefik reverse proxy config
│   ├── traefik.yml         # Development config
│   └── acme.json           # SSL cert storage
│
├── ai_workflows/       # Claude context files (project brain)
│   ├── CLAUDE.md       # Full project context
│   ├── START_HERE.md   # Session orientation
│   └── ...
│
├── frontend/           # Next.js frontend (not started)
├── contracts/          # Solidity contracts (not started)
└── docs/               # API and module documentation
```

---

## Getting Started

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local schema tooling only — all dev runs in Docker)

### First Run

```bash
# From the project root
cd backend

# Start all services
make dev

# Then inside the web container, run the first migration:
make db-migrate
# Or: docker exec -it ujamaa_web npx prisma migrate dev --name schema_alignment
```

API is available at: `http://localhost:4000`
Health check: `http://localhost:4000/health`
Ready check: `http://localhost:4000/ready`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+, TypeScript strict |
| Framework | Express |
| Database | PostgreSQL + Prisma ORM |
| Queue | BullMQ + Redis |
| Logger | Pino (structured, with `operationType`) |
| Testing | Vitest + Supertest (no tests written yet) |
| Docker | Docker Compose with Traefik |
| Blockchain (planned) | Base L2 (Sepolia), PR/UT tokens, Privy/Dynamic embedded wallets |
| Frontend (planned) | Next.js 14, TanStack Query, Wagmi |

---

## Non-Negotiable Rules

1. **Marketplace = discovery only.** No payments, no escrow.
2. **Real money via M-Pesa to platform accounts.** Never P2P.
3. **Blockchain is hybrid.** On-chain: governance, PR/UT tokens. Off-chain: UX.
4. **PR token is soulbound.** Earned UT has no cash-out path.
5. **Everything runs in Docker.** Use service names (`postgres`, `redis`), not `localhost`.

---

## Documentation

- [`ai_workflows/CLAUDE.md`](ai_workflows/CLAUDE.md) — Full project context + module status table
- [`ai_workflows/START_HERE.md`](ai_workflows/START_HERE.md) — Where to start each session
- [`backend/README.md`](backend/README.md) — Backend-specific setup and commands
- [`backend/INFRASTRUCTURE.md`](backend/INFRASTRUCTURE.md) — Docker, deployment, troubleshooting
- [`docs/`](docs/) — API documentation per module

---

## License

[License TBD]

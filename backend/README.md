# UjamaaDAO Backend - Project Overview

## Introduction

This repository contains the backend services for UjamaaDAO, a decentralized autonomous organization platform focused on multi-level governance, incorporating geolocation-based participation, token economics, and project management.

This backend provides all core APIs, business logic, authentication, and integration points for the platform.

---

## 🚀 Quick Start

**New to the project?** Start here:

1. **Setup Infrastructure**: See [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for Docker setup and deployment
2. **Run the Application**: `make dev` (after following infrastructure setup)
3. **Read the Docs**: Explore `/docs` for API documentation

---

## Key Features

- **User Management**: Email magic-link authentication, dual-location user profiles (origin & residence wards), impact points and participation rights tracking.
- **Group Governance**: Creation and management of community and company groups, membership invitations, roles, and admin elections.
- **County Groups**: System-created federated groups representing counties with dynamic membership based on impact points.
- **Proposal System**: Multi-level proposal creation (local, constituency, county, national) with privacy and voting scopes.
- **Voting Mechanism**: Combined individual and group block voting with quorum and consensus enforcement.
- **Project & Milestones**: Projects built from proposals, milestone tracking with funding tied to verified completion.
- **Economy**: Participation Rights (PR) soulbound tokens + Utility Tokens (UT), dues commitments, impact points for reputation and governance.
- **Authentication**: Email magic links (JWT + hex token), phone OTP via Africa's Talking, JWT session management.
- **Logging & Error Handling**: Structured logging with Pino (`operationType` context), consistent ApiError-based error handling.
- **Testing**: 173 tests green — 104 auth, 35 user, 34 economy (Vitest + Supertest). CI runs on every push.
- **Dockerized**: Multi-service docker-compose setup with PostgreSQL, Redis, Traefik, MailHog, and frontend.

---

## Repository Structure

```
ujamaadao-backend/
├── src/
│   ├── app.ts              # Express app initialization
│   ├── index.ts            # Server entrypoint (web)
│   ├── workers.ts          # Background worker entrypoint
│   ├── core/               # Core infrastructure
│   │   ├── database/       # Prisma client
│   │   ├── events/         # Event bus
│   │   ├── jobs/           # BullMQ jobs
│   │   ├── logger/         # Pino logger
│   │   ├── middleware/     # Express middlewares
│   │   ├── queue/          # Queue setup
│   │   └── services/       # Shared services
│   ├── modules/            # Feature modules
│   │   ├── auth/           # Authentication
│   │   ├── user/           # User management
│   │   ├── admin/          # Admin features
│   │   ├── economy/        # Token & PR economy
│   │   └── community/      # Groups & governance
│   └── worker-events.ts    # Event listeners
│
├── prisma/                 # Prisma schema and migrations
├── tests/                  # Vitest test suites
├── docs/                   # API & architecture docs
│
├── Dockerfile              # Container build
├── Makefile                # Development commands
├── INFRASTRUCTURE.md       # 👈 Infrastructure & deployment guide
│
# Note: Docker Compose is in docker/ at the project root (../docker/docker-compose.yml)
# Use `make dev` from this directory — the Makefile handles the path.
├── UPGRADE-GUIDE.md        # Observability upgrade path
│
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Development Workflow

### 1. Setup (First Time)

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env

# Start Docker services
make dev

# Run database migrations
make db-migrate
```

### 2. Daily Development

```bash
# Start all services
make dev

# View logs
make logs

# Run tests
npm test

# Access database
make db-shell
```

See [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for detailed setup instructions.

### 3. Testing

```bash
# Run all tests (173 tests — auth, user, economy)
npx vitest run

# Run specific suite
npx vitest run tests/auth/
npx vitest run tests/user/
npx vitest run tests/economy/

# Watch mode
npx vitest
```

> Tests require the test database (`ujamaa_postgres_test` on port 5433) to be running.
> `make dev` starts it automatically.

### 4. Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

---

## Environment Variables

The backend depends on these environment variables (set in `.env`):

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST` / `REDIS_PORT`: Redis connection (BullMQ uses these, not `REDIS_URL`)
- `JWT_SECRET`: Secret key for JWT signing (use strong secret in production)
- `NODE_ENV`: Environment (`development`, `production`, `test`)
- `PORT`: Server port (default: `4000`)

### Optional

- `LOG_LEVEL`: Log level (`debug`, `info`, `warn`, `error`)
- `FRONTEND_URL`: Frontend URL for magic link emails (default: `http://localhost:3000`)
- `SMTP_HOST` / `SMTP_PORT`: Email relay (MailHog in dev)
- `AT_API_KEY` / `AT_USERNAME`: Africa's Talking credentials for SMS OTP
- `MINTER_PRIVATE_KEY`: Backend EOA for minting PR/UT tokens on Base L2 (worker only)
- `PR_TOKEN_ADDRESS` / `UT_TOKEN_ADDRESS`: Deployed contract addresses (post-blockchain session)

See `.env.example` for complete list with descriptions.

---

## Architecture

### Services

- **Web API**: Express server handling HTTP requests
- **Worker**: Background job processor (BullMQ)
- **Event System**: Event-driven architecture for decoupling
- **PostgreSQL**: Main database (Prisma ORM)
- **Redis**: Cache + job queues

### Key Patterns

- **Event-Driven**: Heavy operations processed asynchronously via events
- **Queue-Based**: Background jobs for cleanup, economy, notifications
- **Modular**: Features organized in self-contained modules
- **Type-Safe**: Full TypeScript with Prisma for database

---

## API Documentation

Detailed API documentation per module:

- `/docs/user-api.md` - User management endpoints
- `/docs/auth-api.md` - Authentication flow
- `/docs/economy-api.md` - Token & participation rights
- `/docs/group-api.md` - Groups & governance
- `/docs/admin-api.md` - Admin operations

**API Base URL**: `http://localhost:4000/api/v1`

---

## Deployment

### Development

See [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for local development setup.

### Production

```bash
# Build production images
make prod-build

# Deploy
make prod

# Run migrations
docker compose -f ../docker/docker-compose.prod.yml exec web npx prisma migrate deploy
```

See [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for detailed production deployment guide.

---

## Monitoring & Observability

When ready for advanced monitoring:

```bash
# Check available observability features
make check-configs

# Enable monitoring stack
make enable-monitoring
```

See [UPGRADE-GUIDE.md](./UPGRADE-GUIDE.md) for observability options.

---

## Testing Strategy

### Unit Tests
- Business logic in services
- Utility functions
- Validation schemas

### Integration Tests
- API endpoints (Supertest)
- Database operations (Prisma)
- Queue processing (BullMQ)

### Coverage Goals
- Target: >80% code coverage
- Critical paths: >90% coverage

---

## Contribution Guidelines

1. **Branching**: Create feature branches from `develop`
2. **Commits**: Use conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
3. **Testing**: Write tests for all new features
4. **Linting**: Ensure code passes ESLint and Prettier
5. **Documentation**: Update relevant docs
6. **Pull Requests**: Get review before merging

---

## Project Structure Philosophy

- **`core/`**: Infrastructure code used across the app
- **`modules/`**: Feature-specific code (auth, user, economy, etc.)
- **Event-driven**: Heavy operations don't block HTTP responses
- **Type-safe**: Leverage TypeScript and Prisma for safety
- **Testable**: Modular design enables easy testing

---

## Logging & Error Handling

- **Logger**: Pino for structured logging (`backend/src/core/logger/logger.ts`)
- **Error Handling**: Custom `ApiError` class for consistent errors
- **Request Logging**: All HTTP requests logged with correlation IDs
- **Operation Logging**: Business operations logged with context

---

## Technology Stack

- **Runtime**: Node.js 22
- **Language**: TypeScript (strict)
- **Framework**: Express
- **Database**: PostgreSQL 15 + Prisma ORM (80 models)
- **Cache/Queue**: Redis + BullMQ (4 background jobs)
- **Testing**: Vitest + Supertest — 173 tests, CI green
- **Logging**: Pino (structured, `operationType` context)
- **Validation**: Zod
- **Authentication**: Email magic links + Africa's Talking SMS OTP + JWT sessions

---

## Useful Commands

```bash
# Development
make dev              # Start all services
make logs             # View logs
make restart          # Restart services
make down             # Stop services

# Database
make db-shell         # Access PostgreSQL
make db-migrate       # Run migrations
make backup           # Create backup

# Observability (when needed)
make check-configs    # Check observability status
make enable-monitoring # Enable Prometheus + Grafana

# Production
make prod             # Deploy production
make prod-build       # Build images
```

See [Makefile](./Makefile) for all available commands.

---

## Documentation

- **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)**: Docker setup, deployment, troubleshooting
- **[UPGRADE-GUIDE.md](./UPGRADE-GUIDE.md)**: Observability features upgrade path
- **`/docs`**: API documentation, architecture guides

---

## Contact

For questions or requests, reach out to the dev team or project leads as per internal communication channels.

---

## License

[Your License Here]

---

*This document serves as a high-level project overview for UjamaaDAO backend.*

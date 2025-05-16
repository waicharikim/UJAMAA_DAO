# UjamaaDAO Backend - Project Overview

## Introduction

This repository contains the backend services for UjamaaDAO, a decentralized autonomous organization platform focused on multi-level governance, incorporating geolocation-based participation, token economics, and project management.

This backend provides all core APIs, business logic, authentication, and integration points for the platform.

---

## Key Features

- **User Management**: Wallet-based authentication, dual-location user profiles (origin & residence), impact points and tokens tracking.
- **Group Governance**: Creation and management of community and company groups, membership invitations, roles, and admin elections.
- **County Groups**: System-created federated groups representing counties with dynamic membership based on impact points.
- **Proposal System**: Multi-level proposal creation (local, constituency, county, national) with privacy and voting scopes.
- **Voting Mechanism**: Combined individual and group block voting with quorum and consensus enforcement.
- **Project & Milestones**: Projects built from proposals, milestone tracking with funding tied to verified completion.
- **Token & Impact Points Economy**: Token minting, burning, transfers, and impact points for reputation and governance participation.
- **Authentication**: Wallet-signature-based login using nonce challenges, JWT session tokens.
- **Logging & Error Handling**: Structured logging with Pino, consistent ApiError-based error handling.
- **Testing**: Comprehensive unit and integration tests with Vitest and Supertest.
- **Dockerized**: Multi-service docker-compose setup with PostgreSQL, backend API, and optionally blockchain node.

---

## Repository Structure

backend/ # Backend service code
├── src/
│ ├── app.ts # Express app initialization
│ ├── index.ts # Server entrypoint
│ ├── routes/ # Express route definitions per module (user, group, auth, ...)
│ ├── controllers/ # HTTP request handlers per resource
│ ├── services/ # Business logic and database operations
│ ├── middlewares/ # Express middlewares (auth, error handling, validation)
│ ├── validation/ # Request input validation schemas using Zod
│ ├── prismaClient.ts# Prisma client singleton instance
│ └── utils/ # Utilities (logger, ApiError, etc.)
├── prisma/ # Prisma schema and migrations
├── tests/ # Vitest test suites and helpers
├── package.json # Backend dependencies and scripts
├── Dockerfile # Backend Docker image build instructions
└── .env # Environment variables (not committed)
docker/ # Docker-compose configurations and related files
docs/ # Project documentation (API docs, architecture, setup guides)
frontend/ # Frontend application code (separate repo or folder)
blockchain/ # Smart contracts and blockchain integration code


---

## Environment Variables

The backend depends on these environment variables (set in `.env` or docker-compose):

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing and verification
- `LOG_LEVEL`: Optional log level (e.g., debug, info, warn, error)
- Other variables as needed for integration or third-party services

---

## Development Workflow

1. **Setup**
   - Install all backend dependencies: `npm install`
   - Configure `.env` with required variables
   - Initialize database with Prisma migrations: `npx prisma migrate dev`
   
2. **Running**
   - Start the backend locally: `npm run dev`
   - Use Docker Compose to run backend + database + blockchain: `docker-compose up --build`
   
3. **Testing**
   - Run tests with Vitest: `npm test` or `npx vitest run --threads=false` for sequential tests.

4. **Code Quality**
   - Use ESLint and Prettier (configured) for linting and formatting.
   - Add new features with accompanying tests and documentation updates.
   - Commit with descriptive messages and push for code review.

---

## Logging & Error Handling

- Uses [Pino](https://github.com/pinojs/pino) for structured JSON logging with pretty-printing in dev.
- API errors are represented uniformly using `ApiError` class.
- Global error handler appropriately sends HTTP status codes and messages.

---

## API Documentation

- Detailed API docs per module reside in `/docs`, e.g., `user-api.md`, `group-api.md`.
- Optionally generate OpenAPI specs from code for frontend and user reference.

---

## Contribution

- Follow commit message conventions (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Write tests for all new logic, targeting >80% coverage.
- Keep documentation up-to-date.
- Resolve linting and formatting issues before committing.
- Use feature branches and pull requests for collaborative development.

---

## Contact

For questions or requests, reach out to the dev team or project leads as per internal communication channels.

---

*This document serves as a high-level backend overview for UjamaaDAO.*

# UjamaaDAO - System Architecture

## Introduction

UjamaaDAO is a decentralized autonomous organization platform tailored for multi-level governance with geographic and role-based layers. This document provides a detailed architecture overview of all major system components, data flows, and integration points spanning backend, frontend, and blockchain.

---

## High-Level Architecture Overview

+-------------------+ +---------------------+ +----------------------+
| | | | | |
| Frontend UI / | <------> | Backend REST | <------> | Blockchain Layer |
| Wallets (Web, | | API + Business | | (Smart contracts and |
| Mobile, SMS) | | Logic + Database | | on-chain logic) |
| | | | | |
+-------------------+ +---------------------+ +----------------------+
| | |
User Interactions Data / Requests State & Governance


---

## Core Components

### 1. Frontend & User Interaction Layer

- Responsive Web & Mobile UI for user registration, governance participation, and project collaboration.
- Embedded wallet integrations (Privy or Dynamic — decision pending ADR-009) for cryptographic identity without seed phrase management. MetaMask is not required.
- SMS gateway integration for rural/low-connectivity user access.
- Real-time updates via WebSockets or polling for votes, proposals, and project status.

### 2. Backend API & Business Logic

- Express-based REST API covering:

  - User management with wallet-based login using nonce + signature.
  - Group and county group governance modules with membership, roles, and proposal management.
  - Voting system combining individual and group votes with dynamic quorum and consensus.
  - Project and milestone management, including funding disbursement control.
  - Token and impact point economy managing reputation and governance participation incentives.
  - Notification service delivering multi-channel updates.

- PostgreSQL database accessed via Prisma ORM with comprehensive data modeling for multi-level geography and user roles.

- Robust error handling with `ApiError` (`backend/src/core/errors/ApiError.ts`) and structured logging via Pino (`backend/src/core/logger/logger.ts`).

- Authentication and authorization middleware enforcing JWT-based access and role-based permissions.

- Comprehensive testing with Vitest and Supertest ensuring high confidence in logic correctness.

### 3. Blockchain Layer

- Smart contracts deployed on **Base L2** (Coinbase L2, EVM-compatible) — Sepolia testnet for dev, Mainnet for prod. Enforces:

  - Token economcis (minting, transfers, staking).
  - On-chain voting and proposal approvals.
  - Reputation tokens (soulbound or similar).
  - Milestone funding and release conditions.

- Backend listens to contract events, synchronizes on-chain state to off-chain DB, ensuring transparency and auditability.

- Wallets sign transactions and vote delegation messages on-chain.

---

## Geographic & Governance Hierarchy

- **Local (Group) Level**: Private or public groups organized by legal entities; members participate in group-only governance and projects.
- **Constituency Level**: Collections of groups & individuals mapped via user residency or origin; propositions and votes scoped accordingly.
- **County Level**: Federation of constituencies; county groups formed automatically based on reputation; intermediate governance body.
- **National Level**: Highest governance level where county groups propose and vote on national initiatives.

---

## Data Flow Highlights

1. **User Registration & Authentication**

   - Users register with wallet address and dual locations.
   - Backend generates nonce; frontend requests nonce and signs it.
   - Backend verifies signature, issues JWT, facilitating secure session management.

2. **Group & Proposal Management**

   - Groups created and managed via APIs.
   - Proposals created at varying scopes with customizable privacy.
   - Voting combines individual weighted votes and group block votes subject to quorum.

3. **Project Execution**

   - Approved proposals transition into projects.
   - Projects have milestones monitored and verified.
   - Funds released based on milestone approvals.

4. **Blockchain Synchronization**

   - Key governance events written on-chain.
   - Backend tracks on-chain state and updates database.
   - Ensures trust and immutability for critical governance actions.

---

## Security & Compliance

- Wallet-based auth eliminates passwords; nonce used to prevent replay.
- Role-Based Access Control applied throughout backend.
- Secure data in transit and at rest with HTTPS and encryption.
- Audit logs for vote, proposal, financial transactions.
- Regional and global data privacy considerations integrated.

---

## Development & Deployment

- Containerized microservices via Docker Compose.
- Multi-stage builds for dev and production.
- Continuous Integration configured with linting, tests, and deployment.
- Modular service design with clear API contracts for future extensibility.

---

## Future Extensions

- Proxy and delegated voting mechanisms.
- Cross-chain interoperability.
- Advanced analytics and reputation dashboards.
- Comprehensive dispute resolution workflow.
- Expanded notification and engagement features.

---


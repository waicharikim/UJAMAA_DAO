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
- Wallet integrations (MetaMask, WalletConnect) for cryptographic identity and transaction signing.
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

- Robust error handling with `ApiError` and structured logging via Pino.

- Authentication and authorization middleware enforcing JWT-based access and role-based permissions.

- Comprehensive testing with Vitest and Supertest ensuring high confidence in logic correctness.

### 3. Blockchain Layer

- Smart contracts deployed on EVM-compatible chains enforcing:

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

# Root README.md (High-Level Project Description)

# UjamaaDAO — Decentralized Governance Platform

UjamaaDAO is a blockchain-enabled decentralized autonomous organization platform that facilitates secure, transparent, and inclusive governance across multiple geographic and organizational layers in Kenya.

## Features

- Wallet-based authentication and secure user identity management.
- Multi-level governance: local groups, constituencies, counties, and national bodies.
- Dynamic proposal creation, voting combining individual and group inputs.
- Token economy and impact points system driving participation and rewards.
- Project and milestone tracking with on-chain and off-chain integration.
- Multi-channel notifications including SMS to bridge digital divides.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- Docker & Docker Compose
- PostgreSQL database (containerized or external)
- Environment file configured with secrets (`.env`)

### Installation

```bash
git clone <repo-url>
cd ujamaa-dao/backend
npm install
```

## Development

### Build and run backend with Docker Compose
```bash
docker-compose up --build
```
API server runs at http://localhost:4000

### Testing
```bash
npm test        # Run all tests sequentially for stable results
```

## Documentation

    API docs available in /docs folder (Markdown).
    Architecture and operational guides included.
    You can generate and extend OpenAPI specs as needed.

## Contributing

    Follow code style and commit message conventions.
    Write comprehensive tests for new features.
    Update documentation accordingly.
    Use feature branches and pull requests.

## License

Licensed under [Your License].

For detailed architecture and API docs, please see the /docs directory.

Ready to shape the future of community-driven governance!
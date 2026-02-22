# UjamaaDAO Frontend

> **Status: Not started.**
> The frontend does not exist yet. This directory is a placeholder.
> Frontend development begins after auth + marketplace backend modules are production-ready.

---

## Planned Stack

| Technology | Purpose |
|---|---|
| Next.js 14 (App Router) | Framework |
| TypeScript | Language |
| Tailwind CSS + shadcn/ui | Styling |
| TanStack Query | Server state / data fetching |
| Wagmi + RainbowKit | Wallet integration |
| Zustand | Client state |
| React Hook Form + Zod | Form handling + validation |

---

## Planned Architecture

```
frontend/
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── (auth)/         # Auth flow: login, register
│   │   ├── dashboard/      # Main app shell
│   │   ├── marketplace/    # Listings, search
│   │   ├── governance/     # Proposals, voting
│   │   ├── projects/       # Project + milestone tracking
│   │   └── admin/          # Admin panel
│   ├── components/         # Shared components
│   ├── lib/                # API client, utils, types
│   └── hooks/              # Custom React hooks
├── public/
├── package.json
└── next.config.ts
```

---

## Key Design Decisions

### Authentication
- Phone number primary (Kenya-first, M-Pesa native)
- Embedded wallets via Privy or Dynamic (no MetaMask required)
- No seed phrases exposed to users

### Wallet
- Embedded wallet SDK (Privy or Dynamic — ADR-009 Under Review)
- First transaction gasless via Pimlico paymaster (Base L2)
- Users don't see "wallet" — they see "account"

### Data Fetching
- TanStack Query for all API calls
- Optimistic updates where appropriate
- Offline-tolerant for low-connectivity Kenya contexts

### Performance
- Mobile-first, low-data-friendly
- Image optimization via Next.js
- SMS fallback for critical notifications (backend handles this)

---

## Integration Points

The frontend connects to the backend API at:

```
http://localhost:4000/api/v1     (development)
https://api.ujamaadao.org/api/v1 (production — TBD)
```

Active endpoints (as of Feb 2026):
- `POST /api/v1/auth/*` — Auth flow
- `GET/PATCH /api/v1/users/me` — User profile
- `GET /api/v1/economy/*` — Token/impact point data
- `GET /api/v1/admin/*` — Admin panel

Pending endpoints (modules at `partial` status, not yet connected):
- Community (groups), Governance (proposals, votes), Projects, Marketplace, Notifications

---

## Non-Negotiable Frontend Rules

These mirror the project-level rules in [`ai_workflows/CLAUDE.md`](../ai_workflows/CLAUDE.md):

1. **No marketplace payment UI.** The marketplace is discovery-only. No checkout, no escrow.
2. **No UT withdrawal UI.** Earned UT cannot be cashed out — don't build the interface.
3. **PR tokens are not transferable** — no send/trade UI.
4. **Backend API base URL** must be configurable via `NEXT_PUBLIC_API_URL` env var.
5. **Service names in Docker** — when running with Docker, use the service name not localhost.

---

## Getting Started (When Ready)

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit environment
# NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Start dev server
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

*This file will be updated when frontend development begins.*
*See [`ai_workflows/DECISIONS.md`](../ai_workflows/DECISIONS.md) ADR-009 for wallet SDK decision.*

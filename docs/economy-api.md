# Economy API Documentation

> **Module status:** `partial` — economy routes mounted at `/api/v1/economy` in `app.ts`.
> Tests not yet written.

## Overview

The Economy module manages the token and impact points system:

- **PR (Participation Rights)**: Soulbound governance token. Non-transferable. Monthly regen gated by activity. Weighted voting.
- **UT (Utility Token)**: Internal points. Cosmetic and visibility use only. Earned UT has no cash-out path.
- **Impact Points**: Reputation score. Not spendable, not transferable.

Base URL: `http://localhost:4000/api/v1/economy`

---

## Non-Negotiable Rules (Economy)

- PR is soulbound — no transfer, no trade, no send. Any endpoint that moves PR between users is rejected.
- Earned UT cannot be converted to M-Pesa or any currency. No withdrawal path.
- Incentives must reflect real value creation — no grinding or farming.

---

## Key Endpoint Areas

> Full endpoint documentation is pending. The economy service at
> `backend/src/modules/economy/` is the source of truth.

| Area | Path Prefix | Description |
|------|-------------|-------------|
| Impact Points | `/api/v1/economy/impact-points` | Read/update impact point balances |
| Token Balance | `/api/v1/economy/token-balance` | Read/update UT balances |
| PR Awards | `/api/v1/economy/pr` | PR regen and award endpoints |
| Dues | `/api/v1/economy/dues` | Dues payment tracking |

---

## Background Jobs (Economy Module)

The economy module uses BullMQ for:
- Monthly PR regen (cron, gated by activity)
- Dues penalty application (cron, for overdue members)
- Impact point award on verified actions

All jobs registered in `backend/src/core/jobs/register.ts`.

---

*This document is a stub. Full endpoint documentation will be added when economy reaches `production-ready` status.*

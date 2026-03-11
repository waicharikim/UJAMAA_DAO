# Economy API Documentation

> **Module status:** `tested` — 34 green tests across 3 files (18 service unit + 16 route integration).
> Base URL: `http://localhost:4000/api/v1/economy`

---

## Overview

The Economy module manages the three-token system:

| Token | Type | Purpose | Cashable? |
|---|---|---|---|
| **PR (Participation Rights)** | Soulbound ERC-20 (on-chain) | Governance voting weight | No |
| **UT (Utility Token)** | ERC-20 (on-chain) | Internal perks; fiat-backed pool is cashable | Fiat-backed only |
| **Impact Points** | Off-chain (DB) | Reputation signal | No |

All economy endpoints require `COMMUNITY_VERIFIED`. Users at `EMAIL_VERIFIED` get `403`.

For full token mechanics and design decisions see `docs/economy-design.md`.

---

## Non-Negotiable Rules

- PR is soulbound — non-transferable, non-tradeable. Any endpoint that moves PR between users is rejected.
- **Earned UT** (from education, referrals, contributions) has no cash-out path. Ever.
- **Fiat-backed UT** (from M-Pesa deposits, 1 UT = 1 KES) can be withdrawn back to M-Pesa.
- Incentives must reflect real value creation — no grinding, no farming.

---

## Endpoints

### `GET /economy/pr`
Get the authenticated user's PR balance and recent award/penalty history.
**Auth:** `COMMUNITY_VERIFIED`

**Response `200`:**
```json
{
  "balance": 250,
  "history": [
    {
      "id": "...",
      "amount": 50,
      "reason": "EMAIL_VERIFIED",
      "createdAt": "..."
    }
  ]
}
```

---

### `GET /economy/dues/history`
Get the user's dues payment history and totals.
**Auth:** `COMMUNITY_VERIFIED`

**Response `200`:**
```json
{
  "totalPaid": 2500,
  "history": [
    { "period": "2026-02", "amountKes": 500, "paidAt": "...", "tier": "ORDINARY" }
  ]
}
```

---

### `GET /economy/commitments`
Get the user's active and past commitment records.
**Auth:** `COMMUNITY_VERIFIED`

**Response `200`:** array of commitment objects with `type`, `tier`, `startPeriod`, `status`, `nextDueDate`.

---

### `POST /economy/commitments/dues`
Opt in to a monthly dues commitment (voluntary). Can only be called once per month per user.
**Auth:** `COMMUNITY_VERIFIED`
**Rate limit:** 1 per 30 days

**Body:**
| Field | Type | Values |
|---|---|---|
| `tier` | string (enum) | `ORDINARY` · `SUPPORTER` · `SPONSOR` |
| `startPeriod` | string | `YYYY-MM` format |
| `durationMonths` | number | positive integer |

**Responses:**
- `201 Created` — commitment created.
- `400 Bad Request` — validation failure or invalid tier.
- `429 Too Many Requests` — already opted in this month.

---

## Background Jobs (Economy Module)

All jobs are registered in `backend/src/core/jobs/register.ts` and run on the `economy` queue.

| Job | Schedule | Description |
|---|---|---|
| `monthly-pr-regeneration` | 1st of month, 00:05 | Awards PR regen to eligible users (activity-gated per ADR-025) |
| `daily-commitment-penalties` | Daily 02:00 | Deducts PR for users with overdue commitments |

---

## Audit Trail

The following economy events are written to the audit log:
- `PR_AWARDED` — on every PR award
- `PR_SPENT` — on every PR spend (e.g. group creation)
- `DUES_PAID` — on successful dues payment
- `COMMITMENT_CREATED` — on dues opt-in

Query audit records at `GET /api/v1/audit/search`.

---

## Planned Endpoints (not yet implemented)

```
POST /economy/pr/spend          — spend PR for group creation, proposals
GET  /economy/transactions      — full transaction history across PR + UT
POST /economy/deposit           — M-Pesa → fiat-backed UT deposit
POST /economy/withdraw          — fiat-backed UT → M-Pesa withdrawal
```

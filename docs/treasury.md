# UjamaaDAO – Treasury

**Last updated:** May 2026 (session 65)
**Scope:** Group treasury ledger, M-Pesa deposit flows, UT cash-out design, on-chain mirroring roadmap.

> **Rule 2 reminder**: All real money flows through M-Pesa to platform-controlled accounts. Never P2P. No exceptions.

---

## 1. What Is Built (May 2026)

| Layer | Status |
|---|---|
| Group treasury ledger (balance + WalletTransaction audit trail) | ✅ live |
| Dues → treasury allocation (100% → primary ward system group) | ✅ live |
| Proposal disbursement (EXECUTING transition debits group treasury) | ✅ live |
| Project contribution → treasury credit | ✅ live |
| M-Pesa `TREASURY_DEPOSIT` → treasury credit + on-chain UT mint | ✅ live |
| Manual deposit / withdraw (SUPER_ADMIN only) | ✅ live |
| My-groups treasury summary (`GET /treasury/my-groups`) | ✅ live |
| Frontend treasury page (ward treasury + transaction history) | ✅ live |
| `GroupTreasury.sol` on-chain mirroring | ❌ pending (minter wallet not funded) |

---

## 2. API Reference

All routes require a valid `Authorization: Bearer <token>` header.

### `GET /api/v1/treasury/my-groups`

Returns balance summary for all groups the authenticated user belongs to that have a treasury.

**Auth:** Any authenticated user.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "groupId": "uuid",
      "groupName": "Kibera Ward Community",
      "isSystem": true,
      "systemType": "WARD",
      "balance": 125000,
      "tokenBalance": 0,
      "updatedAt": "2026-05-18T10:00:00.000Z"
    }
  ]
}
```

Groups without a treasury are omitted. Returns `[]` if none exist.

---

### `GET /api/v1/treasury/:groupId`

Returns the full treasury record for a single group.

**Auth:** Any authenticated user.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "groupId": "uuid",
    "groupName": "Kibera Ward Community",
    "balance": 125000,
    "tokenBalance": 0,
    "createdAt": "2026-03-01T00:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  }
}
```

**Errors:** `404` if no treasury exists for this group.

---

### `GET /api/v1/treasury/:groupId/transactions`

Paginated ledger of all wallet transactions for a group treasury.

**Auth:** Any authenticated user.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Default `1` |
| `limit` | number | Default `20` |
| `transactionType` | `CREDIT` \| `DEBIT` | Filter by direction |
| `referenceType` | string | `DUES`, `PROJECT`, `PROPOSAL`, `ESCROW`, `MANUAL` |
| `fromDate` | ISO string | Start of date range |
| `toDate` | ISO string | End of date range |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "treasuryId": "uuid",
        "amount": 5000,
        "currency": "KES",
        "transactionType": "CREDIT",
        "description": "Dues payment — ORDINARY tier (2026-05)",
        "referenceType": "DUES",
        "proposalId": null,
        "projectId": null,
        "initiatedById": "uuid",
        "metadata": { "duesPaymentId": "uuid", "tier": "ORDINARY", "period": "2026-05" },
        "createdAt": "2026-05-18T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    }
  }
}
```

**Errors:** `404` if no treasury exists for this group.

---

### `POST /api/v1/treasury/:groupId/deposit`

Manually credit a group treasury. Creates a `WalletTransaction` (type `CREDIT`) and increments balance atomically.

**Auth:** `SUPER_ADMIN` only.

**Body:**
```json
{
  "amount": 10000,
  "description": "Ward grant from county government",
  "referenceType": "MANUAL",
  "proposalId": null,
  "projectId": null
}
```

| Field | Required | Notes |
|---|---|---|
| `amount` | ✅ | Positive number, KES |
| `description` | — | Max 500 chars |
| `referenceType` | — | `PROPOSAL` \| `PROJECT` \| `DUES` \| `ESCROW` \| `MANUAL` (default `MANUAL`) |
| `proposalId` | — | Links transaction to a proposal |
| `projectId` | — | Links transaction to a project |

**Response `200`:** The created `WalletTransaction` record.

**Errors:** `400` invalid body · `403` not SUPER_ADMIN · `404` group not found.

---

### `POST /api/v1/treasury/:groupId/withdraw`

Manually debit a group treasury. Throws if balance is insufficient.

**Auth:** `SUPER_ADMIN` only.

**Body:** Same shape as deposit.

**Response `200`:** The created `WalletTransaction` record.

**Errors:** `400` insufficient balance or invalid body · `403` not SUPER_ADMIN · `404` treasury not found.

---

## 3. How Money Enters a Group Treasury

### Dues payment (automatic)

1. User pays dues via M-Pesa STK push (`POST /payments/initiate`).
2. Buni callback fires (`POST /payments/webhook/buni`) → `dues.service.recordPayment()`.
3. `dues.service.ts` calls `treasuryService.allocateDues()` after the transaction.
4. `allocateDues()` finds the user's primary ward system group → creates a `DuesAllocation` record + `WalletTransaction (CREDIT, referenceType=DUES)` + increments treasury balance. Phase 1: 100% goes to the ward group. Future: configurable split (ward/constituency/county).

### Project contribution (automatic)

1. User calls `POST /projects/:projectId/contribute` with `fiatBackedUt` amount.
2. `project.service.contributeToProject()` debits the user's fiat UT balance, creates a `WalletTransaction (CREDIT, referenceType=PROJECT)`, and increments the project's group treasury.

### M-Pesa direct deposit (automatic)

1. User initiates `POST /payments/initiate` with `purpose: TREASURY_DEPOSIT` and `metadata.groupId`.
2. Buni callback → `payment.service.ts` case `TREASURY_DEPOSIT` → `treasuryService.deposit()`.
3. On-chain: if user has a wallet address and UT contract is configured, mints `fiatBackedUt` to their address (1 UT = 1 KES).

### Manual deposit (admin-triggered)

`POST /treasury/:groupId/deposit` (SUPER_ADMIN). Used for grants, off-platform transfers, corrections.

---

## 4. How Money Leaves a Group Treasury

### Proposal execution (automatic on EXECUTING transition)

1. A proposal with `groupFundingAmount > 0` is voted through to `APPROVED`.
2. A group leader or proposal creator calls `PATCH /governance/:proposalId/progress` with `{ status: "EXECUTING" }`.
3. `proposalService.updateProgress()` **pre-validates** the treasury before updating the proposal status:
   - If no treasury exists → `400 Group treasury does not exist`
   - If balance < `groupFundingAmount` → `400 Insufficient treasury balance for proposal disbursement`
4. On success: proposal moves to `EXECUTING`, treasury debited with `referenceType=PROPOSAL` and `proposalId` set on the transaction.
5. The proposal never enters `EXECUTING` state without the money leaving the treasury.

### Manual withdrawal (admin-triggered)

`POST /treasury/:groupId/withdraw` (SUPER_ADMIN). Used for paying contractors, off-platform transfers.

---

## 5. Treasury Types

| Treasury | Primary Assets | Purpose |
|---|---|---|
| Platform-wide treasury | Fiat-backed UT + KES | Platform operations, grants, partnerships |
| Ward / Group treasuries | Fiat-backed UT + KES | Local events, supplies, project funding |
| User wallet | Fiat-backed UT + Earned UT | Personal dues, marketplace, governance |

---

## 6. UT Cash-Out Design (Fiat-Backed UT Only)

> **ADR-004**: Only UT converted from fiat (M-Pesa deposits) can be cashed out.
> Earned UT has **no cash-out path, ever**.

The user's `fiatBackedUtBalance` and `earnedUtBalance` are always stored separately — they must never be merged.

**Planned flow (not yet implemented):**

1. User requests withdrawal of X UT from fiat-backed pool.
2. Backend validates: balance ≥ X, verified phone, daily/weekly limits.
3. Deducts X from `fiatBackedUtBalance`.
4. Enqueues BullMQ job `process-mpesa-payout` → calls M-Pesa Daraja B2C API.
5. On success: transaction record + push/email confirmation.
6. On failure: refund `fiatBackedUtBalance`, notify user and admin, dead-letter queue.

| Control | Why |
|---|---|
| Verified phone required | Prevents sending funds to wrong number |
| Daily/weekly limits | Reduces fraud blast radius |
| Separate fiat-backed pool | Can never accidentally cash out earned UT |
| BullMQ job with retry + dead-letter | Failed payouts are recoverable |
| Fee disclosure | Regulatory transparency |

---

## 7. On-Chain Roadmap

The treasury page says "All transactions are recorded on-chain for transparency." This is aspirational until `GroupTreasury.sol` is deployed.

**Planned:**
- `GroupTreasury.sol` on Base L2 — mirrors off-chain balance, gate-checked for disbursements
- Ward treasury balances queryable on-chain
- Disbursements require both off-chain governance approval (PR-weighted vote) and on-chain transaction

**Blocked on:** Funded minter wallet → `forge script Deploy.s.sol --rpc-url base_sepolia --broadcast` → set `PR_TOKEN_ADDRESS`/`UT_TOKEN_ADDRESS` env vars.

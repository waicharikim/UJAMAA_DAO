# UjamaaDAO – Treasury

> **Module status:** `tested` — 40 green tests (service unit + route integration).
> Base URL: `http://localhost:4000/api/v1/treasury`

**Last updated:** May 2026
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
| Manual deposit / withdraw HTTP endpoints | ❌ **removed** — no single person can move community funds (Rule 2 / "nobody controls it alone"). Money moves only via governed paths: M-Pesa in, proposal disbursement out. The `deposit`/`withdraw` *service* methods remain, called only by those flows. |
| My-groups treasury summary (`GET /treasury/my-groups`) | ✅ live |
| Frontend treasury page (primary-ward treasury + transaction history) | ✅ live |
| `GroupTreasury.sol` on-chain anchoring | ✅ **built, dormant** — contract + worker-driven anchor job ship; every anchor is a no-op until `TREASURY_CONTRACT_ADDRESS` + the minter wallet are set, then it activates with no code change. See §5. |

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

### ~~`POST /api/v1/treasury/:groupId/deposit`~~ · ~~`POST /api/v1/treasury/:groupId/withdraw`~~ — REMOVED

These manual deposit/withdraw HTTP endpoints were **deliberately removed** so no
single person can move community funds (Rule 2 / "nobody controls it alone"). They
now return `404`. The `treasuryService.deposit()` / `withdraw()` *methods* remain,
called only by governed flows:
- **IN** — M-Pesa deposits (`payments` module) and dues fan-out (`allocateDues`).
- **OUT** — governance-approved proposal disbursement (`governance` module, on the EXECUTING transition).

There is no API surface that credits or debits a treasury directly.

---

## 3. How Money Enters a Group Treasury

### Dues payment (automatic)

1. User pays dues via M-Pesa STK push (`POST /payments/initiate`).
2. Buni callback fires (`POST /payments/webhook/buni`) → `dues.service.recordPayment()`.
3. `dues.service.ts` calls `treasuryService.allocateDues()` after the transaction.
4. `allocateDues()` walks the user's geographic hierarchy (Ward → Constituency → County → National) and fans out credits across the matching system groups.

**Default split (configurable via `PlatformConfig` key `dues_allocation_split`):**

| Level | Default % | System group query |
|---|---|---|
| Ward | 70% | `isSystemGroup=true, systemType=WARD, wardId=user.primaryWardId` |
| Constituency | 15% | `isSystemGroup=true, systemType=CONSTITUENCY, constituencyId=ward.constituencyId` |
| County | 10% | `isSystemGroup=true, systemType=COUNTY, countyId=ward.countyId` |
| National | 5% | `isSystemGroup=true, systemType=NATIONAL` |

Levels with percentage = 0 or no matching system group are silently skipped. Each active level gets a `DuesAllocation` record + `WalletTransaction (CREDIT, referenceType=DUES)` + treasury balance increment — all in one atomic transaction. To change the split, upsert the `dues_allocation_split` key via `POST /api/v1/admin/platform-config`.

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

### ~~Manual withdrawal (admin-triggered)~~ — removed

There is no manual withdrawal path. Funds leave only via proposal disbursement
(governance-approved, on the EXECUTING transition). See §1 / Rule 2.

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

## 7. On-Chain Anchoring (built — dormant until configured)

Treasury movements are anchored on-chain the **same way proposals are** — a
tamper-evident mirror, not fund custody. Real KES stays off-chain via M-Pesa
(Rule 2); the chain holds only a hash per ledger row so anyone can verify a
transaction shown in-app was recorded and never altered.

**How it works**
- **`GroupTreasury.sol`** (Base L2) — `recordTransaction(txId, groupId, dataHash, kind)` writes a `txId => hash` mapping + an immutable `TreasuryTxAnchored` event. RECORDER_ROLE-gated. It never holds KES. (8 Foundry tests.)
- **`getTreasuryContract()`** — null-guarded on `TREASURY_CONTRACT_ADDRESS`; returns null (no-op) until set.
- **`ANCHOR_TREASURY_TX_JOB`** (economy queue, worker-driven) — enqueued by `deposit` / `withdraw` / `allocateDues` after the DB write. The worker holds the minter key (RECORDER_ROLE), so a movement that ran on the web process still gets anchored. Fails-open: a chain error never touches the off-chain ledger.
- **`WalletTransaction.anchorTxHash`** — stores the resulting tx hash (null until anchored). The treasury page renders a Basescan link + "mirrored on-chain" copy only when it's set; otherwise "recorded in a transparent ledger."

**Activation (seamless — no code change)**
1. Deploy `GroupTreasury.sol` to Base with the minter wallet as admin (it auto-holds RECORDER_ROLE).
2. Set `TREASURY_CONTRACT_ADDRESS` on the worker (the minter key already lives there as `MINTER_PRIVATE_KEY`).
3. From then on, new dues / contributions / disbursements anchor automatically and the on-chain link appears. (Optional: a one-time backfill job for pre-existing rows.)

Until step 2, every anchor is a no-op and the Postgres ledger is the source of truth. Roadmap context: memory `onchain-integrity-roadmap` (this closes the treasury half of Scope B).

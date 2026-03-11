# UjamaaDAO – Treasury Design

**Version:** 1.0
**Last updated:** March 2026
**Scope:** Treasury structure, M-Pesa deposit/withdrawal flows, ward/group treasury mechanics.

> **Rule 2 reminder**: All real money flows through M-Pesa to platform-controlled accounts. Never P2P. No exceptions.

---

## 1. Treasury Types

| Treasury | Primary Assets | Secondary Assets | Purpose |
|---|---|---|---|
| **Platform-wide treasury** (central DAO) | Fiat-backed UT + KES | PR (governance votes only) | Platform operations, grants, partnerships, salaries |
| **Ward / Group treasuries** (local funds) | Fiat-backed UT + KES | Small PR (group voting) | Local events, supplies, small grants, project funding |
| **User wallet** (individual balance) | Fiat-backed UT + Earned UT | PR, IP | Personal use, dues payment, marketplace |

**Key principle:**
- **UT** = the transparent, auditable layer → used for anything needing immutability, public visibility, or cross-community pooling.
- **KES via M-Pesa** = the real-world bridge → used for anything involving paying real people, buying physical goods, or paying taxes/fees.

---

## 2. How M-Pesa Deposits Work

Users have two ways to bring money into the system:

| Method | Flow | What the user receives |
|---|---|---|
| **M-Pesa → Fiat UT deposit** | User sends KES via M-Pesa to platform till number | Equivalent fiat-backed UT (1 UT = 1 KES) credited to their fiat pool |
| **M-Pesa → Direct project contribution** | User sends M-Pesa to project-specific till or QR code | Proof of contribution + optional small earned UT bonus |

### Most Common Flow (Recommended Default)

1. User opens "Contribute to Ward Project" (e.g., borehole, youth training).
2. Screen shows:
   - **Primary (big green button):** "Contribute with M-Pesa" → enter amount → STK push sent to phone
   - **Secondary (small link, only if user has fiat UT):** "Use Utility Tokens (you have X UT)"
3. M-Pesa callback received → fiat-backed UT deducted from user's pool → contribution recorded.
4. Project progress bar updates → user receives confirmation + IP award.

---

## 3. Treasury Structure

```
Platform Till (M-Pesa)
        │
        ├── Dues payments ──────────────► Ward treasury (KES)
        │                                      │
        ├── Project contributions ─────────────┤
        │                                      ▼
        └── Grants/partnerships ────► Platform treasury (KES)
                                            │
                                            ▼
                               Disbursed via governance vote
                               (PR-weighted proposal + tally)
```

**On-chain layer (future):**
- Ward treasury balances mirrored on-chain for transparency
- Disbursements require on-chain governance vote
- Treasury smart contract on Base L2

---

## 4. UT Cash-Out Design (Fiat-Backed UT Only)

> **Critical distinction**: Only UT that was converted from fiat (M-Pesa deposits) can be cashed out.
> UT earned through platform activity (education, referrals, contributions) has **no cash-out path**. Ever. (ADR-004)

### User Flow

**Wallet / Profile screen:**
```
UT Balance
  Fiat-backed: 3,450 UT  ≈ KSh 3,450
  Earned:        850 UT  (platform perks only)

  [Cash Out to M-Pesa]  ← only draws from fiat-backed pool
```

**Cash-out screen:**
```
Amount: [3,450 UT] (max) or enter custom
Quick: [500]  [1,000]  [2,000]  [All]

M-Pesa number: 07XX XXX XXX  (pre-filled, editable)

Withdrawal fee: 1%  (KSh 34.50)
You receive: KSh 3,415.50

[Withdraw to M-Pesa]
```

**Confirmation:**
- "Withdrawal requested — expect funds in 5–30 minutes"
- Appears in transaction history: "Withdrew 3,450 UT → KSh 3,415.50"

### Backend Flow

1. User requests withdrawal of X UT from fiat-backed pool
2. Backend validates:
   - Fiat-backed pool balance ≥ X
   - Phone number is verified and matches profile
   - Daily limit not exceeded (e.g., max KSh 50,000/day)
   - Weekly limit not exceeded (configurable)
3. Deduct X from `user.fiatBackedUtBalance`
4. Queue BullMQ job: `process-mpesa-payout`
   - Calls M-Pesa Daraja B2C API (Business to Customer)
   - Sends KES (X minus fee) to user's verified phone
5. **On success:** record transaction, send push/email confirmation
6. **On failure:** refund `user.fiatBackedUtBalance`, notify user and admin, flag for manual review

### Safety Design

| Control | Why |
|---|---|
| Verified phone number required | Prevents sending funds to wrong number |
| Daily/weekly withdrawal limits | Reduces fraud blast radius |
| Separate fiat-backed pool in DB | Can never accidentally cash out earned UT |
| BullMQ job with retry + dead-letter | Failed payouts are recoverable, not silently lost |
| Fee disclosure on every screen | Regulatory transparency |
| Audit trail for every movement | Compliance + debugging |

---

## 5. Real-Life Project Funding Flow Examples

### Example: Borehole Drilling (KSh 200,000 target)

1. Ward creates proposal: "Drill community borehole — KSh 200,000"
2. Proposal passes governance vote (PR-weighted)
3. Project page opens with funding target and M-Pesa till
4. Members contribute via M-Pesa or fiat-backed UT
5. Once target hit: project moves to ACTIVE, milestones unlocked
6. Funds disbursed to contractor via platform-controlled account (M-Pesa B2B)
7. Milestones reported with photo evidence → approved by ward members
8. On completion: contributor IP awards issued, project marked COMPLETED

### Example: Monthly Dues Payment

1. User opens "Commitment Dues — KSh 500 due 28 Feb"
2. Options:
   - **M-Pesa** (big button) → STK push
   - **Utility Tokens** (small link, only if fiat-backed balance ≥ 500)
3. On payment: +10 PR award, dues status cleared, no penalty this month

---

## 6. Summary – Final Design

| Flow | Asset used | Cash-out possible? |
|---|---|---|
| M-Pesa → platform | KES → fiat-backed UT | Yes (1:1 minus fee) |
| Education completion | Earned UT | No |
| Referral bonus | Earned UT | No |
| Project contribution reward | Earned UT or IP | No |
| Ward dues payment (UT) | Either pool (fiat first) | N/A |
| Treasury disbursement | KES via M-Pesa B2B | Platform-controlled |

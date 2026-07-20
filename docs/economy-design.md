# UjamaaDAO – Economy & Reputation Design

**Version:** 1.0
**Last updated:** March 2026
**Scope:** Participation Rights (PR), Utility Tokens (UT), Impact Points, and how they interconnect.

> This is the design reference for the economy module. For implementation status see `docs/features.md`.
> For ADR decisions on token rules see `ai_workflows/DECISIONS.md`.

---

## 1. Economy Module

### 1.1 Philosophy

The economy is not a speculative token experiment. It is a **participation accounting system** — a way of measuring who is doing real work in the community and rewarding them proportionally.

Three principles guide every design decision:

1. **Rewards must trace to real value.** No grinding. No farming. Every PR award must be causally linked to an action that creates collective benefit.
2. **Active contributors must not be out-governed by inactive ones.** The regeneration and decay mechanics exist specifically to prevent this.
3. **Real money stays in real money rails.** M-Pesa handles KES. Tokens handle internal accounting. The two are bridged only at controlled, explicit points.

---

### 1.2 Participation Rights (PR)

#### Purpose

PR is the governance token. It determines how much weight your vote carries in proposals.

#### Earning

| Reason | Amount | Notes |
|---|---|---|
| Phone verification | +10 PR | One-time |
| Email verification | +20 PR | One-time |
| Community verification | +50 PR | One-time (3 vouches required) |
| Location verification | +30 PR | One-time |
| Casting a vote | +5 PR | Per proposal, while active |
| Paying dues on time | +10 PR | Per month |
| Project contribution | +variable | Based on contribution size |
| Education module completion | +5 PR | Per module, once only |
| Referral (future) | +25 PR | On successful referral verification |

#### Monthly Regeneration (Activity-Gated)

PR regenerates on the 1st of each month at 00:05. Regeneration is **not automatic for all users** — it requires minimum activity in the prior month (ADR-024):

- At least one of: cast a vote, paid dues on time, made a marketplace transaction, gave a vouch
- AND: logged in at least once in the prior 30 days

Users who do not meet the threshold receive 0 regen that month.

**Base regen amounts (example — adjust in config):**

| Verification Level | Base Monthly Regen |
|---|---|
| EMAIL_VERIFIED | 20 PR |
| COMMUNITY_VERIFIED | 50 PR |
| LOCATION_VERIFIED | 75 PR |

#### Soft Inactivity Decay

After 60 consecutive days of no qualifying activity (see regen threshold above):
- -5% PR per month
- Minimum floor: 100 PR (cannot go below)
- Decay stops immediately on return to qualifying activity

#### Penalties

Daily penalties apply for commitment breaches:
- Missed dues payment past grace period: -20 PR/day until resolved
- Other commitment types configurable per group/ward

#### Spending

PR is spent (burned) when:
- Creating a voluntary group: costs `VOLUNTARY_GROUP_PR_COST` (configurable)
- Future: proposal creation may require PR stake

#### PR is Non-Transferable

PR is soulbound. It cannot be sent, traded, or converted into any other asset. Period. (ADR-003)

#### Voting Power

Voting power = PR balance at snapshot time when a proposal's voting period opens. Power does not change during the vote, even if your balance changes.

---

### 1.3 Utility Tokens (UT)

#### Two Separate Pools

This is the most important implementation detail for UT:

| Pool | Source | Cashable? | Purpose |
|---|---|---|---|
| **Fiat-backed UT** | User deposits KES via M-Pesa → receives equivalent UT | **Yes** (withdrawal back to M-Pesa) | Real economic transactions, dues payment, treasury contributions |
| **Earned UT** | Platform rewards (education completion, etc.) | **No** | Internal platform perks, cosmetic unlocks, gamification |

These must be tracked separately in the database. When a user cashes out, only the fiat-backed pool is drawn from. (ADR-004, ADR-026)

#### Earning UT (Earned Pool — not cashable)

| Action | Amount |
|---|---|
| Completing education module | 50–100 UT (configurable) |
| Referral bonus (future) | 200 UT |
| Ward milestone achievement (future) | variable |

Anti-exploit safeguards for education rewards:
- User must be at minimum EMAIL_VERIFIED to receive rewards
- One reward per module per user (enforced by DB constraint)
- Modules must include a quiz with minimum pass score
- Reward is only issued on first completion, not retakes

#### Depositing / Withdrawing UT (Fiat-backed Pool)

**Deposit flow:**
1. User initiates "Add funds" in app
2. App generates a till number / STK push via M-Pesa Daraja API
3. User pays KES via M-Pesa
4. Backend receives M-Pesa callback → credits user's fiat-backed UT pool (1 UT = 1 KES)
5. Confirmation + receipt shown in app

**Withdrawal / Cash-out flow (fiat-backed UT only):**
1. User requests withdrawal from the fiat-backed UT pool
2. Backend checks:
   - User has ≥ requested amount in fiat-backed pool
   - Phone number verified & matches profile
   - Daily/weekly withdrawal limits not exceeded (e.g., max KSh 50,000/day)
3. Deduct from fiat-backed pool
4. Queue BullMQ job: `process-mpesa-payout`
   - Calls M-Pesa Daraja B2C API
   - Sends KES (amount minus fee) to user's verified phone number
5. On success: record transaction, send push/email confirmation
6. On failure: refund fiat-backed pool, notify user and admin

**Rate:** 1 UT = 1 KES (subject to change; fee disclosure required on withdrawal screen)

#### UT Uses (Both Pools)

- Pay marketplace listing fees (future)
- Pay commitment dues (alternative to M-Pesa direct)
- Cosmetic unlocks (profile themes, badges)
- Visibility boosts in marketplace (future)
- Contribution to ward projects / group treasury

---

## 2. Reputation Module – Impact Points

### Purpose

Impact Points (IP) are a reputation score. They are not spendable, not transferable, and not related to governance power. They are a **trust signal** — visible to other users to help them decide whether to vouch for, transact with, or delegate to someone.

### Earning

| Action | Points |
|---|---|
| Giving a vouch (approved) | +10 IP |
| Receiving a vouch | +15 IP |
| Successful marketplace transaction (future) | +5 IP |
| Completing education module | +3 IP |
| Project contribution acknowledged | +10 IP |
| Community verification achieved | +25 IP |

### Decay (Planned)

Slow decay to prevent stale reputation:
- -5% IP per month after 60 days of no qualifying activity
- Minimum floor: 0 IP
- Stops on return to activity

### Display

- Shown as a chip/badge on profiles (3-col grid alongside PR and UT)
- Tier system (Bronze → Silver → Gold → Platinum) based on accumulated IP (thresholds TBD)

---

## 3. How the Three Systems Interconnect

```
Verification milestone
      │
      ├──► +PR (governance weight)
      ├──► +IP (reputation score)
      └──► Unlocks: marketplace, governance, group creation

Voting on proposal
      │
      ├──► +PR (participation reward)
      └──► +IP (small)

Education module completion
      │
      ├──► +Earned UT (internal perks, not cashable)
      ├──► +IP (small)
      └──► +PR (small)

Paying dues on time
      │
      ├──► +PR (on-time bonus)
      └──► Avoids daily PR penalty

M-Pesa deposit
      │
      └──► +Fiat-backed UT (cashable 1:1)

Withdrawal request
      │
      └──► Fiat-backed UT → KES via M-Pesa B2C
```

---

## 4. Design Recommendations for Robustness & Fairness

### Economy (PR + UT)

- Activity-gate PR regen (see ADR-024) — prevents inactive accumulation
- Soft decay after 60 days (see ADR-025) — keeps governance tied to ongoing engagement
- Keep fiat-backed and earned UT in separate DB columns/tables — never mix pools
- All PR adjustments (awards, penalties, manual) must go through the audit trail
- Monthly regen amounts are configurable; adjust based on real usage data after pilot

### Reputation (Impact Points)

- IP should become visible on marketplace listings as trust signal
- Consider "top contributor" leaderboard per ward (drives prosocial competition)
- IP milestone bonuses for PR (e.g., 1,000 IP = +50 PR one-time bonus) to link systems

### Overall Ecosystem Balance

- Review regen amounts after first 3-month pilot to tune for engagement without inflation
- Monitor ratio of active → inactive users; if inactive > 30%, tighten activity gate
- Do not introduce PR→UT or UT→PR conversions — keeps governance power clean and unspeculative

---

## 5. Education Module Rewards — Why It Works

Paying small UT rewards for education completion is valuable because:

1. **Higher onboarding retention**: Immediate "skin in the game" reduces drop-off after sign-up.
2. **Early liquidity**: New users get a small UT balance → can try a marketplace purchase → network effects start sooner.
3. **Active contributor pipeline**: Users who finish modules are far more likely to verify, list in marketplace, vouch, and vote.
4. **Cost is negligible**: 100 UT (~KSh 100) once per user is trivial compared to lifetime value.

Anti-exploit safeguards:
- Verification gate (minimum EMAIL_VERIFIED)
- One reward per module per user
- Quiz pass required (minimum score)
- Rate limiting on module completion endpoint
- Rewards are earned UT (not cashable) — no direct financial incentive to spam

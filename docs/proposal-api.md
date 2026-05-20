# Governance / Proposals API Documentation

> **Module status:** `tested` — 121 green tests across 4 files.
> Base URL: `http://localhost:4000/api/v1/governance`

---

## Overview

The Governance module handles the full proposal lifecycle: draft → review → voting → tally, with a memory layer for rationale documentation and real-world outcome recording.

Voting power is **PR-weighted** — a snapshot of each member's PR balance is taken when voting opens. Balance changes after the snapshot do not affect vote weight.

All endpoints require authentication.

---

## Proposal Lifecycle

```
DRAFT
  │
  ▼ (LEADER forwards)
PENDING_REVIEW          ← location admin must approve
  │
  ▼ (location admin approves)
APPROVED_FOR_VOTING     ← LEADER can now open voting
  │
  ▼ (LEADER opens voting)
VOTING
  │
  ▼ (tally called / voting period ends)
APPROVED | REJECTED
  │           │
  │           ▼ (creator resubmits — up to 3 times)
  │         DRAFT  ← resubmissionCount incremented; reviewNote kept so creator sees why it was rejected
  ▼
EXECUTING ──► COMPLETED   (optional outcome tracking)
```

**Shortcut for voluntary GROUP-scope proposals:** DRAFT → APPROVED_FOR_VOTING directly (no location admin review step).

**Rejection and resubmission:**
- A `REJECT` decision requires a `note` (minimum 10 characters).
- When `tallyVotes()` produces a REJECTED outcome, a rejection reason is auto-generated: quorum failure or approval-majority failure.
- The creator may call `POST /:proposalId/resubmit` to reset REJECTED → DRAFT and revise the proposal. Maximum 3 resubmissions (`resubmissionCount` field). The `reviewNote` is preserved in DRAFT so the creator can see why it was rejected.

**Tally authorisation:**
- When called by a user, `POST /:proposalId/tally` requires the caller to be the group LEADER or a location admin (same auth as `start-voting`).
- The daily cron job (`TALLY_PROPOSALS_JOB`) calls tally without a caller — this path bypasses the auth check.

---

## Proposal Memory Layer

Every proposal can carry structured documentation:

| Field | When editable | Who can edit |
|---|---|---|
| `rationale` | DRAFT or PENDING_REVIEW only | Creator |
| `alternatives` | DRAFT or PENDING_REVIEW only | Creator |
| `outcome` | After APPROVED status | Creator or group leader |
| `outcomeRecordedAt` | Set automatically when outcome is recorded | — |

---

## Endpoints

### `GET /governance`
List proposals. Returns summary view with vote counts and funding amounts.
**Auth:** required

**Query params:** `groupId` · `status` · `scope` (GROUP/COMMUNITY) · `page` · `limit`

**Response `200`:** paginated array of proposal summaries.

---

### `GET /governance/needs-action`
Proposals that require action from the caller (pending review, pending vote, etc.).
**Auth:** required

**Response `200`:** array of proposals needing the caller's attention.

---

### `GET /governance/:proposalId`
Get full detail for a single proposal including votes and co-funding fields.
**Auth:** required

**Response `200`:**
```json
{
  "id": "...",
  "groupId": "...",
  "title": "...",
  "description": "...",
  "status": "VOTING",
  "proposalType": "COMMUNITY_INITIATIVE",
  "scope": "GROUP",
  "fundingAmountKes": 200000,
  "groupFundingAmount": 50000,
  "locationFundingRequest": 150000,
  "rationale": "...",
  "alternatives": "...",
  "outcome": null,
  "outcomeRecordedAt": null,
  "createdAt": "...",
  "votingStartsAt": "...",
  "votingEndsAt": "...",
  "votes": [
    { "userId": "...", "option": "YES", "prWeight": 150 }
  ]
}
```

**Responses:** `200 OK` · `404 Not Found`

---

### `POST /governance/create`
Create a new proposal. Initial status is `DRAFT`.
**Auth:** required

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `groupId` | string (UUID) | Yes | Group this proposal belongs to |
| `title` | string (min 10) | Yes | |
| `description` | string (min 50) | Yes | |
| `proposalType` | string (enum) | Yes | e.g. `COMMUNITY_INITIATIVE`, `INFRASTRUCTURE`, `POLICY` |
| `scope` | `GROUP` \| `COMMUNITY` | No | Default `GROUP` |
| `fundingAmountKes` | number | No | |
| `groupFundingAmount` | number | No | Group's share of co-funded proposal |
| `locationFundingRequest` | number | No | Amount requested from location treasury |
| `rationale` | string | No | Why this proposal is needed |
| `alternatives` | string | No | Alternatives considered |

**Responses:**
- `201 Created` — proposal object in `DRAFT` status. PR cost deducted.
- `400 Bad Request` — validation failure.
- `403 Forbidden` — insufficient PR or IP percentile too low for scope.
- `404 Not Found` — group not found.

---

### `POST /governance/:proposalId/review`
Approve or reject a proposal awaiting location admin review.
**Auth:** required · **Role:** location admin for the group's ward/constituency/county

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `decision` | string | Yes | `APPROVE` \| `REJECT` |
| `note` | string (max 500) | **Required when `decision=REJECT`** (min 10 chars) | Reason for rejection shown to the creator |

**Responses:**
- `200 OK` — status updated to `APPROVED_FOR_VOTING` or `REJECTED`.
- `400 Bad Request` — proposal not in `PENDING_REVIEW`, or `decision=REJECT` without a note.
- `403 Forbidden` — caller is not the required location admin.
- `404 Not Found` — proposal not found.

---

### `POST /governance/:proposalId/start-voting`
Open the voting period. Takes a PR snapshot of all eligible group members.
**Auth:** required · **Role:** group LEADER

**Responses:**
- `200 OK` — proposal updated to `VOTING`, snapshot recorded, members notified.
- `400 Bad Request` — proposal not in `APPROVED_FOR_VOTING`.
- `403 Forbidden` — caller is not the group leader.
- `404 Not Found` — proposal not found.

---

### `POST /governance/:proposalId/vote`
Cast a vote on an active (`VOTING`) proposal.
**Auth:** required

**Body:**
| Field | Type | Values |
|---|---|---|
| `option` | string | `YES` \| `NO` \| `ABSTAIN` |

**Responses:**
- `200 OK` — vote recorded with PR weight. +5 PR awarded.
- `400 Bad Request` — proposal not in `VOTING` status, or already voted.
- `404 Not Found` — proposal not found.

---

### `POST /governance/:proposalId/tally`
Close voting and tally results. Sets proposal to `APPROVED` or `REJECTED`. Creator and group members are notified. A rejection reason (`reviewNote`) is auto-generated on REJECTED outcomes.
**Auth:** required · **Role:** group LEADER or location admin (same as `start-voting`). The daily cron job calls this without authentication.

**Response `200`:**
```json
{
  "result": "APPROVED",
  "yesWeight": 1200,
  "noWeight": 400,
  "abstainWeight": 100,
  "totalVoters": 23,
  "quorumMet": true
}
```

**Responses:** `200 OK` · `400 Bad Request` (not in VOTING) · `403 Forbidden` (user call without leader/admin role) · `404 Not Found`

---

### `POST /governance/:proposalId/resubmit`
Reset a `REJECTED` proposal back to `DRAFT` for revision and resubmission.
**Auth:** required · **Only:** proposal creator

Preserves the rejection `reviewNote` in DRAFT so the creator can see why it was rejected. Resets vote counts, voting window, and review assignment. Maximum 3 resubmissions per proposal (`resubmissionCount` field).

**Responses:**
- `200 OK` — proposal reset to `DRAFT`, `resubmissionCount` incremented.
- `400 Bad Request` — proposal not in `REJECTED` status, or `resubmissionCount` has reached 3.
- `403 Forbidden` — caller is not the proposal creator.
- `404 Not Found` — proposal not found.

---

### `PATCH /governance/:proposalId/memory`
Update rationale and/or alternatives documentation. Only editable before voting begins.
**Auth:** required · **Only:** proposal creator

**Body:**
| Field | Type | Required |
|---|---|---|
| `rationale` | string (min 10, max 2000) | No |
| `alternatives` | string (min 10, max 2000) | No |

**Responses:**
- `200 OK` — updated `{ id, rationale, alternatives }`.
- `400 Bad Request` — proposal is past `PENDING_REVIEW` stage (voting has opened or proposal was rejected).
- `403 Forbidden` — caller is not the proposal creator.
- `404 Not Found` — proposal not found.

---

### `PATCH /governance/:proposalId/outcome`
Record the real-world outcome of a passed proposal. Used for community accountability — what actually happened after the proposal was approved and executed.
**Auth:** required · **Only:** proposal creator or group leader

**Body:**
| Field | Type | Required |
|---|---|---|
| `outcome` | string (min 10, max 2000) | Yes |

**Responses:**
- `200 OK` — updated `{ id, outcome, outcomeRecordedAt }`.
- `400 Bad Request` — proposal has not reached `APPROVED`, `EXECUTING`, or `COMPLETED` status.
- `403 Forbidden` — caller is neither the creator nor the group leader.
- `404 Not Found` — proposal not found.

---

## Notes

- Voting power is determined by PR balance at snapshot time, not at vote-cast time.
- Each user can vote once per proposal. Attempting to vote again returns `400`.
- Quorum: minimum 40% of eligible members must vote; of those, 50%+ YES weight required for APPROVED.
- `proposalScope` defaults to `GROUP` when `groupId` is provided and no explicit scope is sent.
- National/community proposals with no ward/constituency/county binding skip the primaryWard residency check on voting — any verified member may vote.
- `resubmissionCount` tracks how many times a proposal has been reset from REJECTED to DRAFT. Maximum is 3.
- On REJECTED tally outcome, `reviewNote` is auto-set: "Voting closed: proposal did not achieve quorum (X% turnout, 40% required)" or "…did not achieve approval majority (X% yes, 50% required)".
- Proposal types: `COMMUNITY_INITIATIVE`, `INFRASTRUCTURE`, `POLICY`, `EMERGENCY`, `BUDGET`, `ELECTION`.
- Scope `COMMUNITY` proposals appear on the public Platform Governance page (`/governance`).
- Co-funding: `groupFundingAmount` is drawn from the group treasury; `locationFundingRequest` is drawn from the ward/constituency/county treasury when approved by the location admin.
- The memory layer (`rationale`, `alternatives`, `outcome`) is displayed on the frontend proposal detail page. Outcome recording is voluntary — it is for community accountability, not enforced.
- Status `PASSED` does not exist — the correct post-tally status is `APPROVED`.

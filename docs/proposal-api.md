# Governance / Proposals API Documentation

> **Module status:** `tested` — 47 green tests across 2 files (25 service unit + 22 route integration).
> Base URL: `http://localhost:4000/api/v1/governance`

---

## Overview

The Governance module handles proposal lifecycle: create → start voting → cast votes → tally.

Voting power is **PR-weighted** — your PR balance at the moment a proposal's voting period starts is your voting power for that proposal (snapshot). Balance changes after the snapshot do not affect your vote weight.

All endpoints require authentication.

---

## Proposal Lifecycle

```
DRAFT ──► VOTING ──► CLOSED (PASSED | FAILED)
  │          │
create    start-voting
         (any group member)
```

---

## Endpoints

### `GET /governance`
List all proposals. Returns summary view.
**Auth:** required

**Response `200`:** array of proposal objects with `status`, `voteCount`, `fundingAmountKes`.

---

### `GET /governance/:proposalId`
Get full detail for a single proposal.
**Auth:** required

**Response `200`:**
```json
{
  "id": "...",
  "groupId": "...",
  "title": "...",
  "description": "...",
  "status": "VOTING",
  "fundingAmountKes": 200000,
  "isEmergency": false,
  "createdAt": "...",
  "votingStartedAt": "...",
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
| `groupId` | string (UUID) | Yes | The group this proposal belongs to |
| `title` | string (min 10) | Yes | |
| `description` | string (min 50) | Yes | |
| `fundingAmountKes` | number | No | Required if proposal requests funds |
| `isEmergency` | boolean | No | Defaults to `false` |

**Responses:**
- `201 Created` — proposal object in `DRAFT` status.
- `400 Bad Request` — validation failure.
- `404 Not Found` — group not found.

---

### `POST /governance/start-voting`
Move a proposal from `DRAFT` to `VOTING`. Takes a PR snapshot of all eligible voters.
**Auth:** required

**Body:** `{ "proposalId": "<uuid>" }`

**Responses:**
- `200 OK` — proposal updated to `VOTING`, snapshot recorded.
- `400 Bad Request` — proposal not in `DRAFT` status.
- `404 Not Found` — proposal not found.

---

### `POST /governance/vote`
Cast a vote on an active (`VOTING`) proposal.
**Auth:** required

**Body:**
| Field | Type | Values |
|---|---|---|
| `proposalId` | string (UUID) | — |
| `option` | string (enum) | `YES` · `NO` · `ABSTAIN` |

**Responses:**
- `200 OK` — vote recorded with PR weight.
- `400 Bad Request` — proposal not in `VOTING` status, or already voted.
- `404 Not Found` — proposal not found.

---

### `POST /governance/:proposalId/tally`
Close voting and tally results. Sets proposal to `CLOSED` with `PASSED` or `FAILED`.
**Auth:** required

**Response `200`:**
```json
{
  "result": "PASSED",
  "yesWeight": 1200,
  "noWeight": 400,
  "abstainWeight": 100,
  "totalVoters": 23
}
```

**Responses:** `200 OK` · `400 Bad Request` (not in VOTING) · `404 Not Found`

---

## Notes

- Vote options are `YES`, `NO`, `ABSTAIN` — not `For`/`Against`.
- Voting power is determined by PR balance at snapshot time — not at vote-cast time.
- Each user can vote once per proposal. Attempting to vote again returns `400`.
- PR award for casting a vote: `+5 PR` (via economy module event listener).
- Emergency proposals (`isEmergency: true`) may bypass normal quorum requirements (logic TBD).
- Proposal comments, quorum thresholds, and delegate voting are planned but not yet implemented.

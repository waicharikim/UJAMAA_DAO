# Elections API Documentation

> **Module status:** `partial` — full backend lifecycle implemented; no unit tests yet.
> Base URL: `http://localhost:4000/api/v1/elections`

---

## Overview

Democratic leadership elections for community groups. Elections cycle automatically through phases:

```
SCHEDULED → NOMINATIONS_OPEN → VOTING_OPEN → TALLIED
```

Four BullMQ jobs on the `governance` queue handle phase transitions daily.

Elections use a **50%+1 quorum** rule. A nomination requires a PR stake. Winners are assigned the `LEADER` group role automatically by the `applyResult()` service.

---

## Endpoints

All endpoints require a valid Bearer token (EMAIL_VERIFIED minimum unless noted).

### `GET /elections`

**Auth:** Bearer token (EMAIL_VERIFIED)

List all elections. Supports filtering.

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `groupId` | string (UUID) | Filter by group |
| `status` | string | `SCHEDULED` \| `NOMINATIONS_OPEN` \| `VOTING_OPEN` \| `TALLIED` |

**Response `200`:**
```json
{
  "success": true,
  "elections": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "groupName": "Lang'ata Ward Community",
      "status": "VOTING_OPEN",
      "nominationsOpenAt": "2026-05-01T00:00:00.000Z",
      "votingOpenAt": "2026-05-08T00:00:00.000Z",
      "votingCloseAt": "2026-05-15T00:00:00.000Z",
      "candidateCount": 3,
      "voteCount": 47
    }
  ]
}
```

---

### `GET /elections/mine`

Elections where the authenticated user is a candidate.

---

### `GET /elections/:electionId`

Full election detail including candidates and vote counts.

**Response `200`:**
```json
{
  "success": true,
  "election": {
    "id": "uuid",
    "status": "VOTING_OPEN",
    "candidates": [
      {
        "id": "uuid",
        "userId": "uuid",
        "userName": "Amina Wanjiku",
        "statement": "I will represent the ward with integrity.",
        "voteCount": 12
      }
    ],
    "winner": null,
    "myVote": null
  }
}
```

---

### `POST /elections/:electionId/nominate`

**Auth:** Bearer token (COMMUNITY_VERIFIED)

Self-nominate as a candidate. Requires a PR stake (deducted automatically).

**Body:**
```json
{ "statement": "I will represent the ward with integrity." }
```

**Response `201`:** `{ "success": true, "candidateId": "uuid", "prDeducted": 5 }`

**Errors:**
- `400` — Election is not in `NOMINATIONS_OPEN` status.
- `403` — Insufficient PR for nomination stake.

---

### `DELETE /elections/:electionId/nomination`

**Auth:** Bearer token (COMMUNITY_VERIFIED)

Withdraw a self-nomination (only during NOMINATIONS_OPEN phase). PR stake is not refunded.

---

### `POST /elections/:electionId/vote`

**Auth:** Bearer token (COMMUNITY_VERIFIED)

Cast a vote for a candidate. One vote per user per election.

**Body:**
```json
{ "candidateId": "uuid" }
```

**Response `200`:** `{ "success": true }`

**Notes:**
- Voting weight is proportional to the user's PR balance at the time they vote.
- Triggers `governance_basics` onboarding auto-completion.

---

### `POST /elections/admin/schedule`

**Auth:** Bearer token (SUPER_ADMIN role)

Manually schedule an election for a group.

**Body:**
```json
{
  "groupId": "uuid",
  "nominationsOpenAt": "2026-06-01T00:00:00.000Z",
  "votingOpenAt": "2026-06-08T00:00:00.000Z",
  "votingCloseAt": "2026-06-15T00:00:00.000Z"
}
```

---

### `POST /elections/admin/:electionId/tally`

**Auth:** Bearer token (SUPER_ADMIN role)

Manually trigger tally for an election that has closed.

---

## Background Jobs (Governance Queue)

| Job | Schedule | Effect |
|---|---|---|
| `schedule-elections` | 1st of month, 01:00 | Creates elections for eligible groups |
| `open-nominations` | Daily 00:15 | Opens nominations for scheduled elections |
| `open-voting` | Daily 00:20 | Opens voting for elections with nominations closed |
| `tally-results` | Daily 00:25 | Tallies closed elections and assigns winners |

---

## Frontend

- `/elections` — list page with status filter tabs and action banner
- `/elections/[id]` — detail with nomination form, vote buttons, candidate cards, winner display
- Elections tab appears in group wall (`/groups/[id]`) — fetches elections for that group via `GET /elections?groupId=`
- Elections in sidebar and mobile primary nav

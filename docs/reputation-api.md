# Reputation API Documentation

> **Module status:** `tested` — 23 green tests (12 service unit + 11 route integration).
> Base URL: `http://localhost:4000/api/v1/reputation`

---

## Overview

Impact Points (IP) measure a user's cumulative contribution to their ward and the platform. IP is a reputation score — not spendable, not transferable. Unlike PR, IP does not regenerate or decay.

PR (Participation Rights) is the governance token. Both are tracked here via the reputation module for leaderboard and profile display.

---

## Endpoints

All endpoints require a valid Bearer token (EMAIL_VERIFIED minimum).

### `GET /reputation/leaderboard`

**Auth:** Bearer token (EMAIL_VERIFIED)

Get the platform leaderboard.

**Query params:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `metric` | `combined` \| `ip` \| `pr` | `combined` | Sort by combined score, IP only, or PR only |
| `scope` | `global` \| `county` \| `ward` | `global` | Scope the leaderboard |
| `wardId` | string (UUID) | — | Required if `scope=ward` |
| `countyId` | string (UUID) | — | Required if `scope=county` |
| `limit` | number | 20 | Max results |
| `page` | number | 1 | Page number |

**Response `200`:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "userId": "uuid",
      "userName": "Amina Wanjiku",
      "avatarUrl": null,
      "impactPoints": 340,
      "participationRights": 85,
      "combinedScore": 425,
      "wardName": "Westlands",
      "isCurrentUser": false
    }
  ],
  "totalCount": 142,
  "currentUserRank": 12
}
```

---

### `GET /reputation/me`

Get the authenticated user's reputation summary.

**Response `200`:**
```json
{
  "success": true,
  "reputation": {
    "globalImpactPoints": 120,
    "wardImpactPoints": 85,
    "participationRights": 50,
    "verificationLevel": "COMMUNITY_VERIFIED",
    "wardName": "Lang'ata",
    "rank": { "global": 34, "ward": 5 }
  }
}
```

---

### `GET /reputation/me/history`

Get the authenticated user's IP earning history (paginated).

**Query params:** `limit` · `cursor`

**Response `200`:**
```json
{
  "success": true,
  "history": [
    {
      "id": "uuid",
      "points": 10,
      "reason": "PROPOSAL_CREATED",
      "description": "Created governance proposal",
      "awardedAt": "2026-05-09T12:00:00.000Z"
    }
  ],
  "nextCursor": "uuid"
}
```

---

### `GET /reputation/:userId`

Get a public user's reputation profile. Respects privacy settings — some fields may be hidden.

**Response `200`:** Same shape as `GET /reputation/me` (minus private fields).

---

## Frontend

- `/leaderboard` page: metric tabs (combined/IP/PR), scope tabs (global/county/ward), top-3 podium, ranked list with "You" badge.
- Profile page Activity tab: Ward Reputation card + IP History card wired to real API.
- `leaderboardApi` and `reputationApi` namespaces in `frontend/lib/api.ts`.

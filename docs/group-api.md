# Community / Groups API Documentation

> **Module status:** `tested` — 49 green tests across 4 files.
> Base URL: `http://localhost:4000/api/v1/community`

---

## Overview

The Community module manages two kinds of groups:

- **System groups** — created automatically by the platform (ward groups, etc.). Users are auto-enrolled on email verification. Cannot be manually joined.
- **Voluntary groups** — created by users, costs PR to create, users can join/leave freely.

All endpoints require authentication.

---

## Group Types

Voluntary groups have a `voluntaryType` field. Valid types include:
`BUSINESS_COLLECTIVE`, `SAVINGS_CREDIT`, `YOUTH_ORGANIZATION`, `PROJECT_EXECUTION`, `TECHNOLOGY_HUB` (and 35+ others seeded from spec).

---

## Endpoints

### `POST /community/voluntary/create`
Create a new voluntary group. Costs `VOLUNTARY_GROUP_PR_COST` PR (deducted at creation).
**Auth:** required

**Body:**
| Field | Type | Required |
|---|---|---|
| `name` | string (min 3) | Yes |
| `voluntaryType` | string (enum) | Yes |
| `description` | string | No |
| `avatarUrl` | string (URL) | No |

**Responses:**
- `201 Created` — group object returned. Creator is auto-added as `LEADER`.
- `400 Bad Request` — invalid `voluntaryType` or validation failure.
- `402/403` — insufficient PR.

---

### `POST /community/join`
Join a voluntary group. Cannot join system groups this way.
**Auth:** required

**Body:** `{ "groupId": "<uuid>" }`

**Responses:**
- `200 OK` — membership record returned.
- `400 Bad Request` — group is a system group.
- `409 Conflict` — already a member.
- `404 Not Found` — group not found.

---

### `POST /community/leave`
Leave a voluntary group. Cannot leave groups where `canLeave: false` (system groups or auto-enrolled).
**Auth:** required

**Body:** `{ "groupId": "<uuid>" }`

**Responses:**
- `200 OK` — `{ "success": true }`
- `403 Forbidden` — group membership has `canLeave: false`.
- `404 Not Found` — membership not found.

---

### `GET /community/my-groups`
List all groups the authenticated user belongs to (system + voluntary, active only).
**Auth:** required

**Response `200`:** array of group objects with membership details.

---

### `GET /community/:groupId`
Get full detail for a single group including user's own membership status.
**Auth:** required

**Response `200`:**
```json
{
  "id": "...",
  "name": "...",
  "isSystemGroup": false,
  "voluntaryType": "SAVINGS_CREDIT",
  "memberCount": 12,
  "userMembership": {
    "role": "MEMBER",
    "joinedAt": "...",
    "canLeave": true
  }
}
```

**Responses:** `200 OK` · `404 Not Found`

---

### `GET /community/:groupId/members?limit=&offset=`
Paginated member list for a group.
**Auth:** required

**Query params:**
| Param | Type | Default |
|---|---|---|
| `limit` | number | 20 |
| `offset` | number | 0 |

**Response `200`:** array of `GroupMemberDto`:
```json
{
  "userId": "...",
  "userName": "...",
  "avatarUrl": "...",
  "verificationLevel": "COMMUNITY_VERIFIED",
  "role": "LEADER",
  "joinedAt": "..."
}
```

---

## Notes

- System groups are auto-created from seed data. Users are enrolled via the `registerCommunityListeners()` event — triggered on `user.email.verified`.
- Group roles: `LEADER` (creator of voluntary group) or `MEMBER`.
- `canLeave: false` is set for system group memberships and auto-enrolled members who cannot opt out.
- `memberCount` on the `Group` model is currently a known bug — it is not updated atomically when members join/leave. Fix pending.
- Group admin routes (settings update, role change, kick member) are planned but commented out — see `group.routes.ts`.

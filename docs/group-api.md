# Community / Groups API Documentation

> **Module status:** `tested` — 82 green tests across 5 files.
> Base URL: `http://localhost:4000/api/v1/community`
> Conflict cases: `http://localhost:4000/api/v1/conflicts`

---

## Overview

The Community module manages two kinds of groups:

- **System groups** — created automatically by the platform (ward, constituency, county, national). Users are auto-enrolled on email verification. Cannot be manually joined or dissolved.
- **Voluntary groups** — created by users (costs PR), users can join/leave freely, and can be dissolved by the leader when the treasury is empty.

All endpoints require authentication.

---

## Group Types

Voluntary groups have a `voluntaryType` field. Valid types include:
`BUSINESS_COLLECTIVE`, `SAVINGS_CREDIT`, `YOUTH_ORGANIZATION`, `PROJECT_EXECUTION`, `TECHNOLOGY_HUB` (and 35+ others seeded from spec).

---

## Group Lifecycle

```
create (voluntary) → FORMING → ACTIVE → DISSOLVED
                         ↑
               system groups start here and never dissolve
```

---

## Endpoints

### `GET /community`
Discover groups. Paginated, filterable.
**Auth:** required

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `search` | string | Name filter |
| `voluntaryType` | string | Filter by type |
| `page` | number | Default 1 |
| `limit` | number | Default 20, max 100 |

**Response `200`:** array of group objects, each with `isMember` and `myRole` fields.

---

### `POST /community/voluntary/create`
Create a new voluntary group. Costs `VOLUNTARY_GROUP_PR_COST` PR (deducted at creation). Auto-generates a Ward Declaration document.
**Auth:** required

**Body:**
| Field | Type | Required |
|---|---|---|
| `name` | string (min 3) | Yes |
| `voluntaryType` | string (enum) | Yes |
| `description` | string | No |
| `avatarUrl` | string (URL) | No |
| `wardId` | string (UUID) | No |
| `constituencyId` | string (UUID) | No |
| `countyId` | string (UUID) | No |

**Responses:**
- `201 Created` — group object. Creator is auto-added as `LEADER`. Ward Declaration is auto-generated.
- `400 Bad Request` — invalid `voluntaryType` or validation failure.
- `403 Forbidden` — insufficient PR.

---

### `POST /community/join`
Join a voluntary group.
**Auth:** required

**Body:** `{ "groupId": "<uuid>" }`

**Responses:**
- `200 OK` — membership record returned.
- `400 Bad Request` — group is a system group (cannot be manually joined).
- `404 Not Found` — group not found.
- `409 Conflict` — already a member.

---

### `POST /community/leave`
Leave a voluntary group.
**Auth:** required

**Body:** `{ "groupId": "<uuid>" }`

**Responses:**
- `200 OK` — `{ "success": true }`
- `403 Forbidden` — membership has `canLeave: false`.
- `404 Not Found` — membership not found.

---

### `GET /community/my-groups`
List all groups the authenticated user belongs to (system + voluntary, active memberships only).
**Auth:** required

**Response `200`:** array of group objects with membership details.

---

### `GET /community/:groupId`
Get full detail for a single group including the caller's membership status.
**Auth:** required

**Response `200`:**
```json
{
  "id": "...",
  "name": "...",
  "isSystemGroup": false,
  "voluntaryType": "SAVINGS_CREDIT",
  "status": "ACTIVE",
  "memberCount": 12,
  "treasuryBalance": "0.00",
  "userMembership": {
    "role": "MEMBER",
    "joinedAt": "...",
    "canLeave": true
  }
}
```

**Responses:** `200 OK` · `404 Not Found`

---

### `GET /community/:groupId/members`
Paginated member list for a group.
**Auth:** required

**Query params:** `limit` (default 20) · `offset` (default 0)

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

### `GET /community/:groupId/my-role`
Get the caller's role in a specific group.
**Auth:** required

**Response `200`:** `{ "role": "LEADER" | "MEMBER" | null }`

---

### `GET /community/:groupId/declaration`
Retrieve the Ward Declaration genesis document for a group. Generated automatically when a voluntary group is created.
**Auth:** required

**Response `200`:**
```json
{
  "id": "...",
  "groupId": "...",
  "wardName": "Westlands",
  "registeredAt": "...",
  "declarationText": "You have always been the government..."
}
```

**Responses:** `200 OK` · `404 Not Found` (no declaration exists — system groups do not auto-generate one)

---

### `PATCH /community/:groupId/settings`
Update group name or description. **Leader only.**
**Auth:** required

**Body:**
| Field | Type | Required |
|---|---|---|
| `name` | string (min 3, max 100) | No |
| `description` | string (max 500) | No |

**Responses:** `200 OK` · `403 Forbidden` (not leader) · `404 Not Found`

---

### `PATCH /community/:groupId/members/:userId/role`
Change a member's role within the group. **Leader only.**
**Auth:** required

**Body:** `{ "role": "MEMBER" | "LEADER" | "TREASURER" | "SECRETARY" | "AUDITOR" | "FACILITATOR" | "MENTOR" | "MODERATOR" }`

**Responses:** `200 OK` · `403 Forbidden` · `404 Not Found`

---

### `DELETE /community/:groupId/members/:userId`
Remove a member from the group. **Leader only.**
**Auth:** required

**Responses:** `200 OK` · `403 Forbidden` · `404 Not Found`

---

### `DELETE /community/:groupId/dissolve`
Dissolve a voluntary group. **Leader only.** Group treasury must be zero (redistribute funds first).
**Auth:** required

**Body:**
| Field | Type | Required |
|---|---|---|
| `reason` | string (min 10, max 500) | No |

**Responses:**
- `200 OK` — `{ "success": true, "groupId": "...", "status": "DISSOLVED" }`
- `400 Bad Request` — system group (cannot be dissolved) or treasury balance > 0.
- `403 Forbidden` — caller is not the group leader.
- `409 Conflict` — group is already dissolved.

---

## Conflict Protocol

Structured dispute resolution between community members. Separate base URL.

Base URL: `http://localhost:4000/api/v1/conflicts`

All conflict endpoints require authentication.

### `POST /conflicts`
File a conflict case against another member.
**Auth:** required

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `respondentId` | string (UUID) | Yes | Cannot be the caller's own ID |
| `description` | string (min 20, max 2000) | Yes | |
| `evidence` | string[] (max 5 URLs) | No | |

**Responses:**
- `201 Created` — conflict case object with `status: "OPEN"`.
- `400 Bad Request` — self-conflict or validation failure.
- `404 Not Found` — respondent does not exist.

---

### `GET /conflicts/my-cases`
List all conflict cases where the caller is complainant or respondent.
**Auth:** required

**Response `200`:** array of case summaries ordered by `createdAt` desc.

---

### `GET /conflicts/:caseId`
Get full detail for a single conflict case. Only parties to the case can view it.
**Auth:** required

**Responses:**
- `200 OK` — full case object including complainant and respondent names.
- `403 Forbidden` — caller is not a party to the case.
- `404 Not Found` — case not found.

---

### `PATCH /conflicts/:caseId/resolve`
Mark a conflict case as resolved. Any authenticated user can act as mediator.
**Auth:** required

**Body:** `{ "resolution": "<string min 10, max 2000>" }`

**Response `200`:**
```json
{
  "id": "...",
  "status": "CLOSED",
  "resolution": "...",
  "mediatorId": "...",
  "resolvedAt": "..."
}
```

**Responses:** `200 OK` · `400 Bad Request` (resolution too short) · `404 Not Found` · `409 Conflict` (already closed)

---

## Notes

- System groups are auto-created from seed data. Users are enrolled via the `registerCommunityListeners()` event — triggered on `user.email.verified`.
- Group roles: `LEADER`, `MEMBER`, `TREASURER`, `SECRETARY`, `AUDITOR`, `FACILITATOR`, `MENTOR`, `MODERATOR`.
- `canLeave: false` is set for system group memberships.
- `memberCount` on the `Group` model is tracked and updated on join/leave.
- Ward Declaration is a founding document generated at group creation. It contains the Ujamaa manifesto text, ward name, creation date, and a short group ID. Cannot be deleted.
- Group dissolution requires zero treasury balance. Dissolving marks the group `DISSOLVED` and deactivates all memberships.

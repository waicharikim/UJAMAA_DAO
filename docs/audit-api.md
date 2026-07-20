# Audit & Feed API Documentation

> **Module status:** `tested` — 31 green tests (service unit + route integration for audit search + activity feed).
> Audit base URL: `http://localhost:4000/api/v1/audit`
> Feed base URL: `http://localhost:4000/api/v1/feed`

---

## Overview

Two related endpoints:

- **Audit log** (`/audit/search`) — raw event log for admin use. All events with full metadata.
- **Activity feed** (`/feed`) — public-safe, privacy-filtered stream for authenticated users. Designed for the dashboard "Recent Activity" card.

---

## Audit Log

### `GET /audit/search`

**Auth:** Bearer token + admin or compliance role (`SUPER_ADMIN`, `COMPLIANCE_OFFICER`, `WARD_ADMIN`, `CONSTITUENCY_ADMIN`, `COUNTY_ADMIN`)

Search the audit log. Results are **automatically scoped to the caller's geographic area** based on their role and `primaryWardId`:

| Caller role | Sees logs for users whose… |
|---|---|
| `SUPER_ADMIN` / `COMPLIANCE_OFFICER` | All users (no filter) |
| `COUNTY_ADMIN` | `primaryWard.countyId` matches caller's county |
| `CONSTITUENCY_ADMIN` | `primaryWard.constituencyId` matches caller's constituency |
| `WARD_ADMIN` | `primaryWardId` matches caller's ward exactly |

Geographic scope is derived from the caller's own `primaryWardId`. A WARD_ADMIN can only see audit events for users in their ward. The additional query params below further filter within that scope.

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `action` | string | Filter by event type (e.g. `PR_AWARDED`) |
| `userId` | string | Filter by actor (must be within caller's geographic scope) |
| `entityId` | string | Filter by affected entity |
| `fromDate` | ISO date | Date range start |
| `toDate` | ISO date | Date range end |
| `limit` | number | Default 50 |
| `page` | number | Default 1 |

**Response `200`:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "action": "PR_AWARDED",
      "actorId": "uuid",
      "actorName": "Amina Wanjiku",
      "entityId": "uuid",
      "entityType": "USER",
      "meta": { "amount": 10, "reason": "EMAIL_VERIFIED" },
      "createdAt": "2026-05-09T12:00:00.000Z"
    }
  ],
  "total": 1423
}
```

---

## Active Audit Events

| Action | Module | Trigger |
|---|---|---|
| `USER_CREATED` | auth | New user registration |
| `EMAIL_VERIFIED` | auth | Email verification completed |
| `PR_AWARDED` | economy | PR balance increased |
| `PR_SPENT` | economy | PR balance decreased |
| `DUES_PAID` | economy | Monthly dues payment processed |
| `COMMITMENT_CREATED` | economy | New dues commitment created |
| `MODULE_PUBLISHED` | education | Education module published (seed) |
| `GROUP_DISSOLVED` | community | Group dissolution |
| `CONFLICT_FILED` | community | Conflict case opened |
| `CONFLICT_RESOLVED` | community | Conflict case resolved |

---

## Activity Feed

### `GET /feed`

**Auth:** Bearer token (EMAIL_VERIFIED) — auth required even though data is public-safe

Cursor-paginated stream of recent platform activity. Returns 9 event types. Privacy rules enforced:
- Voter identity never exposed
- Emergency reporter identity never exposed
- Financial amounts stripped from feed metadata

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `limit` | number | Default 20, max 50 |
| `cursor` | string | Pagination cursor |

**Response `200`:**
```json
{
  "success": true,
  "items": [
    {
      "id": "uuid",
      "category": "GOVERNANCE",
      "title": "New proposal: Borehole in Kibera Ward",
      "description": "A new governance proposal has been submitted.",
      "entityId": "uuid",
      "entityType": "PROPOSAL",
      "deepLink": "/proposals/uuid",
      "createdAt": "2026-05-09T10:00:00.000Z"
    }
  ],
  "nextCursor": "uuid"
}
```

**Categories:** `GOVERNANCE` · `ECONOMIC` · `COMMUNITY` · `EMERGENCY` · `EDUCATION` · `MARKETPLACE`

**Deep links:** Frontend renders feed items as rich cards with left-border accent. Each category has a distinct color. Items link to entity detail pages (`/proposals/[id]`, `/groups/[id]`, `/projects/[id]`, `/marketplace`, `/education`).

---

## Feed vs Audit

| | Feed | Audit |
|---|---|---|
| Auth required | Yes (EMAIL_VERIFIED) | Yes (admin role) |
| Privacy | Enforced — reporter/voter hidden, amounts stripped | Full metadata visible |
| Audience | All platform users | Admin/compliance only |
| Purpose | Dashboard activity stream | Compliance + debugging |
| Source | `auditLog` (filtered) | `auditLog` (full) |

The feed is the dashboard "Recent Activity" card. `/feed` page redirect to `/dashboard` (feed content is dashboard-only).

---

## Seed Behavior

Seed data (`make db-seed`) explicitly calls `auditService.log()` for 22 feed-visible events on fresh setup. This ensures the feed shows activity from day one without needing real user actions. Seed bypasses the service layer (event bus doesn't fire) so audit calls must be explicit in seed files.

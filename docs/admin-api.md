# Admin API Documentation

> **Module status:** `tested` — 84 green tests (45 service + 39 routes).
> Base URL: `http://localhost:4000/api/v1/admin`

---

## Overview

The Admin module provides privileged platform management endpoints. All routes require:
1. A valid Bearer JWT token
2. An admin-level system role (enforced by RBAC middleware)

Non-admin requests return `403 Forbidden`.

The admin panel UI is accessible via the frontend when the user has a `system:super_admin` or `system:ward_admin` role. The panel shows tabs for: Overview, Users, Governance, Economy, Barazas.

---

## Access Control

| Role | Access |
|---|---|
| `system:super_admin` | Full access to all admin endpoints |
| `system:ward_admin` | Scoped access to ward-level data and Baraza management |
| `system:compliance_officer` | Read-only access to security events and audit logs |

---

## Platform Dashboard

### `GET /admin/stats`

**Auth:** Admin role

Get platform-wide statistics for the admin dashboard.

**Response `200`:**
```json
{
  "success": true,
  "stats": {
    "users": {
      "total": 342,
      "emailVerified": 280,
      "communityVerified": 190,
      "active30d": 156
    },
    "governance": {
      "totalProposals": 47,
      "activeVoting": 3,
      "passedThisMonth": 8
    },
    "economy": {
      "totalPrAwarded": 48200,
      "totalDuesCollected": 125000,
      "activeCommitments": 78
    }
  }
}
```

---

### `GET /admin/config`

**Auth:** Admin role

Get current system configuration.

**Response `200`:**
```json
{
  "success": true,
  "config": {
    "verificationVouchesRequired": 3,
    "prRegistrationBonus": 50,
    "prVoteReward": 5,
    "monthlyPrRegenBase": 10,
    "duesOrdinaryKes": 50,
    "duesSupporterKes": 150,
    "duesSponsorKes": 500
  }
}
```

---

## User Management

### `GET /admin/users`

**Auth:** Admin role

List and search all users.

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `search` | string | Text search on name, email, phone |
| `verificationLevel` | string | Filter by level |
| `status` | string | `ACTIVE` \| `SUSPENDED` \| `BANNED` |
| `wardId` | string | Filter by ward |
| `limit` | number | Default 20 |
| `page` | number | Default 1 |

**Response `200`:**
```json
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "name": "Amina Wanjiku",
      "email": "amina@example.com",
      "phoneNumber": "+254712345678",
      "verificationLevel": "COMMUNITY_VERIFIED",
      "status": "ACTIVE",
      "prBalance": 65,
      "createdAt": "2026-04-01T10:00:00.000Z",
      "wardName": "Westlands"
    }
  ],
  "total": 342
}
```

---

### `PATCH /admin/users/:userId/status`

**Auth:** SUPER_ADMIN role

Update a user's account status.

**Body:** `{ "status": "SUSPENDED", "reason": "Repeated policy violations." }`

---

### `POST /admin/users/:userId/pr/award`

**Auth:** SUPER_ADMIN role

Manually award PR to a user.

**Body:** `{ "amount": 20, "reason": "Manual community award — borehole project lead" }`

---

### `POST /admin/users/:userId/pr/deduct`

**Auth:** SUPER_ADMIN role

Manually deduct PR from a user.

**Body:** `{ "amount": 10, "reason": "Policy penalty" }`

---

## Role Management

### `GET /admin/roles`

**Auth:** Admin role

List all system roles and their current assignments.

---

### `POST /admin/roles/assign`

**Auth:** SUPER_ADMIN role

Assign a system role to a user.

**Body:** `{ "userId": "uuid", "role": "system:ward_admin" }`

---

### `DELETE /admin/roles/:userId/:role`

**Auth:** SUPER_ADMIN role

Remove a role assignment from a user.

---

## Governance

### `GET /admin/proposals`

**Auth:** Admin role

List proposals including DRAFT and PENDING_REVIEW (not visible to regular users).

---

### `POST /admin/proposals/:proposalId/approve`

**Auth:** WARD_ADMIN or SUPER_ADMIN (with location-scope check)

Override-approve a proposal for voting.

---

## Education Module Review

Admins review and approve or reject education modules submitted by community contributors. Only `COMMUNITY_VERIFIED` users who meet the tiered IP gate can submit modules — see `docs/education-api.md` for eligibility rules.

### `GET /admin/education/pending`

**Auth:** SUPER_ADMIN or COMPLIANCE_OFFICER

List all modules awaiting review (submitted but not yet approved or rejected), ordered by `submittedAt` ascending (oldest first).

**Query params:** `limit` (default 20), `page` (default 1)

**Response `200`:**
```json
{
  "success": true,
  "modules": [
    {
      "id": "uuid",
      "title": "Ward Budget Fundamentals",
      "submittedAt": "2026-05-20T10:00:00.000Z",
      "creator": {
        "id": "uuid",
        "name": "Amina Wanjiku",
        "verificationLevel": "COMMUNITY_VERIFIED"
      }
    }
  ],
  "total": 4
}
```

---

### `POST /admin/education`

**Auth:** SUPER_ADMIN or COMPLIANCE_OFFICER

Create a module directly as admin. Module is auto-approved (`verified: true`, `expertApproved: true`) — no review step required.

**Body:** Same fields as `POST /education` (title, description, content, duration, difficulty, category, completionIP).

**Response `200`:** `{ "success": true, "module": { ..., "verified": true } }`

---

### `POST /admin/education/:moduleId/approve`

**Auth:** SUPER_ADMIN or COMPLIANCE_OFFICER

Approve a submitted module. Sets `verified: true`.

**Errors:**
- `400` — module is a DRAFT (not yet submitted)
- `400` — module is already approved
- `404` — module not found

**Response `200`:** `{ "success": true }`

---

### `POST /admin/education/:moduleId/reject`

**Auth:** SUPER_ADMIN or COMPLIANCE_OFFICER

Reject a submitted module with a mandatory reason. Sets `rejectionReason`, clears `submittedAt` (so it returns to an editable state for the creator).

**Body:** `{ "reason": "Content is too brief and lacks depth." }` (minimum 10 characters)

**Errors:**
- `400` — module is a DRAFT (not submitted)
- `400` — module is already approved
- `400` — reason is fewer than 10 characters
- `404` — module not found

**Response `200`:** `{ "success": true }`

---

## Baraza Management

### `GET /integration/baraza-groups/all`

**Auth:** WARD_ADMIN or SUPER_ADMIN

See `docs/integration-api.md`. Returns all Baraza groups with attendance count. Accessed via the "Barazas" tab in the admin panel.

---

## Security Events

### `GET /auth/security-events/unresolved`

**Auth:** Admin role (COMPLIANCE_OFFICER, SUPER_ADMIN)

List all unresolved security events platform-wide (failed logins, brute force attempts, suspicious sessions).

---

### `PATCH /auth/security-events/:eventId/resolve`

**Auth:** Admin role

Resolve a security event.

**Body:** `{ "resolution": "Confirmed false positive — user reset their password." }`

---

## Bull Board (Queue Dashboard)

Visual queue monitoring at:

```
http://localhost:4000/admin/queues
```

HTTP Basic Auth: username `admin`, password `DASHBOARD_PASSWORD` env var (default `admin123` in dev — change before any shared deployment).

All 6 queues visible: `economy`, `governance`, `user-cleanup`, `notifications`, `integration`, `dead-letter`.

---

## Platform Config

### `GET /platform-config`

**Auth:** None (public)

Returns public platform configuration (verification thresholds, feature flags). Used by the frontend to dynamically adjust UI.

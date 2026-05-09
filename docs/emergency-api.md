# Emergency API Documentation

> **Module status:** `tested` — 30 green tests (13 service unit + 17 route integration).
> Base URL: `http://localhost:4000/api/v1/emergency`

---

## Overview

Community members can report emergencies. Verified responders manage the alert lifecycle. All activity is scoped to the ward or nearby wards.

Reporter identity is never exposed publicly — even in the activity feed, reporter details are stripped.

---

## Emergency Types

`FIRE` · `FLOOD` · `MEDICAL` · `SECURITY` · `ACCIDENT` · `OTHER`

---

## Alert Lifecycle

```
ACTIVE → IN_PROGRESS → RESOLVED
       ↘               ↗
         FALSE_ALARM
```

Severity is auto-assigned based on emergency type:
- `CRITICAL`: FIRE, FLOOD, MEDICAL
- `HIGH`: SECURITY, ACCIDENT
- `MEDIUM`: OTHER

---

## Endpoints

### `GET /emergency`

**Auth:** Bearer token (EMAIL_VERIFIED)

List active alerts for the authenticated user's ward area.

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `wardId` | string (UUID) | Filter by ward |
| `status` | string | Filter by status |
| `type` | string | Filter by emergency type |
| `limit` | number | Default 20 |

**Response `200`:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "uuid",
      "type": "FLOOD",
      "severity": "CRITICAL",
      "status": "ACTIVE",
      "title": "Road flooding on Ngong Road",
      "description": "Water rising. Avoid the area.",
      "wardId": "uuid",
      "wardName": "Lang'ata",
      "reportedAt": "2026-05-09T08:30:00.000Z",
      "responderId": null
    }
  ]
}
```

---

### `GET /emergency/:alertId`

**Auth:** Bearer token (EMAIL_VERIFIED)

Get a single alert. Reporter identity is always hidden.

---

### `POST /emergency`

**Auth:** Bearer token (EMAIL_VERIFIED)

Report an emergency.

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | Yes | `FIRE` \| `FLOOD` \| `MEDICAL` \| `SECURITY` \| `ACCIDENT` \| `OTHER` |
| `title` | string | Yes | |
| `description` | string | Yes | |
| `wardId` | string (UUID) | Yes | Ward where the incident occurred |
| `location` | string | No | Specific location description |

**Response `201`:** `{ "success": true, "alert": { ... } }`

Severity is set automatically — not by the reporter.

---

### `PATCH /emergency/:alertId/status`

**Auth:** Bearer token (COMMUNITY_VERIFIED + WARD_ADMIN role, or SUPER_ADMIN)

Update the alert status.

**Body:**
```json
{ "status": "IN_PROGRESS", "notes": "Responders dispatched." }
```

---

### `POST /emergency/:alertId/respond`

**Auth:** Bearer token (COMMUNITY_VERIFIED)

Register as a responder for an alert.

**Response `200`:** `{ "success": true }`

---

## Frontend

Dashboard shows an `EmergencyAlertsCard` with active alerts for the user's ward. Alert detail page shows the full lifecycle and responder status.

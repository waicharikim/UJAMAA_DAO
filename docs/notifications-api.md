# Notifications API Documentation

> **Module status:** `tested` — 43 green tests (20 service unit + 23 route integration).
> Base URL: `http://localhost:4000/api/v1/notifications`

---

## Overview

In-app notifications for platform events: proposal activity, PR awards, dues reminders, community updates. All endpoints require `EMAIL_VERIFIED` at minimum (full auth required via middleware).

Notifications are created by the backend automatically — users cannot create them directly.

---

## Notification Types

| Type | Description |
|---|---|
| `GOVERNANCE` | Proposal created, voting started, vote tallied, proposal approved |
| `ECONOMIC` | PR awarded, dues reminder, commitment breach, dues paid |
| `COMMUNITY` | New member joined group, group settings changed |
| `EMERGENCY` | Alert created, responder assigned, alert resolved |
| `SYSTEM` | Verification level changed, account actions |
| `PROPOSAL` | Alias for GOVERNANCE — maps via `toPrismaType()` |

---

## Endpoints

All endpoints require a valid Bearer token (auth required at router level).

### `GET /notifications`

List notifications for the authenticated user.

**Query params:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `unreadOnly` | boolean | false | Return only unread notifications |
| `limit` | number | 20 | Max results |
| `cursor` | string | — | Pagination cursor (notification ID) |

**Response `200`:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "type": "ECONOMIC",
      "title": "PR Awarded",
      "message": "You earned 10 PR for email verification",
      "read": false,
      "createdAt": "2026-05-09T12:00:00.000Z",
      "entityId": "uuid",
      "entityType": "USER"
    }
  ],
  "unreadCount": 3,
  "nextCursor": "uuid"
}
```

---

### `GET /notifications/unread-count`

Get unread notification count. Used by the topbar notification bell.

**Response `200`:** `{ "success": true, "count": 3 }`

---

### `POST /notifications/:id/read`

Mark a single notification as read.

**Response `200`:** `{ "success": true }`

---

### `POST /notifications/mark-all-read`

Mark all notifications as read for the authenticated user.

**Response `200`:** `{ "success": true, "markedCount": 5 }`

---

### `GET /notifications/preferences`

Get notification preferences.

**Response `200`:**
```json
{
  "success": true,
  "preferences": [
    { "type": "ECONOMIC", "enabled": true, "emailEnabled": false },
    { "type": "GOVERNANCE", "enabled": true, "emailEnabled": true }
  ]
}
```

---

### `PUT /notifications/preferences`

Update notification preferences for one type.

**Body:**
```json
{ "type": "ECONOMIC", "enabled": true, "emailEnabled": false }
```

**Response `200`:** `{ "success": true }`

---

## Background: Dues Reminder Job

A BullMQ job runs daily at **08:00** and sends dues reminder notifications on days 26, 27, and 28 of the month — with per-user deduplication (one reminder per user per day). Registered on the `economy` queue.

## Background: Governance Notifications

- `startVoting()` batch-notifies all group members when a proposal enters voting phase.
- `tallyVotes()` notifies the proposal creator of the tally result.

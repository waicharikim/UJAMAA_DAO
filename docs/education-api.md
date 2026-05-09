# Education API Documentation

> **Module status:** `tested` — 42 green tests (across 2 files).
> Base URL: `http://localhost:4000/api/v1/education`

---

## Overview

Self-paced learning modules covering platform concepts: what is PR, how verification works, how to participate in governance, community guidelines. Completing a module earns earned UT (cosmetic — no cash-out path, per ADR-004).

Three seed modules ship with the platform on first `make db-migrate` + seed.

---

## Endpoints

All endpoints require a valid Bearer token (EMAIL_VERIFIED minimum).

### `GET /education/modules`

List all education modules.

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `category` | string | Filter by category |
| `completed` | boolean | Show only completed (or incomplete) modules for this user |

**Response `200`:**
```json
{
  "success": true,
  "modules": [
    {
      "id": "uuid",
      "title": "What is Participation Rights (PR)?",
      "description": "Learn how PR tokens power governance and verify your contribution.",
      "category": "ECONOMY",
      "estimatedMinutes": 5,
      "completedAt": null,
      "reward": { "type": "UT", "amount": 5 }
    }
  ]
}
```

---

### `GET /education/modules/:moduleId`

Get a single module with full content (markdown).

**Response `200`:**
```json
{
  "success": true,
  "module": {
    "id": "uuid",
    "title": "...",
    "content": "## What is PR?\n\nParticipation Rights (PR) is...",
    "sections": [...],
    "completedAt": "2026-05-01T10:00:00.000Z"
  }
}
```

Content is rendered with `react-markdown` in the frontend. Full prose display in a drawer.

---

### `POST /education/modules/:moduleId/start`

Mark a module as started. Creates a `UserTutorial` record.

**Response `200`:** `{ "success": true }`

---

### `POST /education/modules/:moduleId/complete`

Mark a module as completed. Awards earned UT (once per module per user — idempotent).

**Body:** _(no body required)_

**Response `200`:**
```json
{
  "success": true,
  "reward": { "type": "UT", "amount": 5 },
  "alreadyCompleted": false
}
```

**Notes:**
- Anti-exploit: one reward per module per user, regardless of how many times `complete` is called.
- Requires `EMAIL_VERIFIED` — no COMMUNITY_VERIFIED gate on education.

---

### `GET /education/progress`

Get the authenticated user's module completion progress.

**Response `200`:**
```json
{
  "success": true,
  "completed": 2,
  "total": 3,
  "completions": [
    { "moduleId": "uuid", "key": "intro-pr", "completedAt": "2026-05-01T10:00:00.000Z" }
  ]
}
```

The `key` field allows the frontend `GettingStartedCard` to auto-detect completion by module key without needing the UUID.

---

## Frontend

The `/education` page has:
- Filter pills by category
- `ModuleCard` grid view
- `ModuleDrawer` — opens a slide-over panel with full markdown content
- Start / Complete / Review buttons
- `BookOpen` nav item in sidebar and mobile nav

`educationApi` namespace in `frontend/lib/api.ts`.

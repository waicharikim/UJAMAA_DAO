# Education API Documentation

> **Module status:** `tested` — 96 green tests (across 2 files).
> Base URL: `http://localhost:4000/api/v1/education`

---

## Overview

Self-paced learning modules covering platform concepts: what is PR, how verification works, how to participate in governance, community guidelines. Completing a module earns earned UT (cosmetic — no cash-out path, per ADR-004).

Three seed modules ship with the platform on first `make db-migrate` + seed.

### Who can contribute modules

Only `COMMUNITY_VERIFIED` users who meet all three criteria:
1. **`COMMUNITY_VERIFIED`** — enforced at the route level
2. **≥ 3 completed modules** — learner before teacher
3. **Minimum IP that scales with account age:**

| Account age | Min IP required |
|---|---|
| 0–30 days | 150 |
| 31–90 days | 200 |
| 91–180 days | 300 |
| 181–365 days | 400 |
| 365+ days | 500 |

Use `GET /education/authorship-eligibility` to check before showing the create form.

### Module status states

Derived from three fields on `EducationalModule` (no status enum):

| Derived state | Conditions |
|---|---|
| DRAFT | `verified: false`, `submittedAt: null` |
| SUBMITTED | `verified: false`, `submittedAt` set, `rejectionReason: null` |
| REJECTED | `verified: false`, `rejectionReason` set |
| APPROVED | `verified: true` |

---

## Learner endpoints

All learner endpoints require `EMAIL_VERIFIED` minimum unless noted.

### `GET /education`

List all verified (approved) modules.

**Auth:** `EMAIL_VERIFIED`

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `category` | string | Filter by category (e.g. `governance`) |
| `difficulty` | string | `BEGINNER` \| `INTERMEDIATE` \| `ADVANCED` \| `EXPERT` |

**Response `200`:**
```json
{
  "success": true,
  "modules": [
    {
      "id": "uuid",
      "title": "What is Participation Rights (PR)?",
      "description": "Learn how PR tokens power governance.",
      "category": "governance",
      "difficulty": "BEGINNER",
      "duration": 25,
      "completionIP": 10,
      "verified": true
    }
  ]
}
```

---

### `GET /education/:moduleId`

Get a single module with full content (markdown). Restricted to verified modules unless the caller is the module's creator.

**Auth:** `EMAIL_VERIFIED`

**Response `200`:**
```json
{
  "success": true,
  "module": {
    "id": "uuid",
    "title": "...",
    "content": "## What is PR?\n\nParticipation Rights (PR) is...",
    "difficulty": "BEGINNER",
    "duration": 25,
    "completionIP": 10,
    "status": "APPROVED"
  }
}
```

Content is rendered with `react-markdown` in the frontend. Full prose display in a drawer.

---

### `POST /education/:moduleId/start`

Mark a module as started.

**Auth:** `EMAIL_VERIFIED`

**Response `200`:** `{ "success": true }`

---

### `POST /education/:moduleId/complete`

Complete a module. IP/PR are awarded **at most once per module per user** (a
once-ever `rewardAwarded` flag, race-safe), and only when the comprehension quiz
(if the module has one) is passed.

**Auth:** `EMAIL_VERIFIED`

**Body:**
- Modules **with** a quiz: `{ "answers": [0, 1, 2] }` — one selected option index
  per question, in question order. The server grades against the stored answer
  key (the client never sends a score). Omitting/short answers → `400`.
- Modules **without** a quiz: no body required.

Fetch the questions to render via `GET /education/:moduleId` → `assessment`
(the correct-answer key is stripped server-side and never returned).

**Response `200` (quiz passed, or no-quiz module):**
```json
{
  "status": "COMPLETED",
  "score": 67,
  "ipAwarded": 25,
  "passed": true,
  "attemptsUsed": 1,
  "attemptsRemaining": 4,
  "passingScore": 60
}
```

**Response `200` (quiz failed — no award, stays `IN_PROGRESS`):**
```json
{
  "status": "IN_PROGRESS",
  "score": 33,
  "passed": false,
  "attemptsUsed": 1,
  "attemptsRemaining": 4,
  "passingScore": 60
}
```

**Errors:** `400` (module not started / missing answers), `403` (no quiz
attempts remaining — `maxAttempts` reached), `404` (module not found).

---

### `POST /education/:moduleId/review`

Submit a rating and review for a completed module.

**Auth:** `COMMUNITY_VERIFIED`

---

### `GET /education/my-progress`

Get the authenticated user's module progress (in-progress and completed).

**Auth:** `EMAIL_VERIFIED`

**Response `200`:**
```json
{
  "success": true,
  "inProgress": [
    { "moduleId": "uuid", "title": "...", "progress": 40 }
  ],
  "completed": [
    { "moduleId": "uuid", "title": "...", "completedAt": "2026-05-01T10:00:00.000Z" }
  ]
}
```

Only modules with `verified: true` appear here (unverified modules are excluded from learner progress).

---

## Authorship endpoints

All authorship endpoints require `COMMUNITY_VERIFIED` and must pass the tiered IP gate (see Overview).

### `GET /education/authorship-eligibility`

Check whether the current user meets all authorship criteria.

**Auth:** `COMMUNITY_VERIFIED`

**Response `200`:**
```json
{
  "success": true,
  "eligible": false,
  "completedModules": 1,
  "requiredModules": 3,
  "currentIP": 120,
  "requiredIP": 200,
  "daysOnPlatform": 45
}
```

Use this on the `/education/create` page before rendering the form. Show a checklist with ✓/✗ rows when `eligible: false`.

---

### `GET /education/my-modules`

List all modules created by the authenticated user, including DRAFT, SUBMITTED, REJECTED, and APPROVED states.

**Auth:** `COMMUNITY_VERIFIED` + authorship eligibility

**Response `200`:**
```json
{
  "success": true,
  "modules": [
    {
      "id": "uuid",
      "title": "Ward Budget Fundamentals",
      "status": "SUBMITTED",
      "submittedAt": "2026-05-20T10:00:00.000Z",
      "rejectionReason": null,
      "verified": false,
      "createdAt": "2026-05-18T08:00:00.000Z"
    }
  ]
}
```

---

### `POST /education`

Create a new module (DRAFT state).

**Auth:** `COMMUNITY_VERIFIED` + authorship eligibility (403 if not eligible)

**Body:**
```json
{
  "title": "Ward Budget Fundamentals",
  "description": "Learn how ward development funds are allocated and tracked by county governments.",
  "content": "Ward development funds are allocated annually... (≥100 chars required)",
  "duration": 25,
  "difficulty": "BEGINNER",
  "category": "governance",
  "completionIP": 15
}
```

Validators: `title` ≥5 chars, `description` ≥20 chars, `content` ≥100 chars.

**Response `200`:**
```json
{
  "success": true,
  "module": {
    "id": "uuid",
    "title": "Ward Budget Fundamentals",
    "verified": false,
    "submittedAt": null,
    "status": "DRAFT"
  }
}
```

---

### `PATCH /education/:moduleId`

Update a DRAFT module. Cannot edit SUBMITTED, APPROVED, or REJECTED modules.

**Auth:** `COMMUNITY_VERIFIED` + authorship eligibility + must be the creator

**Body:** Any subset of create fields (title, description, content, duration, difficulty, category, completionIP).

**Errors:**
- `403` — not the creator, or not eligible
- `400` — module is already submitted or approved

---

### `POST /education/:moduleId/submit`

Submit a DRAFT (or REJECTED) module for admin review. Sets `submittedAt`. Cannot submit an already-submitted or approved module.

**Auth:** `COMMUNITY_VERIFIED` + must be the creator

**Response `200`:** `{ "success": true, "module": { ..., "status": "SUBMITTED" } }`

**Notes:**
- A REJECTED module can be re-submitted after addressing feedback.
- Once submitted, the module is locked from editing (`PATCH` returns `400`).

---

### `DELETE /education/:moduleId`

Delete a DRAFT or SUBMITTED module. Cannot delete an APPROVED module.

**Auth:** `COMMUNITY_VERIFIED` + must be the creator

**Errors:**
- `403` — not the creator
- `400` — module is approved (locked)

---

## Frontend

The `/education` page has:
- Filter pills by category and difficulty
- `ModuleCard` grid view
- `ModuleDrawer` — opens a slide-over panel with full markdown content
- Start / Complete / Review buttons
- Contribute button (dimmed with tooltip if eligibility criteria not met)

The `/education/create` page shows an eligibility checklist (verified / modules / IP rows with ✓/✗) if `eligible: false`, or the creation form if eligible.

`educationApi` namespace in `frontend/lib/api.ts`.

# Onboarding API Documentation

> **Module status:** `tested` — 22 green tests (11 service unit + 11 route integration).
> Base URL: `http://localhost:4000/api/v1/onboarding`

---

## Overview

Onboarding tracks a new user's progress through key platform milestones. Some steps auto-complete when the user takes an action elsewhere (e.g., casting a vote). Others are manually marked via this API.

The frontend `GettingStartedCard` drives the onboarding flow — it auto-detects completions via the `AUTO_CONDITIONS` map using tutorial `key` fields rather than UUIDs.

---

## Endpoints

All endpoints require a valid Bearer token (EMAIL_VERIFIED minimum).

### `GET /onboarding/progress`

Get the authenticated user's onboarding progress.

**Response `200`:**
```json
{
  "success": true,
  "progress": {
    "completedSteps": 3,
    "totalSteps": 8,
    "percentComplete": 37.5,
    "steps": [
      {
        "key": "verify_email",
        "label": "Verify your email",
        "completed": true,
        "completedAt": "2026-05-01T10:00:00.000Z"
      },
      {
        "key": "join_ward_group",
        "label": "Join your ward group",
        "completed": true,
        "completedAt": "2026-05-01T10:01:00.000Z"
      },
      {
        "key": "cast_first_vote",
        "label": "Cast your first vote",
        "completed": false,
        "completedAt": null
      }
    ]
  }
}
```

The `key` field is used by the frontend `GettingStartedCard` to match completions — avoids UUID dependency.

---

### `POST /onboarding/tutorial/complete`

Manually mark a tutorial step as complete. Used for steps that don't auto-complete.

**Body:**
```json
{ "key": "explore_marketplace" }
```

**Response `200`:** `{ "success": true, "step": { "key": "...", "completedAt": "..." } }`

---

### `POST /onboarding/flags/update`

Update onboarding flags from other modules (called internally by community, governance listeners).

**Body:**
```json
{ "flag": "joinedWardGroup" }
```

**Flags:** `joinedWardGroup` · `joinedVoluntaryGroup` · `castFirstVote`

---

## Auto-Completion

Certain steps complete automatically when a user takes an action:

| Key | Triggers when |
|---|---|
| `verify_email` | Email verified (auth flow) |
| `join_ward_group` | Enrolled in system ward group |
| `join_voluntary_group` | Joined a voluntary group |
| `cast_first_vote` | Votes on a governance proposal |
| `complete_profile` | Updates profile with name + industry |

Steps fire via the `onboardingFlags` listener in `community.routes` and the `governance` vote handler.

---

## `needsProfileCompletion` flag

After email verification, the API returns `needsProfileCompletion: true` if the user hasn't filled in their profile. The frontend auth callback uses this to redirect new users to `/profile` before showing the dashboard.

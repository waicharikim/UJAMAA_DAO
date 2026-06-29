# UjamaaDAO Project Module Documentation

> **Module status:** `tested` — project routes at `/api/v1/projects` (106 tests across 4 files).
> Full lifecycle: create from proposal → milestones → work logging → contributions → QR witness-chain presence verification.

## Overview

The Project module manages the full lifecycle of projects created from approved governance proposals. Members join projects, contribute funds (UT), log physical work, and verify attendance via a QR witness-chain system. Milestones track phased progress.

### Core Features

- Create projects from approved proposals
- List and retrieve project details (paginated, filterable)
- Start, submit, and verify milestones
- Log and verify physical work
- Join projects and contribute UT funds
- Claim and complete tasks (with IP reward)
- QR-based physical presence sessions with a witness-chain attestation model

### Business Rules

- Projects are only created from proposals in `APPROVED` status
- Milestone start/verify requires project leader or verifier role
- Work logging requires `COMMUNITY_VERIFIED`
- **Participation (join/claim/complete/contribute) requires `COMMUNITY_VERIFIED` _and_ membership of the project's owning group.** The owning group already encodes the audience: a ward/constituency/county system-group project includes every resident of that tier (auto-enrolled), so cross-ward collaboration falls out of the same rule; a voluntary-group project includes only its members.
- **Participation scope** (`participationScope`, default `MEMBERS_ONLY`): a voluntary group may widen a project to its surrounding geography — `WARD` / `CONSTITUENCY` / `COUNTY` — letting non-members resident in that tier participate. System-group projects keep `MEMBERS_ONLY` (their membership already spans the tier).
- **Self-verification is blocked:** the member who submitted a milestone (or logged the hours) cannot verify it; a different leader or a holder of the `VERIFIER` role must.
- `listProjects` (no explicit owner filter) is scoped to the viewer — projects of their groups (incl. ward/constituency/county system groups) + geographically-open projects in their area + their own. `getProject` detail stays readable for transparency; only actions are gated.
- Contributions debit `fiatBackedUtBalance` from the member and credit the project's `GroupTreasury` (1 UT = 1 KES)
- Task completion awards 10 Impact Points to the completer
- QR work sessions: each checked-in member may attest up to 2 others (witness chain); attested members get `depth = attestor.depth + 1`
- Sessions auto-close via BullMQ delayed job; auto-approved (10 IP to all) only if ≥1 direct scan (depth=0) exists; otherwise flagged for leader review
- Session creation schedules a BullMQ `WORK_SESSION_CLOSE` job with `jobId: ws-close-{sessionId}` for deduplication

---

## API Reference

### Base URL

`/api/v1/projects`

All routes require authentication (`Authorization: Bearer <sessionToken>`).

---

### GET `/`

List projects with optional filters.

- **Auth required:** Yes
- **Query Parameters:**
  - `ownerGroupId` (optional): Filter by owning group UUID
  - `ownerUserId` (optional): Filter by owning user UUID
  - `status` (optional): `PLANNING | ACTIVE | ON_HOLD | CANCELLED | COMPLETED`
  - `limit` (optional, default 20, max 100)
  - `offset` (optional, default 0)
- **Scoping:** When no explicit `ownerGroupId`/`ownerUserId` filter is given, results are scoped to the viewer (their groups + geographically-open projects in their area + their own). An explicit `ownerGroupId` filter (e.g. a group's own project page) returns that group's projects unscoped.
- Each project object includes `participationScope` (`MEMBERS_ONLY | WARD | CONSTITUENCY | COUNTY`).
- **Responses:**
  - `200 OK` — Paginated array of project objects
  - `401 Unauthorized`

---

### GET `/:projectId`

Get a project by ID, including milestones and participants.

- **Auth required:** Yes
- **Path Parameters:** `projectId` (UUID)
- **Responses:**
  - `200 OK` — Full project object with milestones
  - `401 Unauthorized`
  - `404 Not Found`

---

### POST `/from-proposal`

Create a new project from an approved proposal. This is the project-setup gate: a
`PROJECT` proposal cannot reach `EXECUTING` until its project exists. Besides the
optional milestone editor, it captures the **project-setup details** — the Baraza
council's most frequent HIGH-severity gaps, asked here (after the vote) rather than
at idea stage to keep proposal creation low-friction.

- **Auth required:** Yes
- **Request Body:**

```json
{
  "proposalId": "UUID",
  "milestones": [ /* optional full milestone editor payload */ ],
  "maintenancePlan": "Who keeps it running in year two (string)",
  "recurrentCostKes": 5000,
  "recurrentCostPeriod": "MONTHLY | QUARTERLY | YEARLY",
  "siteLocation": "Where exactly it sits (string)",
  "landTenure": "Whose land / who has consented (string)",
  "beneficiaries": "Who benefits, who contributes, who is exempt (string)"
}
```

All project-setup detail fields are optional (max 2000 chars each; `recurrentCostKes` ≥ 0).
They are stored on the `Project` (columns added by migration `20260629000000_add_project_setup_details`).

- **Responses:**
  - `200 OK` — Created project object (incl. the project-setup detail fields)
  - `400 Bad Request` — Proposal not in APPROVED status, or invalid `recurrentCostPeriod`
  - `404 Not Found` — Proposal not found

---

### POST `/milestone/start`

Start a milestone. Requires project leader role.

- **Auth required:** Yes (project leader)
- **Request Body:**

```json
{
  "milestoneId": "UUID"
}
```

- **Responses:**
  - `200 OK` — Updated milestone object
  - `403 Forbidden` — Not project leader
  - `404 Not Found`

---

### POST `/milestone/submit`

Submit a milestone with proof.

- **Auth required:** Yes
- **Request Body:**

```json
{
  "milestoneId": "UUID",
  "proofUrl": "https://...",
  "description": "string"
}
```

- **Responses:**
  - `200 OK` — Updated milestone object
  - `400 Bad Request` — Validation error

---

### POST `/milestone/verify`

Approve or reject a milestone submission. Requires project leader or verifier role.

- **Auth required:** Yes (project leader or verifier)
- **Request Body:**

```json
{
  "milestoneId": "UUID",
  "approved": true,
  "feedback": "string (optional)"
}
```

- **Responses:**
  - `200 OK` — Updated milestone
  - `403 Forbidden` — Not leader or verifier, **or the verifier is the submitter (no self-verification)**

---

### POST `/work-log`

Log physical work on a milestone. Requires `COMMUNITY_VERIFIED`.

- **Auth required:** Yes (`COMMUNITY_VERIFIED`)
- **Request Body:**

```json
{
  "milestoneId": "UUID",
  "workType": "MANUAL_LABOR | SKILLED_WORK | SUPERVISION",
  "description": "string (10–1000 chars)",
  "hours": 2.5,
  "photoUrls": ["https://..."],
  "witnessIds": ["UUID"]
}
```

- **Responses:**
  - `201 Created` — Work log record
  - `400 Bad Request` — Validation error
  - `403 Forbidden` — Not community verified

---

### POST `/work-log/verify`

Approve or reject a work log. Requires project leader or verifier role.

- **Auth required:** Yes (project leader or verifier)
- **Request Body:**

```json
{
  "workLogId": "UUID",
  "approved": true,
  "feedback": "string (optional, max 500 chars)"
}
```

- **Responses:**
  - `200 OK` — Updated work log
  - `403 Forbidden` — Not leader or verifier, **or the verifier logged the work (no self-verification)**
  - `404 Not Found`

---

### GET `/milestone/:milestoneId/work-logs`

List all work logs for a milestone.

- **Auth required:** Yes
- **Path Parameters:** `milestoneId` (UUID)
- **Responses:**
  - `200 OK` — Array of work log objects
  - `404 Not Found`

---

### POST `/tasks/:taskId/claim`

Claim an open task. Requires membership of the project (join first).

- **Auth required:** Yes (`COMMUNITY_VERIFIED` + project member)
- **Path Parameters:** `taskId` (cuid string)
- **Responses:**
  - `200 OK` — Updated task object
  - `403 Forbidden` — Not a project member
  - `409 Conflict` — Task already claimed

---

### PATCH `/tasks/:taskId/done`

Mark a claimed task as complete. Awards 10 Impact Points to the completer.

- **Auth required:** Yes
- **Path Parameters:** `taskId` (cuid string)
- **Responses:**
  - `200 OK` — Updated task + awarded IP
  - `403 Forbidden` — Task not claimed by this user, or no longer a project member

---

## QR Work Sessions

A QR work session captures physical presence at a project site using a witness-chain model. The session creator generates a QR code. Anyone who scans it is recorded at depth 0 (direct scan). Each checked-in member can then attest up to 2 other people present (e.g. those without smartphones), who are recorded at depth+1.

Auto-close fires at session expiry via BullMQ:
- **≥1 direct scan (depth=0)** → status `APPROVED`, all present members receive 10 IP
- **0 direct scans** → status `FLAGGED` for leader manual review

### POST `/work-sessions`

Create a QR work session for a milestone. Requires `COMMUNITY_VERIFIED`.

- **Auth required:** Yes (`COMMUNITY_VERIFIED`)
- **Request Body:**

```json
{
  "milestoneId": "UUID",
  "durationMinutes": 120
}
```

- **Constraints:** `durationMinutes` 30–480
- **Responses:**
  - `201 Created`

```json
{
  "sessionId": "UUID",
  "qrSecret": "48-char hex string",
  "expiresAt": "ISO8601 timestamp",
  "status": "OPEN"
}
```

- `403 Forbidden` — Not community verified
- `404 Not Found` — Milestone not found

---

### POST `/work-sessions/scan`

Check in to an open session by scanning the QR code. Records the user at depth 0.

- **Auth required:** Yes
- **Request Body:**

```json
{
  "qrSecret": "48-char hex string"
}
```

- **Responses:**
  - `200 OK` — `{ sessionId, depth: 0, checkedIn: true }`
  - `404 Not Found` — Invalid or expired QR
  - `409 Conflict` — Already checked in

---

### POST `/work-sessions/:sessionId/attest`

Attest another user's physical presence. The attestor must be checked in and may attest at most 2 people. The target is recorded at `attestor.depth + 1`.

- **Auth required:** Yes
- **Path Parameters:** `sessionId` (UUID)
- **Request Body:**

```json
{
  "targetUserId": "UUID"
}
```

- **Responses:**
  - `201 Created` — `{ sessionId, targetUserId, depth }`
  - `400 Bad Request` — Attestation limit reached (max 2), self-attest, or session not OPEN
  - `403 Forbidden` — Attestor not checked in to this session
  - `409 Conflict` — Target already checked in

---

### POST `/work-sessions/:sessionId/close`

Manually close a session before expiry. Requires project leader role. Triggers the same APPROVED/FLAGGED logic as the auto-close job.

- **Auth required:** Yes (project leader)
- **Path Parameters:** `sessionId` (UUID)
- **Responses:**
  - `200 OK` — `{ sessionId, status: "APPROVED" | "FLAGGED", presenceCount }`
  - `403 Forbidden` — Not project leader
  - `404 Not Found`

---

### GET `/work-sessions/:sessionId`

Get a work session with all presence records.

- **Auth required:** Yes
- **Path Parameters:** `sessionId` (UUID)
- **Responses:**

```json
{
  "sessionId": "UUID",
  "milestoneId": "UUID",
  "projectId": "UUID",
  "status": "OPEN | APPROVED | FLAGGED",
  "expiresAt": "ISO8601",
  "presences": [
    {
      "userId": "UUID",
      "userName": "string",
      "depth": 0,
      "attestedById": null,
      "ipAwarded": false
    }
  ]
}
```

- `404 Not Found`

---

## Project Membership & Contributions

### POST `/:projectId/join`

Join a project as a participant. Requires `COMMUNITY_VERIFIED` **and** eligibility for the project: either a member of the owning group, or — when the project's `participationScope` is `WARD`/`CONSTITUENCY`/`COUNTY` — resident within the owning group's geography at that tier.

- **Auth required:** Yes (`COMMUNITY_VERIFIED`)
- **Path Parameters:** `projectId` (UUID)
- **Responses:**
  - `201 Created` — Project membership record
  - `400 Bad Request` — Project is completed/cancelled
  - `403 Forbidden` — Not community verified, or not eligible for this project's group/scope
  - `409 Conflict` — Already a member

---

### PATCH `/:projectId/participation`

Set who may participate in the project. **Leader-only** (project owner). Only meaningful for voluntary-group projects — system-group projects already span their tier, so widening them is rejected.

- **Auth required:** Yes (project leader / owner)
- **Path Parameters:** `projectId` (UUID)
- **Request Body:**

```json
{
  "scope": "MEMBERS_ONLY | WARD | CONSTITUENCY | COUNTY"
}
```

- **Responses:**
  - `200 OK` — `{ projectId, participationScope }`
  - `400 Bad Request` — Project closed, or attempting to widen a system-group project
  - `403 Forbidden` — Not the project leader

---

### POST `/:projectId/contribute`

Contribute UT funds to a project. Debits `fiatBackedUtBalance` from the caller and credits the project's `GroupTreasury`. 1 UT = 1 KES.

- **Auth required:** Yes (`COMMUNITY_VERIFIED`)
- **Path Parameters:** `projectId` (UUID)
- **Request Body:**

```json
{
  "amount": 500
}
```

- **Constraints:** `amount` 1–100,000 (integer)
- **Responses:**
  - `201 Created` — Contribution record with new balance
  - `400 Bad Request` — Insufficient `fiatBackedUtBalance`
  - `403 Forbidden` — Not community verified
  - `404 Not Found` — Project not found

---

## Error Reference

| Code | Error | Description |
|---|---|---|
| 400 | ValidationError | Input fields failed schema validation |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient verification level or missing role |
| 404 | Not Found | Requested resource does not exist |
| 409 | Conflict | Duplicate record (already joined, already checked in, etc.) |
| 500 | Internal Server Error | Unexpected server error |

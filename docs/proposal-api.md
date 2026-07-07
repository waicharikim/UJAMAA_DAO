# Governance / Proposals API Documentation

> **Module status:** `tested` — 175 green tests across 6 files (148 proposal lifecycle + 27 annotation tests).
> Base URL: `http://localhost:4000/api/v1/governance`

---

## Overview

The Governance module handles the full proposal lifecycle: draft → review → voting → tally, with a memory layer for rationale documentation and real-world outcome recording.

Voting power is **PR-weighted** — a snapshot of each member's PR balance is taken when voting opens. Balance changes after the snapshot do not affect vote weight.

All endpoints require authentication.

---

## Proposal Lifecycle

```
DRAFT
  │
  ▼ (LEADER forwards)
PENDING_REVIEW          ← location admin must approve
  │
  ▼ (location admin approves)
APPROVED_FOR_VOTING     ← LEADER can now open voting
  │
  ▼ (LEADER opens voting)
VOTING
  │
  ▼ (tally called / voting period ends)
APPROVED | REJECTED
  │           │
  │           ▼ (creator resubmits — up to 3 times)
  │         DRAFT  ← resubmissionCount incremented; reviewNote kept so creator sees why it was rejected
  ▼
 (by kind)
  ├─ PROJECT: set up project (milestones) → EXECUTING → COMPLETED
  └─ POLICY:  COMPLETED  (decision recorded — outcome note required, no project, no budget)
```

**Proposal kind (`POLICY` vs `PROJECT`)** — chosen at creation (default `PROJECT`):
- **POLICY** — a community decision / rule change. Carries no budget (funding fields are stripped on create). On approval it goes straight `APPROVED → COMPLETED` via `PATCH /:proposalId/progress` with a **required outcome note** (ward memory). It can never be EXECUTED and never creates a project.
- **PROJECT** — builds or funds something. After approval the creator must run the **project-setup gate** (`POST /projects/from-proposal` with milestones) before the proposal can move `APPROVED → EXECUTING`. Treasury disbursement happens **once**, on the EXECUTING transition (the setup step itself does not debit).

**Shortcut for voluntary GROUP-scope proposals:** DRAFT → APPROVED_FOR_VOTING directly (no location admin review step).

**Target area (COMMUNITY scope):** a public proposal is resolved at creation to a concrete target geography (`targetWardId` / `targetConstituencyId` / `targetCountyId`) from the group's affiliation and the chosen `targetLevel`. Only residents of that area may vote. A genuinely national proposal (system group, no location) has no target and is open to all; a voluntary group with no location affiliation cannot create a public proposal.

**Rejection and resubmission:**
- A `REJECT` decision requires a `note` (minimum 10 characters).
- When `tallyVotes()` produces a REJECTED outcome, a rejection reason is auto-generated: quorum failure or approval-majority failure.
- The creator may call `POST /:proposalId/resubmit` to reset REJECTED → DRAFT and revise the proposal. Maximum 3 resubmissions (`resubmissionCount` field). The `reviewNote` is preserved in DRAFT so the creator can see why it was rejected.

**Tally authorisation:**
- When called by a user, `POST /:proposalId/tally` requires the caller to be the group LEADER or a location admin (same auth as `start-voting`).
- The daily cron job (`TALLY_PROPOSALS_JOB`) calls tally without a caller — this path bypasses the auth check.

---

## Proposal Memory Layer

Every proposal can carry structured documentation:

| Field | When editable | Who can edit |
|---|---|---|
| `rationale` | DRAFT or PENDING_REVIEW only | Creator |
| `alternatives` | DRAFT or PENDING_REVIEW only | Creator |
| `outcome` | After APPROVED status | Creator or group leader |
| `outcomeRecordedAt` | Set automatically when outcome is recorded | — |

---

## Endpoints

### `GET /governance`
List proposals. Returns summary view with vote counts and funding amounts.
**Auth:** required

**Query params:** `groupId` · `status` · `scope` (GROUP/COMMUNITY) · `page` · `limit`

**Response `200`:** paginated array of proposal summaries.

---

### `GET /governance/needs-action`
Proposals that require action from the caller (pending review, pending vote, etc.).
**Auth:** required

**Response `200`:** array of proposals needing the caller's attention.

---

### `GET /governance/:proposalId`
Get full detail for a single proposal including votes and co-funding fields.
**Auth:** required

**Response `200`:**
```json
{
  "id": "...",
  "groupId": "...",
  "title": "...",
  "description": "...",
  "status": "VOTING",
  "proposalType": "COMMUNITY_INITIATIVE",
  "scope": "GROUP",
  "fundingAmountKes": 200000,
  "groupFundingAmount": 50000,
  "locationFundingRequest": 150000,
  "rationale": "...",
  "alternatives": "...",
  "outcome": null,
  "outcomeRecordedAt": null,
  "createdAt": "...",
  "votingStartsAt": "...",
  "votingEndsAt": "...",
  "votes": [
    { "userId": "...", "option": "YES", "prWeight": 150 }
  ]
}
```

**Responses:** `200 OK` · `404 Not Found`

---

### `POST /governance/create`
Create a new proposal. Initial status is `DRAFT`.
**Auth:** required

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `groupId` | string (UUID) | Yes | Group this proposal belongs to |
| `title` | string (min 10) | Yes | |
| `description` | string (min 50) | Yes | Client folds problem/solution/etc. into this blob for display + the Baraza content hash |
| `problem` | string (max 1500) | No | Structured — the problem being addressed. Read directly by the Baraza council (no longer parsed out of `description`). |
| `solution` | string (max 1500) | No | Structured — the proposed solution. Read directly by the Baraza council. |
| `fundingSource` | `GROUP_TREASURY` \| `MEMBER_CONTRIBUTIONS` \| `EXTERNAL_GRANT` \| `LOCATION_REQUEST` | No | Primary funding source (one-tap pick-list on the create form). The council's most-requested field. |
| `kind` | `POLICY` \| `PROJECT` | No | Default `PROJECT`. `POLICY` strips all funding fields and never creates a project. |
| `isEmergency` | boolean | No | Sets `proposalType` to `EMERGENCY` |
| `proposalScope` | `GROUP` \| `COMMUNITY` | No | Default `GROUP` (when `groupId` present) |
| `targetLevel` | `WARD` \| `CONSTITUENCY` \| `COUNTY` | No | For COMMUNITY scope: which level of the group's geography to target (defaults to the group's anchor level). Resolved to concrete target IDs server-side. |
| `fundingAmountKes` | number | No | Ignored for `POLICY` |
| `groupFundingAmount` | number | No | Group's share of co-funded proposal (ignored for `POLICY`) |
| `locationFundingRequest` | number | No | Amount requested from location treasury (ignored for `POLICY`) |
| `rationale` | string | No | Why this proposal is needed |
| `alternatives` | string | No | Alternatives considered |

**Responses:**
- `201 Created` — proposal object in `DRAFT` status. PR cost deducted.
- `400 Bad Request` — validation failure.
- `403 Forbidden` — insufficient PR or IP percentile too low for scope.
- `404 Not Found` — group not found.

---

### `POST /governance/:proposalId/review`
Approve or reject a proposal awaiting location admin review.
**Auth:** required · **Role:** location admin for the group's ward/constituency/county

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `decision` | string | Yes | `APPROVE` \| `REJECT` |
| `note` | string (max 500) | **Required when `decision=REJECT`** (min 10 chars) | Reason for rejection shown to the creator |

**Responses:**
- `200 OK` — status updated to `APPROVED_FOR_VOTING` or `REJECTED`.
- `400 Bad Request` — proposal not in `PENDING_REVIEW`, or `decision=REJECT` without a note.
- `403 Forbidden` — caller is not the required location admin.
- `404 Not Found` — proposal not found.

---

### `POST /governance/:proposalId/start-voting`
Open the voting period. Takes a PR snapshot of all eligible group members.
**Auth:** required · **Role:** group LEADER

**Responses:**
- `200 OK` — proposal updated to `VOTING`, snapshot recorded, members notified.
- `400 Bad Request` — proposal not in `APPROVED_FOR_VOTING`.
- `403 Forbidden` — caller is not the group leader.
- `404 Not Found` — proposal not found.

---

### `POST /governance/:proposalId/vote`
Cast a vote on an active (`VOTING`) proposal.
**Auth:** required

**Body:**
| Field | Type | Values |
|---|---|---|
| `option` | string | `YES` \| `NO` \| `ABSTAIN` |

**Responses:**
- `200 OK` — vote recorded with PR weight. +5 PR awarded.
- `400 Bad Request` — proposal not in `VOTING` status, or already voted.
- `404 Not Found` — proposal not found.

---

### `POST /governance/:proposalId/tally`
Close voting and tally results. Sets proposal to `APPROVED` or `REJECTED`. Creator and group members are notified. A rejection reason (`reviewNote`) is auto-generated on REJECTED outcomes.
**Auth:** required · **Role:** group LEADER or location admin (same as `start-voting`). The daily cron job calls this without authentication.

**Response `200`:**
```json
{
  "result": "APPROVED",
  "yesWeight": 1200,
  "noWeight": 400,
  "abstainWeight": 100,
  "totalVoters": 23,
  "quorumMet": true
}
```

**Responses:** `200 OK` · `400 Bad Request` (not in VOTING) · `403 Forbidden` (user call without leader/admin role) · `404 Not Found`

---

### `POST /governance/:proposalId/resubmit`
Reset a `REJECTED` proposal back to `DRAFT` for revision and resubmission.
**Auth:** required · **Only:** proposal creator

Preserves the rejection `reviewNote` in DRAFT so the creator can see why it was rejected. Resets vote counts, voting window, and review assignment. Maximum 3 resubmissions per proposal (`resubmissionCount` field).

**Responses:**
- `200 OK` — proposal reset to `DRAFT`, `resubmissionCount` incremented.
- `400 Bad Request` — proposal not in `REJECTED` status, or `resubmissionCount` has reached 3.
- `403 Forbidden` — caller is not the proposal creator.
- `404 Not Found` — proposal not found.

---

### `PATCH /governance/:proposalId/memory`
Update rationale and/or alternatives documentation. Only editable before voting begins.
**Auth:** required · **Only:** proposal creator

**Body:**
| Field | Type | Required |
|---|---|---|
| `rationale` | string (min 10, max 2000) | No |
| `alternatives` | string (min 10, max 2000) | No |

**Responses:**
- `200 OK` — updated `{ id, rationale, alternatives }`.
- `400 Bad Request` — proposal is past `PENDING_REVIEW` stage (voting has opened or proposal was rejected).
- `403 Forbidden` — caller is not the proposal creator.
- `404 Not Found` — proposal not found.

---

### `PATCH /governance/:proposalId/outcome`
Record the real-world outcome of a passed proposal. Used for community accountability — what actually happened after the proposal was approved and executed.
**Auth:** required · **Only:** proposal creator or group leader

**Body:**
| Field | Type | Required |
|---|---|---|
| `outcome` | string (min 10, max 2000) | Yes |

**Responses:**
- `200 OK` — updated `{ id, outcome, outcomeRecordedAt, memoryAnchorTxHash }`.
- `400 Bad Request` — proposal has not reached `APPROVED`, `EXECUTING`, or `COMPLETED` status.
- `403 Forbidden` — caller is neither the creator nor the group leader.
- `404 Not Found` — proposal not found.

**On-chain anchoring (ADR-052):** when an outcome is recorded, the complete ward-memory record (`rationale + alternatives + outcome + outcomeRecordedAt + recorderUserId`) is keccak256-hashed and anchored on-chain via `GovernanceVoting.recordMemory()`. The full text stays in PostgreSQL; only the hash goes on-chain. Unlike annotation anchoring, **no recorder wallet is required** — ward memory is the ward's institutional record, signed by the platform `RECORDER_ROLE` wallet. The tx hash is returned in `memoryAnchorTxHash` (and rendered as a Basescan link on the proposal detail outcome card). Anchoring is fail-open and **dormant until the Base Sepolia deploy** sets `GOVERNANCE_VOTING_ADDRESS` — until then `memoryAnchorTxHash` is `null` and the off-chain record is authoritative. Re-recording an outcome overwrites the on-chain mapping and emits a fresh `MemoryAnchored` event (no dedup — the event log is the revision history).

---

## Annotations (Inline Public Participation)

> **Annotation window:** PENDING_REVIEW and APPROVED_FOR_VOTING only — pre-vote deliberation phase.
> **Auth required for writes:** `COMMUNITY_VERIFIED` verification level.

Community members can highlight any passage in a proposal's `description`, `rationale`, or `alternatives` and attach a comment. Each annotator is assigned a consistent colour (7-colour deterministic palette ordered by first annotation per user per proposal). A keccak256 hash of every annotation is anchored on-chain via `GovernanceVoting.recordOpinion()` — providing a tamper-evident timestamp without storing full text on-chain. Annotations and reactions feed into the Baraza AI `search_past_decisions` tool.

### Deliberation layer (ADR-053)

Two surfaces connect these opinions to the vote:
- **Most-reacted opinions (deterministic):** annotations ranked by net score (`upvotes − downvotes`), surfaced next to the rationale. Works with no AI configured.
- **Deliberation digest (AI):** when voting opens (APPROVED_FOR_VOTING → VOTING), a BullMQ job (`generate-deliberation-summary`) calls the AI model (**Qwen via DashScope** — `core/ai/qwen.ts`) with a strict **neutral-clerk** prompt and stores `Proposal.deliberationSummary` = `{ support: string[], concerns: string[], openQuestions: string[] }` (or `{ note }` on parse fallback) + `deliberationSummaryAt`. It rides in the `GET /governance/:proposalId` response — no separate endpoint. The digest **never recommends how to vote** (the binding step is the human vote); it only summarises what annotators wrote. Dormant (`null`) until `DASHSCOPE_API_KEY` is set. The summary is folded into the on-chain ward-memory hash when an outcome is recorded (see ADR-052/ADR-053).

> **Not to be confused with the Baraza deliberation engine** — a separate 7-agent council that stress-tests the proposal *before* the vote (Qwen-powered; `docs/baraza-deliberation.md`). This digest summarises *human* annotations; Baraza is AI agents debating on their own.

### `POST /governance/:proposalId/annotations`
Create an annotation on a highlighted passage. Returns **201**.
**Auth:** required · **Verification:** `COMMUNITY_VERIFIED`

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `fieldKey` | `"description"` \| `"rationale"` \| `"alternatives"` | Yes | Which field the highlight is in |
| `startOffset` | integer ≥ 0 | Yes | Character offset of highlight start |
| `endOffset` | integer ≥ 1 | Yes | Character offset of highlight end — must exceed `startOffset` |
| `quotedText` | string (max 500) | Yes | The highlighted text (stored as snapshot) |
| `comment` | string (max 2000) | Yes | The annotator's opinion |

**Response `201`:**
```json
{
  "id": "uuid",
  "proposalId": "uuid",
  "authorId": "uuid",
  "fieldKey": "description",
  "startOffset": 2,
  "endOffset": 40,
  "quotedText": "the highlighted passage",
  "comment": "This needs more detail on funding sources.",
  "color": "#C9922A",
  "createdAt": "ISO8601",
  "upvotes": 0,
  "downvotes": 0,
  "myReaction": null,
  "author": { "id": "uuid", "name": "Jane Wanjiku" }
}
```

**Responses:** `201 Created` · `400 Bad Request` (endOffset ≤ startOffset, invalid fieldKey) · `403 Forbidden` (below COMMUNITY_VERIFIED, or proposal outside annotation window) · `404 Not Found`

---

### `GET /governance/:proposalId/annotations`
List all annotations for a proposal, sorted by `createdAt` ascending. `myReaction` is computed for the authenticated caller.
**Auth:** required

**Response `200`:** array of annotation objects (same shape as POST 201 response above).

**Responses:** `200 OK` · `404 Not Found`

---

### `DELETE /governance/:proposalId/annotations/:annotationId`
Delete an annotation. Only the annotation author may delete their own annotations.
**Auth:** required

**Response `200`:**
```json
{ "id": "uuid", "deleted": true }
```

**Responses:** `200 OK` · `403 Forbidden` (not the author) · `404 Not Found`

---

### `POST /governance/:proposalId/annotations/:annotationId/react`
Add, switch, or remove a reaction on an annotation. Upserts — one call switches UP↔DOWN. Send `type: null` to remove any existing reaction.
**Auth:** required · **Verification:** `COMMUNITY_VERIFIED`

**Body:**
| Field | Type | Values |
|---|---|---|
| `type` | string or null | `"UP"` \| `"DOWN"` \| `null` |

**Response `200`:**
```json
{ "upvotes": 1, "downvotes": 0, "myReaction": "UP" }
```

**Responses:** `200 OK` · `403 Forbidden` (below COMMUNITY_VERIFIED, or proposal outside annotation window) · `404 Not Found`

---

### Annotation notes

- `GET /governance/:proposalId` includes `annotations[]` with `upvotes`, `downvotes`, `myReaction` pre-computed. Raw reactions are never exposed to clients.
- If the proposal text is edited after an annotation was created, the stored `quotedText` snapshot is used as a fallback. The frontend checks `text.slice(startOffset, endOffset) === quotedText` and renders orphaned annotations below the text body instead of as inline highlights.
- On-chain anchoring uses a triple-guard: `NODE_ENV !== 'test'`, user has a `walletAddress`, and `GovernanceVoting` contract is configured. If any guard fails the off-chain record is still created and `anchorTxHash` is left null.
- Annotator colour palette (in assignment order): `#C9922A` · `#1D4731` · `#2A6B7C` · `#8B3A2A` · `#2A4A7F` · `#6B4F9E` · `#1A6B3C`. The same user always gets the same colour on a given proposal.

---

## Notes

- Voting power is determined by PR balance at snapshot time, not at vote-cast time.
- Each user can vote once per proposal. Attempting to vote again returns `400`.
- Quorum: minimum 40% of eligible members must vote; of those, 50%+ YES weight required for APPROVED.
- `proposalScope` defaults to `GROUP` when `groupId` is provided and no explicit scope is sent.
- National/community proposals with no ward/constituency/county binding skip the primaryWard residency check on voting — any verified member may vote.
- `resubmissionCount` tracks how many times a proposal has been reset from REJECTED to DRAFT. Maximum is 3.
- On REJECTED tally outcome, `reviewNote` is auto-set: "Voting closed: proposal did not achieve quorum (X% turnout, 40% required)" or "…did not achieve approval majority (X% yes, 50% required)".
- Proposal types: `COMMUNITY_INITIATIVE`, `INFRASTRUCTURE`, `POLICY`, `EMERGENCY`, `BUDGET`, `ELECTION`.
- Scope `COMMUNITY` proposals appear on the public Platform Governance page (`/governance`).
- Co-funding: `groupFundingAmount` is drawn from the group treasury; `locationFundingRequest` is drawn from the ward/constituency/county treasury when approved by the location admin.
- The memory layer (`rationale`, `alternatives`, `outcome`) is displayed on the frontend proposal detail page. Outcome recording is voluntary — it is for community accountability, not enforced.
- Status `PASSED` does not exist — the correct post-tally status is `APPROVED`.

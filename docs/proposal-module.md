# UjamaaDAO Proposal Module — High-Level Documentation

> **Module status:** `tested` — 148 green tests across 5 files.
> Routes mounted at `/api/v1/governance`. See `proposal-api.md` for full endpoint reference.

---

## Overview

The Proposal module handles the full governance lifecycle: draft → location-admin review → voting → tally, with a memory layer for rationale documentation, real-world outcome recording, and inline public participation via annotations.

---

## Features

- Full proposal lifecycle (DRAFT → PENDING_REVIEW → APPROVED_FOR_VOTING → VOTING → APPROVED/REJECTED)
- 2-stage location-based review chain: LEADER forwards, location admin approves
- GROUP and COMMUNITY proposal scopes
- Co-funding fields (`groupFundingAmount`, `locationFundingRequest`)
- PR-weighted voting with snapshot at voting-open time
- ABSTAIN vote option (excluded from deciding weight)
- Quorum enforcement: 40% turnout + 50%+ YES weight
- Resubmission: REJECTED → DRAFT reset, max 3 times
- Ward Memory layer: `rationale`, `alternatives`, `outcome` fields
- Execution progress tracking (APPROVED → EXECUTING → COMPLETED)
- **Inline annotations** (session 82): highlight any passage, comment, UP/DOWN reactions, on-chain hash anchoring
- Scheduled jobs: daily tally (00:30) + 30-day auto-reject of stale reviews (00:35)
- Baraza AI integration: `search_past_decisions` returns matching proposals and annotations

---

## Data Model

### `Proposal`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `groupId` | UUID | Owning group |
| `creatorId` | UUID | |
| `title` | string | min 10 chars |
| `description` | string | min 50 chars |
| `rationale` | string? | Ward Memory — why this approach |
| `alternatives` | string? | Ward Memory — what else was considered |
| `outcome` | string? | Post-execution accountability record |
| `outcomeRecordedAt` | DateTime? | |
| `proposalType` | enum | COMMUNITY_INITIATIVE / MAJOR_PROJECT / STRATEGIC_DECISION / EMERGENCY |
| `proposalScope` | enum | GROUP / COMMUNITY |
| `status` | enum | DRAFT / PENDING_REVIEW / APPROVED_FOR_VOTING / VOTING / APPROVED / REJECTED / CANCELLED / EXECUTING / COMPLETED |
| `resubmissionCount` | int | Max 3 |
| `reviewNote` | string? | Rejection reason shown to creator |
| `fundingAmountKes` | int? | Total funding request |
| `groupFundingAmount` | int? | Group treasury share |
| `locationFundingRequest` | int? | Location treasury share |
| `votingStartsAt` | DateTime? | |
| `votingEndsAt` | DateTime? | |

### `ProposalAnnotation`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `proposalId` | UUID | |
| `authorId` | UUID | |
| `fieldKey` | string | description / rationale / alternatives |
| `startOffset` | int | Character offset in field text |
| `endOffset` | int | |
| `quotedText` | string | Snapshot at annotation time — fallback if text is later edited |
| `comment` | string | Annotator's opinion |
| `color` | string | Hex — assigned deterministically by annotator order |
| `anchorTxHash` | string? | On-chain hash tx (null in dev/test) |
| `createdAt` | DateTime | |

### `ProposalAnnotationReaction`
| Field | Type | Notes |
|---|---|---|
| `annotationId` | UUID | |
| `userId` | UUID | |
| `type` | string | UP / DOWN |

Unique constraint: one reaction per user per annotation.

---

## Business Rules

- **PR cost to create**: deducted on proposal creation (configured in PlatformConfig).
- **IP percentile gate**: COMMUNITY scope requires top-90% IP in the group. GROUP scope has no IP gate.
- **Voting eligibility**: members must be COMMUNITY_VERIFIED. Community/national proposals skip the primaryWard residency check.
- **Snapshot**: PR balances are snapshotted when voting opens — changes after snapshot do not affect vote weight.
- **ABSTAIN** is stored as `null` in `GroupMemberVote.vote` (true = YES, false = NO, null = ABSTAIN). Abstains count toward quorum but not toward approval weight.
- **Annotation window**: PENDING_REVIEW + APPROVED_FOR_VOTING only. Annotations and reactions are forbidden once voting opens.
- **Annotation colour**: palette of 7 colours assigned by order of first annotation per user per proposal — deterministic, stable across sessions.
- **On-chain anchor**: `GovernanceVoting.recordOpinion(bytes32 proposalId, bytes32 annotationHash)` emits `OpinionAnchored` event. Triple-guard: skipped silently in test environments and when wallet/contract not configured.

---

## Proposal Type → Cover Photo

Proposal cards use category-specific Kenyan photo pools for visual context:
- `COMMUNITY_INITIATIVE` — community gathering / borehole / cooperative scenes
- `MAJOR_PROJECT` — construction / infrastructure scenes
- `STRATEGIC_DECISION` — meeting / planning / discussion scenes
- `EMERGENCY` — urgency / response scenes

Photo is assigned deterministically: `seed = sum(first 4 UUID chars as hex) % pool.length`.

---

## Key Files

```
backend/src/modules/governance/services/proposal.service.ts           — lifecycle + tally + resubmit
backend/src/modules/governance/services/proposal-annotation.service.ts — annotation CRUD + react
backend/src/modules/governance/services/proposal-voting.service.ts    — vote casting + snapshot
backend/src/modules/governance/services/proposal-lifecycle.service.ts — review chain
backend/src/modules/governance/routes/proposal.routes.ts              — all routes
backend/src/modules/governance/prisma/schema.prisma                   — Proposal + Annotation models
backend/tests/governance/proposal.annotation.test.ts                  — 27 annotation tests
frontend/components/governance/annotatable-text.tsx                   — highlight + popovers
frontend/components/governance/annotation-sidebar.tsx                 — sidebar card list
frontend/app/proposals/[proposalId]/page.tsx                          — full proposal detail page
```

# Proposal → Project Pipeline (design)

> **Status:** Accepted design (directional). Decision record: **ADR-060** (`ai_workflows/DECISIONS.md`).
> **Date:** 2026-07-13 (Session 110).
> **Scope:** the full lifecycle from a proposal being drafted, through the group vote, into a
> funded, executing project — and the money-consent rules that govern it. Nothing here is built
> yet; it documents (a) the current, already-coherent pipeline and (b) the four additions agreed
> in the S110 design conversation.

---

## 0. TL;DR

1. **The pipeline is already coherent and gated** (built in Sessions 103 & 105). A PROJECT
   proposal cannot start execution without a `Project` existing first, treasury is disbursed
   exactly once on `APPROVED → EXECUTING`, POLICY and PROJECT are cleanly split, and milestones +
   setup details are captured at a post-vote gate. Document this; don't rebuild it.
2. **Funding becomes a per-source stack** that sums to the budget. Each source carries its **own
   consent** and is secured on its **own clock**. The decorative `fundingSource` label + the
   dead `locationFundingRequest` field are replaced by real per-source mechanics.
3. **A group asking a higher community for treasury money is a new proposal type — a Funding
   Request** — decided by that community's members' vote, **never by an admin**. Consent follows
   the money. (This is a non-negotiable-level, anti-capture rule.)
4. **The gap between "proposal passed" and "project ACTIVE" is the Setup phase** (proposal
   `APPROVED` + project `PLANNING`). It does three things: an advisory **Execution Council**
   (Stage B) drafts the plan, humans refine and **ratify** it (team assembles and accepts roles),
   and **funding is locked in** source by source. **Shortfalls are handled by phasing** —
   execute the part the secured money covers; later phases unlock as their funding secures.

**Deferred to a follow-up ADR (ADR-061, not built here):** new actor types — organizations /
grantors and non-participatory (funder-only / beneficiary-only) members. Governing rule: **money
never buys governance power.**

---

## 1. Current state (verified against code, 2026-07-13)

The pipeline the S110 conversation set out to "fix first" is, in fact, already sound. The
keystones (Sessions 103/105):

**Two lifecycles, one gated handoff.**

```
PROPOSAL (governance)                                   PROJECT (execution)
DRAFT → PENDING_REVIEW → APPROVED_FOR_VOTING → VOTING → APPROVED ─┐
                                                                 │  (PROJECT kind)
                                                                 ▼
                                          POST /projects/from-proposal  → Project (PLANNING)
                                                                 │
                                          APPROVED → EXECUTING  ◄─┘  (blocked until project exists)
                                          → treasury disbursed once
                                          → COMPLETED
   (POLICY kind: APPROVED → COMPLETED, no project, no execution)
```

- **The handoff is a gate, not a loose call.** `project.service.ts › createFromProposal` creates
  the `Project` in `PLANNING` and **does not debit treasury** (`// NOTE: treasury is NOT debited
  here. Disbursement happens once, when the proposal transitions APPROVED → EXECUTING`).
- **EXECUTING is blocked without a project.** `proposal-lifecycle.service.ts › updateProgress`
  throws *"Set up the project (define its milestones) before starting execution."* for a PROJECT
  proposal with no project. So "proposal EXECUTING" and "project exists" can never disagree.
- **POLICY vs PROJECT is clean.** `isPolicy ? { APPROVED: [COMPLETED] } : { APPROVED: [EXECUTING],
  EXECUTING: [COMPLETED] }`. Policies are recorded, never "executed."
- **Structured intake already exists.** Session 103 promoted `problem` / `solution` to structured
  columns and added a `fundingSource` pick-list — **derived from six real deliberations'**
  revision-suggestions and unanswered-questions. The post-vote setup gate captures
  `maintenancePlan`, `recurrentCostKes` + `recurrentCostPeriod`, `siteLocation`, `landTenure`,
  `beneficiaries` — the council's most frequent HIGH-severity gaps, asked when the proposer is
  motivated (post-vote). This **is** an early, partial realization of the two-stage idea.
- **On-chain anchored.** Session 105's `ProjectRegistry.sol` anchors project-created / milestone-
  verified / work-approved / completed.

### The real gaps (narrow)

Everything above works. What's genuinely missing:

1. **Funding model is decorative / dead.** Disbursement reads **only** `groupFundingAmount`
   (`fundAmount = Number(proposal.groupFundingAmount ?? 0)`). `fundingSource` (a `String?`) is a
   label the money logic never reads, and `locationFundingRequest` is captured at creation but
   **never moves a shilling**. `GROUP_TREASURY` and `MEMBER_CONTRIBUTIONS` resolve identically
   (both = a treasury debit); there is **no collection mechanism** for money that isn't already in
   the treasury, and **no legitimate path** for one community to fund another.
2. **No structured team with role acceptance.** Setup auto-adds a single `LEAD`. There is no
   named "technical lead / verified builder team" whose members must **accept** a role before
   execution — the exact thing the council repeatedly demands.
3. **No risk-allocation field.** Nobody records "who bears the loss if it fails at unit 20."
4. **No Stage-B execution council.** The setup gate is filled by hand; nothing drafts the plan
   (milestones, roles, risk, funding phases) for humans to ratify.

---

## 2. The two-stage model

**Stage A — Deliberation ("Should we?")** — *built.* The Baraza council. Stress-tests whether the
idea is sound; produces the readiness read, Kadere values check, and "things to fix." Advisory →
feeds the **human vote**.

**── group vote → APPROVED ──**

**Stage B — Execution Council ("How, with whom, and safely?")** — *new.* Runs in the Setup phase.
It is **not** "is this a good idea"; it turns an approved idea into a real, safe plan. It
**ingests Stage A's output** (chokepoints, "things to fix," Kadere tension) and drafts a
**structured, ratifiable execution plan**:

- **Milestone breakdown + sequencing**, funding-aware (draws phase boundaries at secured-money
  lines).
- **Team roster as role slots** — technical lead, verified builders — to be filled by **named
  humans who must accept**.
- **Budget tranches** released per verified milestone.
- **Risk allocation** — who bears the loss on failure.
- **Chokepoint → mitigation** mapping.

**Guardrail (Vision Keeper).** Stage B is **advisory**. It *proposes* a plan; it **names no
person, assigns no role, and moves no funds.** Humans ratify — the proposer/committee fill the
slots with real people who accept, confirm the budget, and sign off the risk statement. Same
**propose → ratify** discipline as the knowledge layer. An AI that auto-assigned people or released
tranches would violate the non-negotiable "AI informs, never acts."

> **Naming:** "Execution Council" and "Stage B" are used interchangeably. Composition draws on the
> existing Baraza roster's execution-relevant lenses (Fundi/Foreman = build & sequencing,
> Mkurugenzi = budget/tranches, Mpelelezi = chokepoints/risk, Mjamaa = structure/roster) rather
> than a wholly new set of agents. It runs **once** at the Setup phase (like the framing agents),
> not per round, to bound Qwen cost.

---

## 3. The Setup phase (proposal APPROVED + project PLANNING)

The gap between "proposal passed" and "project ACTIVE" already exists in code: the project is
created in `PLANNING` while the proposal sits at `APPROVED` (not yet `EXECUTING`). That gap **is**
the Setup phase. It does three things at once:

```
STAGE A (deliberation)  →  group VOTE  →  APPROVED
"should we?" (advisory)                    │
                                           ▼
              ┌──────────────── SETUP PHASE ────────────────┐
              │        (proposal APPROVED · project PLANNING) │
              │                                               │
              │  1. EXECUTION COUNCIL (Stage B) drafts an     │ ← the project
              │     advisory plan: milestones, team-role      │   AI deliberation
              │     slots, risk allocation, funding-based     │   starts HERE
              │     phasing.                                   │
              │  2. Humans refine + RATIFY: team assembles     │
              │     (join / accept a role, incl. cross-group), │
              │     budget confirmed, risk statement signed.   │
              │  3. Funding LOCKED IN, source by source:        │
              │     • group treasury share ✓ (this vote)        │
              │     • member contributions → collection flow    │
              │     • location share → Funding Request vote      │
              │       by that community                          │
              │     • external grant → confirmed                  │
              └────────────────────┬──────────────────────────┘
                                   ▼
        first phase funded + plan ratified  →  project ACTIVE (proposal EXECUTING, disburse)
```

A project **goes ACTIVE (and treasury disburses) only when the first phase is funded and the plan
is ratified.** Phases whose money is not yet secured stay pending until their source clears.

---

## 4. Funding model — a per-source stack

Replace the single decorative `fundingSource` enum + the overlapping `groupFundingAmount` /
`locationFundingRequest` amounts with **one funding breakdown**: a list of `{ source, amountKes }`
lines that **sum to the project budget**. Each source has real mechanics and its own consent:

| Source | Whose money | Who consents | When it's secured |
|---|---|---|---|
| `fromGroupTreasury` | the group's own treasury | the group's members | **this proposal's own vote** (authorized on pass) |
| `fromMemberContributions` | new money members pledge/raise | the group's members | **collection flow** completes (new mechanic — see below) |
| `fromLocationRequest` | a higher community's treasury (ward → constituency → county) | **that community's members** | a **separate Funding Request vote** passes (§5) |
| `fromExternalGrant` | outside money (org/grantor) | recorded; no internal treasury spent | grant **confirmed** — **carries no governance rights** |

**Consequences of the stack model:**

- **A budget is a stack.** If the group treasury covers KES 200K of a KES 520K project, the plan
  is e.g. `200K treasury + 120K member contributions + 200K location request`. This is the honest
  way communities actually fund things — and it's exactly the funding shape the hydroponics
  deliberation flagged as unsupported ("520K from contributions, 0 treasury").
- **Sources clear on different clocks.** Group treasury + member contributions are authorized the
  moment this proposal passes; a location request runs a separate vote that may pass **later** or
  **fail**; a grant arrives on its own timeline. Hence the **funding-assembly** work in the Setup
  phase.
- **Member-contribution collection flow (net-new mechanic).** "Member contributions" today
  silently assumes the money is already in the treasury. A real pledge → collect (M-Pesa to the
  platform account per Rule 2) → credit-treasury flow is required for it to mean anything. Until
  built, `fromMemberContributions` is only honest if the funds are already present.
- **Non-custodial end to end.** Every shilling is spent only by a vote of the community whose
  treasury it is. No admin ever authorizes a spend.

---

## 5. New proposal type: Funding Request

A project **cannot declare** it is taking a higher community's money, and **no admin can grant
it.** When a plan includes a `fromLocationRequest` source, it spawns a linked **Funding Request** —
a new proposal type (`FUNDING_REQUEST`) submitted to the target community (the ward, constituency,
or county whose treasury is asked):

- The **target community's members vote** on whether to allocate their treasury.
- On **pass**, that community's treasury disburses the requested amount to the project.
- On **fail / shortfall**, the project falls back to phasing (§6) — it does not stall the whole
  project, only the phase that money was for.

**Why it's a distinct type, not a field:** it has a different *decider* (a different community
than the proposing group), a different *treasury*, and its own review/vote lifecycle. Modeling it
as anything less than a proposal would smuggle in an admin-grants-money path, which is precisely
the anti-capture line: **consent follows the money.**

This cleanly separates two things the old `locationFundingRequest` field blurred: *the group's own
spend* (this vote) vs *a request against another community's treasury* (that community's vote).

---

## 6. Shortfall handling — phased (decided)

When a source falls through (the location vote fails, contributions fall short), the project does
**not** die and does **not** wait indefinitely. It uses **phased / fund-what-you-have** execution:

- Execute the part the **secured money covers now** — e.g. the group's 200K funds a **5-unit
  Phase 1 pilot**.
- **Later phases unlock as their funding secures** — Phase 2 begins when the constituency Funding
  Request passes or contributions complete.
- The Execution Council draws phase boundaries at the secured-money lines, so the council's
  "start with a pilot" advice becomes a concrete, funded, phased plan.

*(Rejected alternative: all-or-nothing — the project can't execute until the full stack is secured.
Phasing was chosen as the more Ujamaa, momentum-preserving model: communities start with what they
have and grow.)*

---

## 7. Fields the deliberation demands

The deliberation is effectively a spec for what a good proposal/project must contain — every
recurring "unanswered question" maps to a missing structured field. Session 103 already promoted
several (`problem`, `solution`, `fundingSource`, and the setup-gate details). This design adds the
remaining ones:

- **`fundingBreakdown`** — the per-source stack (§4), replacing `fundingSource` +
  `locationFundingRequest`. (`groupFundingAmount` is subsumed as the `fromGroupTreasury` line.)
- **`riskAllocation`** — who bears the loss on failure (drafted by Stage B, ratified by humans).
- **Structured team roster** — role slots (technical lead, verified builders) with an **invite →
  accept** step; membership is no longer just the auto-added `LEAD` + ad-hoc joins. Cross-group
  members are allowed at this stage (per ADR-054), which is *why* team assembly belongs to the
  project, not the proposal.
- **`participationBasis`** (proposal-level) — a light capture of "who is this for / who will do
  it," reinforcing that "who wants this" is the reason it is a proposal.

**Roles at proposal stage stay minimal — a project lead only** (the proposer or a delegate). The
rest of the team assembles in the Setup phase. Capturing a full roster at proposal time is
premature: people from other groups may join, and the point of a proposal is to discover *who
wants this*.

---

## 8. Explicitly deferred (follow-up ADR-061)

**New actor / identity types** — organizations & grantors, and non-participatory (funder-only or
beneficiary-only) members — surface naturally from the funding model but are a **membership/RBAC
redesign**, not a pipeline change. They are deferred to keep this ADR focused. The governing rule
for all of them, fixed now:

- **Money never buys governance power.** A grant is *money with zero governance rights* — the
  constitution names "any funder or outside institution" as something not allowed to control
  outcomes. An organization can fund a Funding Request but gets **no vote, no PR, no say**.
- **PR is earned by participation and non-transferable** (Rule 4). A funder-only or beneficiary-
  only role is legitimate; a "pay for more votes" role is exactly what is forbidden.

---

## 9. Implementation sequencing (smallest-first)

Nothing here is launch-blocking; build incrementally on the already-solid foundation.

1. **`fundingBreakdown` model + intake** — per-source stack that sums to budget; migrate
   `fundingSource`/`locationFundingRequest` readers. Disbursement reads the `fromGroupTreasury`
   line (behavior-preserving for treasury-only projects).
2. **Funding Request proposal type** (`FUNDING_REQUEST`) — new kind, review/vote lifecycle,
   target-community disbursement on pass, linked back to the originating project.
3. **Phased execution** — phase model on projects; ACTIVE-on-first-phase-funded; later phases
   unlock on their source clearing.
4. **Structured team roster + invite/accept** and **`riskAllocation`** field at the Setup gate.
5. **Execution Council (Stage B)** — advisory draft of milestones/roles/risk/phasing at the Setup
   phase; propose → ratify; runs once; bounded Qwen cost. **Run `/vision-check` before building —
   especially the Funding Request path (Rule 2 + anti-capture).**
6. **Member-contribution collection flow** — pledge → M-Pesa collect (platform account, Rule 2) →
   credit treasury.
7. *(Separate)* **ADR-061** — actor/identity types (orgs, grantors, non-participatory members).

---

## Related

- **ADR-054** — project participation gated by owning-group membership (cross-group join basis).
- **ADR-059** / `docs/baraza-panels-and-memory.md` — the Stage-A council the Execution Council
  parallels and reuses lenses from.
- **Session 103/105** (`ai_workflows/PROGRESS_LOG.md`) — the structured-intake + setup-gate +
  on-chain-anchoring work this builds on.
- Memory `project_proposal_capture_gap` — the origin of the fields-from-deliberations thread.

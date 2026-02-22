# ORCHESTRATION.md — How Tasks Flow

> This is the practical guide for running a Claude session on UjamaaDAO.
> Follow the flow that matches your task size. Don't use the full sequence for a bug fix.

---

## Task Tiers

Choose the tier before starting. Be honest about which one you need.

| Tier | What it is | Flow |
|---|---|---|
| **Quick** | Bug fix, config tweak, doc update, Docker adjustment | Developer → QA |
| **Standard** | New endpoint, new job, schema change, UI component | Vision Keeper (if incentive-related) → Architect → Developer → QA → Docs |
| **Major** | New module, new token mechanic, new external integration | All six hats, full sequence |
| **Emergency** | Live incident, broken auth, dead queue, container crash | See `ai_workflows/EMERGENCY_PROTOCOLS.md` — read it before anything else |

---

## Full Sequence (Major tasks)

### Step 0 — Reality Check
*Mandatory at the start of every session, before any work.*

Check the module status table in `ai_workflows/CLAUDE.md` section 3. Verify:
- Is the module you're working on `partial` or `scaffold`? If scaffold, you may need to build basics before the planned task.
- Does the task depend on another module being `production-ready` first? (Per ADR-010: don't start marketplace until auth is solid.)
- Are there cross-cutting gaps (no tests, unverified Docker) that block the task?

If you find drift between the status table and reality (new files that aren't reflected), update the table before proceeding.

### Step 0.5 — Vision Check
*Only mandatory if the task touches rewards, tokens, incentives, economy, or marketplace.*

Wear the Vision Keeper hat. Run the check. If FAIL, stop and return an alternative. If PASS, document it and continue.

Every incentive/reward task that skips this step is automatically suspect.

### Step 1 — Project Manager Opens
Define scope in this format:
```
Task: [one sentence]
Tier: Quick / Standard / Major
Hats needed: [ordered list]
Success criteria: [max 4 bullets]
Relevant files: [real paths]
Blockers: [anything preventing start]
```

Refuse to start if the backend isn't running and the task depends on it. Check module status table first.

### Step 2 — Architect Plans
Design before anyone touches code. Check `ai_workflows/DECISIONS.md` first — if a relevant ADR exists, build on it rather than re-deciding. If you're making a new architectural decision, add it to DECISIONS.md before writing code.

Output:
- Architecture decision + rationale (and ADR reference if applicable)
- On-chain vs off-chain decision (explicit)
- Prisma schema changes (if any) + migration strategy
- API contract (if endpoint)
- Event/queue design (if async)
- Ordered implementation steps with file paths
- Risks

No code in this step. Planning only.

### Step 3 — Developer Implements
Write the code, following the Architect's plan and CLAUDE.md conventions. Output:
- Full file contents with paths
- Inline comments on non-obvious decisions
- Curl command or test snippet to verify locally

Flag disagreements with the Architect's plan rather than silently diverging.

### Step 4 — QA Reviews
Structured review output (see AGENTS.md). Pay special attention to:
- Auth token validation (see `backend/src/modules/auth/services/auth.service.ts`)
- Failed job handling (see `backend/src/workers.ts`)
- Graceful shutdown still works (see `backend/src/index.ts`)
- Any new endpoint has rate limiting applied

### Step 5 — Docs Updates
- Update CLAUDE.md progress snapshot (done/partial/not started)
- Add to PROGRESS_LOG.md
- Write API doc if new endpoint was added
- Write user-facing guide if feature affects ward members

### Step 6 — DevOps Signs Off
- Confirm `make dev` still works
- Add healthchecks/depends_on for any new service
- Update env variable docs
- Flag anything that needs CI/CD update

### Step 7 — Project Manager Closes
- Summary of changes
- Updated CLAUDE.md and PROGRESS_LOG.md confirmed
- Next milestone defined

---

## Session Starter (copy-paste this at the top of every new session)

```
Load full UjamaaDAO context from CLAUDE.md, AGENTS.md, ORCHESTRATION.md, and PROGRESS_LOG.md.

Mode: [Planning / Coding / Review / Emergency / Documentation / DevOps]
Tier: [Quick / Standard / Major]
Task: [specific description]

Follow the orchestration flow for this tier.
Run Vision Keeper check first if this task involves rewards, tokens, incentives, or marketplace.
Output in markdown with full file paths in code blocks.
```

---

## Cross-Cutting Rules (apply to every task, every tier)

- Marketplace tasks: confirm discovery-only before touching any listing/matching logic
- Blockchain tasks: default to hybrid — never move off-chain logic on-chain without an explicit decision
- M-Pesa tasks: always route through platform-controlled accounts, never P2P
- Docker tasks: test with `make dev` and `make logs` before declaring done
- Token/reward tasks: Vision Keeper runs first, always
- Every session that changes code must end with PROGRESS_LOG.md updated

---

## What "Done" Means

A task is done when:
1. Code is written and follows CLAUDE.md conventions
2. Module passes the readiness checklist in CLAUDE.md section 6
3. `make dev` works cleanly
4. At least a happy path test exists and passes
5. PROGRESS_LOG.md is updated
6. CLAUDE.md module status table reflects the new state
7. If the task touches M-Pesa, governance votes, or treasury: QA security notes have been addressed before merge
8. If a new architectural decision was made: it's recorded in DECISIONS.md

---

## Version History

| Version | Change |
|---|---|
| v1.0 | Initial creation |
| v1.1 | Added Vision Keeper as mandatory step |
| v1.2 | Added real code references |
| v1.3 | Added Docker steps |
| v2.0 | Full rewrite — tier system, session starter, practical over ceremonial |
| v2.1 | Fixed file paths (backend/ prefix, workers.ts) |
| v2.2 | Added Step 0 reality check, DECISIONS.md in Architect step, security to Done definition, Emergency clarification |

# PROMPT_TEMPLATES.md — Copy-Paste Starters

> These templates are tools, not rituals.
> Use the one that matches your task. Adapt the bracketed sections. Don't overthink it.

---

## Master Session Opener

Use this at the top of every new Claude session. Fills Claude's context before any task.

```
Load full UjamaaDAO context from CLAUDE.md, AGENTS.md, ORCHESTRATION.md, and PROGRESS_LOG.md.

Mode: [Planning / Coding / Review / Emergency / Documentation / DevOps]
Tier: [Quick / Standard / Major]
Task: [your task here]

Rules:
- Follow orchestration flow for this tier
- Run Vision Keeper check first if task involves rewards, tokens, incentives, or marketplace
- Use Version A (pragmatic Docker Compose) unless I say "Version B"
- Real file paths only (e.g. src/modules/auth/services/auth.service.ts)
- Output in markdown with code blocks and numbered steps
```

---

## Template 1 — Vision & Incentive Safety Check

Use before any task touching rewards, tokens, UT, PR, Impact Points, or marketplace features. This is mandatory, not optional.

```
Wear the Vision Keeper hat.

Proposed mechanism: [describe the reward/incentive/feature in 2–3 sentences]

Check against:
- Non-negotiable rules in CLAUDE.md section 2
- Marketplace = discovery-only (no payments)
- No cash-out for earned UT
- Incentives must tie to real collective value, not individual grinding

Output:
1. Vision alignment: PASS / FAIL / CONDITIONAL
2. What real value does this create for a ward?
3. Abuse risk: Low / Medium / High + specific scenario
4. If FAIL or CONDITIONAL: recommended alternative
5. Final recommendation (one sentence)
```

---

## Template 2 — Architecture Planning

Use after a Vision PASS, before any code is written.

```
Wear the Architect hat.

Task: Design the implementation of [feature name]
Context: [paste relevant rows from CLAUDE.md module status table]
Reference files: backend/src/app.ts, backend/src/workers.ts, backend/src/modules/[name]/prisma/schema.prisma

Output in order:
1. Architecture decision summary (one sentence)
2. On-chain vs off-chain decision (explicit, with reason)
3. Prisma schema changes (list model changes or "none")
4. API contract:
   - Endpoint + method
   - Auth required?
   - Request body/params
   - Response shape
   - Error cases
5. Events or queues involved (emit what, when, to which queue)
6. Implementation steps (numbered, with full file paths)
7. Risks and mitigations

No code in this step. Planning only.
```

---

## Template 3 — Feature Implementation

Use after architecture is planned and approved.

```
Wear the Developer hat.

Task: Implement [feature name] per the Architect's plan
Tech: TypeScript strict, Prisma, BullMQ, Express middleware from src/app.ts
Constraints: [list any — e.g. discovery-only, no P2P payments, JWT required]

For each file, output:
File: [full path]
[complete code]

Then provide:
- Curl command or test snippet to verify locally with make dev running
- Any new environment variables needed
- Any migration command to run
- Flag any places where you deviated from the Architect's plan
```

---

## Template 4 — Debugging

Use when something is broken and you need systematic help finding it.

```
Wear the Developer hat in debug mode.

Expected behavior: [what should happen]
Actual behavior: [what is happening]
Error output: [paste full error from make logs]
Already tried: [list what you've attempted]
Relevant files: [list e.g. backend/src/workers.ts, backend/src/modules/auth/services/auth.service.ts]

Output:
1. Root cause hypothesis
2. Evidence (which log line or code path confirms it)
3. Fix (with full file path and code change)
4. How to verify the fix works
5. How to prevent this in future
6. If job-related: update to failedJobHandler in backend/src/workers.ts if needed
```

---

## Template 5 — Code Review / QA

Use after Developer completes implementation, or any time you want a second pass.

```
Wear the QA hat.

Code to review:
[paste code or list files]

Feature purpose: [what this is supposed to do]
Auth context: [is this behind JWT? rate limited? ward-scoped?]
Async context: [does this touch a queue or emit an event?]

Output:
Critical (block merge):
- [issue → fix]

Important (fix before next milestone):
- [issue → fix]

Nice to have:
- [issue → fix]

Tests to write: [list cases — happy path + at least 2 edge cases]
Security notes: [CORS, rate limiting, input validation, token handling]
```

---

## Template 6 — Documentation

Use when a feature is complete and needs to be recorded.

```
Wear the Documentation hat.

Feature just completed: [name and one-line description]
Audience: [developers / ward members / both]
What already exists: [any existing docs to update]

Output:
1. API doc (if endpoint): method, path, auth, request, response, errors
2. User guide (if user-facing): plain language, mobile-first, no blockchain jargon
3. CLAUDE.md update: what moved from "In Progress" to "Done"
4. PROGRESS_LOG.md entry: [date], what was built, decisions made, next milestone
```

---

## Template 7 — Docker / DevOps

Use for infrastructure changes, deployment prep, or CI/CD work.

```
Wear the DevOps hat.

Task: [e.g. "add healthcheck to worker service", "set up GitHub Actions CI"]
Affected services: [list from docker-compose.yml]
Current state: [paste relevant section of docker-compose.yml or Makefile]

Output:
1. Updated docker-compose.yml snippet (only changed sections)
2. Updated Makefile commands if any
3. New environment variables needed (with example values)
4. Command to test: make dev, then [specific verification step]
5. CI/CD snippet if applicable
6. Rollback plan if something breaks
```

---

## Template 8 — M-Pesa Integration

Use when implementing any real-money flow.

```
Wear the Architect hat first, then Developer.

Task: Implement [dues collection / project contribution / treasury deposit] via M-Pesa

Hard constraints:
- All money flows to platform-controlled Paybill/Till — never P2P
- STK push only — no storing raw card/phone data beyond what Safaricom sends
- Webhook must validate Safaricom signature before processing
- All transactions logged to Prisma with reference number, amount, phone, status, timestamp

Architecture output first:
1. Flow diagram (ASCII)
2. Prisma models needed
3. Webhook handler design
4. Reconciliation strategy

Then implementation in separate step.
```

---

## Template 9 — Blockchain / Token Task

Use for any on-chain work: PR/UT contracts, governance, treasury.

```
Wear the Architect hat.

Task: [e.g. "design PR soulbound token contract", "implement governance vote on-chain"]
Chain: Base Sepolia (dev) → Base Mainnet (prod)
Local dev: Anvil fork of Base Sepolia at http://127.0.0.1:8545

Hard constraints:
- PR is non-transferable (soulbound) — override all transfer functions to revert
- UT earned in-app has no cash-out path
- Gas must be sponsored for first user transaction (Pimlico paymaster)
- Embedded wallet via Privy or Dynamic — no seed phrase exposure to user

Output:
1. Contract architecture (what's on-chain vs off-chain)
2. Solidity interface or pseudocode
3. Backend integration points (which service calls the contract, when)
4. Testing strategy (Anvil, Hardhat, or Foundry)
5. Migration path from Sepolia to Mainnet
```

---

## Template 10 — Sync CLAUDE.md Module Status with Reality

Use at the start of any session where CLAUDE.md might be stale, or after a burst of development. Keeps the status table accurate.

```
Read the module status table in ai_workflows/CLAUDE.md section 3.

For each module listed, check the actual directory at backend/src/modules/[name]/:
- Does it have controllers/services/routes? → at minimum partial
- Does it have tests that pass? → prerequisite for production-ready
- Is it just a schema or empty directory? → scaffold

Then:
1. List any modules whose status has changed
2. Update the table in CLAUDE.md section 3
3. Note any new modules not yet in the table
4. Add a PROGRESS_LOG.md entry summarising what changed

Do not read individual code files unless a status is genuinely ambiguous.
```

---

## Template 11 — Write Tests for a Module

Use after Developer implements a feature, as part of the Testing hat step. Framework: Vitest + Supertest.

```
Wear the Testing hat.

Module: [e.g. auth]
Feature just implemented: [e.g. phone OTP verification]
Service file: backend/src/modules/[name]/services/[name].service.ts
Route file: backend/src/modules/[name]/routes/[name].routes.ts

Write tests covering:
1. Happy path — expected input produces expected output
2. Auth failure — missing or expired JWT returns 401
3. Validation failure — malformed input returns 400 with useful message
4. Not found — requesting a non-existent resource returns 404
5. [any domain-specific edge case for this feature]

Output:
- Unit test file: backend/src/modules/[name]/services/[name].service.test.ts
  - Mock Prisma client (never hit real DB in unit tests)
  - Test service layer directly, not via HTTP
- Integration test file: backend/src/modules/[name]/routes/[name].routes.test.ts
  - Use Supertest against the Express app
  - Uses postgres_test container from docker/docker-compose.yml

Run command: docker compose exec web npx vitest run
```

---

## Template 12 — Database Migration

Use when a Prisma schema change is needed. Always do this before writing service code that depends on the new schema.

```
Wear the Architect hat, then Developer hat.

Schema change needed: [describe the model addition/change in plain English]
Module: backend/src/modules/[name]/prisma/schema.prisma

Steps:
1. Show the Prisma schema change (model additions, field changes, new relations)
2. Note any data migration concerns (existing rows, nullable vs required fields)
3. Provide the migration command: make db-migrate (runs inside backend container)
4. Show how to verify: make db-shell → \d [table_name]

Rules:
- New required fields on existing models must have a default value or be nullable
- Never drop a column without confirming it's unused across all service files
- Migration file names are auto-generated — do not edit them manually
- Run migration on postgres_test first before postgres (production)
```

---

## Tips

**Be specific in the task line.** "Implement GET /api/v1/marketplace/listings?wardId=uuid" is 10x more useful than "marketplace endpoint."

**Paste real error output.** Claude can't debug from vague descriptions.

**Reference real file paths.** `backend/src/modules/auth/services/auth.service.ts` is better than "the auth file."

**Scope your context.** "Focus on `backend/src/modules/marketplace/` only. Ignore auth, workers, and blockchain for this session." Keeps responses sharp.

**Use `/compact` before major work.** Frees context space without losing the conversation.

**Run Vision Keeper first for anything economy-related.** Five minutes of checking saves an hour of rework.

**Check DECISIONS.md before designing.** If an ADR covers your decision, build on it. If you're making a new decision, add it before writing code.

---

## Version History

| Version | Change |
|---|---|
| v1.0 | Initial creation |
| v1.1 | Added Vision Keeper template + Ujamaa safety checks |
| v1.2 | Added real file references |
| v2.0 | Full rewrite — tighter format, added M-Pesa and blockchain templates, removed ceremony |
| v2.1 | Fixed file paths (backend/ prefix, workers.ts, per-module prisma schemas) |
| v2.2 | Added Templates 10 (status sync), 11 (tests), 12 (migrations); updated Tips |

# AGENTS.md — Who Does What

> These are not personas. They are *hats* you wear depending on the task.
> In any given Claude session, you may wear one or several — the Project Manager decides which.

---

## How to Use This File

At the start of a task, the Project Manager hat decides which other hats are needed and in what order. The default sequence is:

**Vision Keeper → Architect → Developer → QA → Testing → Docs → DevOps**

Not every task needs all seven. Use judgment. A bug fix might only need Developer + QA. A new incentive mechanism needs all seven.

---

## Orient (New Session)

**Wear this hat at the very start of a fresh Claude Code session, before any other hat.**

Your job: load the live project state and report back clearly so the session starts from the right place.

**Read in this order (no exceptions):**
1. `ai_workflows/SESSION_STATE.md` — live snapshot (what's running, what's broken, next task)
2. `ai_workflows/CLAUDE.md` — full project brain (rules, conventions, module status)
3. Last 2 entries of `ai_workflows/PROGRESS_LOG.md` — recent history only

**Output format (required):**
```
Project state: [one sentence — is it running? what's tested?]
Last session fixed/built: [one sentence]
Open issues: [bullet list from SESSION_STATE.md known issues]
Next task: [first item from SESSION_STATE.md next tasks]
Ready to: [which hat to wear next]
```

**Rules:**
- Read SESSION_STATE.md first — it is the authoritative live snapshot; CLAUDE.md section 3 is supplementary
- Read only the last 2 PROGRESS_LOG.md entries — do not read the full history
- Always surface known open issues before accepting a new task from the user
- If SESSION_STATE.md does not exist, fall back to CLAUDE.md section 3 + `git log --oneline -5`

---

## Vision Keeper

**Wear this hat first for any task involving rewards, tokens, economy, user incentives, or marketplace features.**

Your job: be a skeptic. Challenge anything that violates the non-negotiable rules in CLAUDE.md. Your output is short and decisive.

**Output format (required):**
```
Vision alignment: PASS / FAIL / CONDITIONAL
Reason: [one to two sentences]
If FAIL or CONDITIONAL: [specific alternative or condition]
```

**Questions to ask yourself:**
- Does this put payments or escrow in the marketplace? → FAIL
- Does this create a cash-out path for earned UT? → FAIL
- Could users game this for tokens without real contribution? → FAIL or CONDITIONAL
- Does this help a ward build something real, faster? → if no, why are we building it?

**If FAIL:** Stop. Return to Project Manager with an alternative. Do not proceed to Architect.

---

## Project Manager

**Wear this hat to start any task and to close it out.**

Your job: define scope, assign the right hats, keep the session from drifting.

**Opening output:**
```
Task: [one sentence]
Hats needed: [list in order]
Success criteria: [bullet list, max 4 items]
Relevant files: [list real paths from codebase]
Blockers: [anything that must be true before this task starts]
```

**Closing output:**
- Summary of what changed
- What to update in CLAUDE.md and PROGRESS_LOG.md
- Next milestone

**Rules:**
- Check CLAUDE.md progress snapshot before assigning tasks — don't assign frontend work if the backend isn't running
- Any incentive/reward/marketplace task → Vision Keeper goes first, always
- Keep sessions focused. If scope grows, note it and defer or create a new task

---

## Architect

**Wear this hat to design before anyone writes code.**

Your job: make the right structural decision before implementation. Prevent the expensive rework.

**Output format:**
```
Architecture decision: [one sentence summary]
On-chain vs off-chain: [explicit decision with reason]
Schema changes: [list Prisma model changes if any]
API contract: [endpoint, method, request, response shapes]
Event/queue usage: [what to emit or enqueue, and when]
Implementation order: [numbered list of steps with file paths]
Risks: [what could go wrong]
```

**Rules:**
- Always check the hybrid model: on-chain for PR/UT/governance, off-chain for UX
- Reference middleware order from `backend/src/app.ts` for any new routes
- New jobs must be registered in `backend/src/core/jobs/register.ts`
- Docker considerations: does this need a new service? new healthcheck? new volume?

---

## Developer

**Wear this hat to write code. Only after Architect has planned it.**

Your job: implement cleanly, with full file paths, following all conventions in CLAUDE.md section 5.

**Output format:**
```
File: [full path, e.g. backend/src/modules/marketplace/services/listing.service.ts]
[full code block]

---

File: [next file path]
[full code block]
```

**Rules:**
- Never put business logic in route handlers — it goes in service files
- Never use raw SQL — Prisma only
- Never use `setTimeout` for jobs — BullMQ only
- Every new endpoint needs an `ApiError` import and proper error handling
- After writing code, provide a verification snippet: `make dev` first, then a curl against the Traefik-exposed port (check `docker/docker-compose.yml` for port mappings)
- If you're unsure about a design decision, flag it — don't silently choose
- If adding a Prisma schema change, note the migration command: run `make db-migrate` inside the backend container

---

## QA

**Wear this hat after Developer, or any time code needs review.**

Your job: find what breaks, what's missing, and what's insecure — before it ships.

**Output format:**
```
Critical (must fix before merge):
- [issue] → [suggested fix]

Important (should fix):
- [issue] → [suggested fix]

Nice to have:
- [issue] → [suggested fix]

Test cases to write:
- [happy path]
- [edge case 1]
- [edge case 2]
Security notes:
- [anything about CORS, rate limiting, token validation, input sanitization]
```

**What to always check:**
- Does graceful shutdown in `backend/src/index.ts` still work?
- Does the failed job handler in `backend/src/workers.ts` cover new jobs?
- Are there N+1 queries?
- Is input validated before it touches Prisma?
- Are rate limits applied to high-abuse endpoints?
- Are event emissions idempotent if fired twice?

---

## Testing

**Wear this hat after QA, before Docs. No module moves to `production-ready` without this step.**

Your job: write the tests that prove the code works and prevent regressions. Framework: Vitest + Supertest (`backend/vitest.config.ts`).

**Output format:**
```
Test file: [full path, e.g. backend/src/modules/auth/services/auth.service.test.ts]
[full test code]

Run with: make test (or: docker compose exec web npx vitest run)

Coverage:
- Happy path: [description]
- Error case 1: [description]
- Edge case: [description]
```

**What to always test:**
- Happy path through the service layer (not just the route)
- Auth failure — what happens with a missing or expired token?
- Validation failure — what happens with malformed input?
- If async: job is enqueued correctly, not that it runs (unit test the enqueue, integration test the run)
- If cross-module: event is emitted with the right payload

**Rules:**
- Unit tests go in `[module]/services/[name].service.test.ts`
- Integration tests go in `[module]/routes/[name].routes.test.ts`
- Never hit a real database in unit tests — mock Prisma client
- Integration tests use `postgres_test` service from `docker/docker-compose.yml`
- Do not mark a module `production-ready` in the status table until tests pass

---

## Documentation

**Wear this hat when a feature is complete and needs to be recorded.**

Your job: write clearly for two audiences — developers (API docs, code comments) and end users (ward members, group organizers, first-time users).

**Output format:**
- API docs: endpoint, method, auth required, request shape, response shape, error cases
- User guide: plain language, no jargon, mobile-first framing
- CLAUDE.md update: what changed in progress snapshot, what new issues/solutions to add
- PROGRESS_LOG.md entry: date, what was built, what was decided, next milestone

**Rules:**
- Write "How PR works" guides assuming the reader has never heard of blockchain
- Write API docs assuming the reader is a frontend dev who will hit this endpoint
- Update CLAUDE.md and PROGRESS_LOG.md at the end of every significant task

---

## DevOps

**Wear this hat for anything touching Docker, deployment, CI/CD, or infrastructure.**

Your job: keep the system running reliably, everything in containers, nothing on bare metal.

**Output format:**
```
docker-compose.yml changes: [snippet]
Makefile commands affected: [list]
Environment variables needed: [list with example values]
Healthcheck: [if adding a new service]
Test command: [how to verify after applying changes]
```

**Rules:**
- All services must have `depends_on` with `condition: service_healthy` where applicable
- All new services need a `healthcheck` block
- All config goes through environment variables — no hardcoded values in docker-compose
- `make dev` must still work after any change you make
- For CI/CD: GitHub Actions only, Docker-based test runs

---

## Version History

| Version | Change |
|---|---|
| v1.0 | Initial creation |
| v1.1 | Added Vision Keeper + Ujamaa-specific notes |
| v1.2 | Added real code references |
| v1.3 | Added Docker responsibilities |
| v2.0 | Full rewrite — hats not personas, output formats enforced, rules made directive |
| v2.1 | Fixed file paths (backend/ prefix, workers.ts not worker.ts) |
| v2.2 | Added Testing hat, fixed Developer output format path, added migration and Docker verification notes |
| v2.3 | Added Orient hat (new session startup), referencing SESSION_STATE.md as primary context source |

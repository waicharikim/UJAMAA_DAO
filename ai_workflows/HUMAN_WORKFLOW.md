# HUMAN_WORKFLOW.md — Your Field Guide for Building UjamaaDAO with Claude

> This file is for **you**, not Claude.
> Everything else in `ai_workflows/` is Claude's instruction set.
> This is how you operate those instructions effectively.

---

## The Core Idea

Claude has no memory between sessions. Every conversation starts blank.
Your job is to give Claude the right context at the right moment — no more, no less.
Claude's job is to think, plan, and build.

The workflow below is how you do that without losing progress, repeating yourself, or going in circles.

---

## 1. The Session Lifecycle

Every working session has four phases. Don't skip any of them.

```
OPEN → WORK → CHECK → CLOSE
```

### OPEN — Orient Claude (5 minutes)

Paste this at the start of every session. Fill in the blanks.

```
Load full UjamaaDAO context from:
- ai_workflows/CLAUDE.md (project brain + module status table)
- ai_workflows/AGENTS.md (who does what)
- ai_workflows/ORCHESTRATION.md (how tasks flow)
- ai_workflows/PROGRESS_LOG.md (what's happened so far)

Mode: [Planning / Coding / Review / Emergency / Documentation]
Tier: [Quick / Standard / Major]
Task: [one specific sentence — what do you want done?]

Rules for this session:
- Real file paths only (backend/src/... prefix)
- Output in markdown with code blocks
- Run Vision Keeper first if this touches tokens, rewards, or marketplace
- Check module status table before assigning tasks
```

**If you're not sure what to work on**, ask Claude to run the Reality Check:
```
Read the module status table in ai_workflows/CLAUDE.md section 3
and ai_workflows/PROGRESS_LOG.md last entry.
Tell me: what is the highest-value thing to work on next, and what is blocking it?
```

### WORK — Stay in Control

During the session, your job is to:

- **Approve the plan before Claude writes code.** For Standard and Major tasks, Claude will give you an architecture plan first. Read it. Push back if something feels wrong. It's much cheaper to redirect here than after code is written.
- **One task per session.** Scope creep is the fastest way to lose the thread. If a new issue surfaces, note it and finish the current task first.
- **Paste real data.** Errors, logs, file contents — paste them directly. Claude cannot guess what your terminal says.
- **Name the hat you want.** "Wear the QA hat and review this" gets better output than "what do you think of this code?"

### CHECK — Before You Stop

Before ending the session, ask:

```
What files were changed? List them with full paths.
Does anything in the module status table in CLAUDE.md need updating?
What should go in PROGRESS_LOG.md for this session?
```

Then review what Claude outputs. You approve the log entry — don't let Claude auto-commit state you haven't verified.

### CLOSE — The 3-minute ritual

Every session that changes code ends with all three of these:

1. **Module status table updated** in `ai_workflows/CLAUDE.md` section 3
2. **PROGRESS_LOG.md entry added** — what changed, what was decided, what's next
3. **Any new architecture decisions added** to `ai_workflows/DECISIONS.md`

If you skip these, the next session starts with a lie.

---

## 2. Choosing What to Work On

Use this decision order when you sit down and don't know where to start:

```
1. Is anything broken? → Fix it first (Emergency protocol)
2. Is make dev working end-to-end? → If not, that's the task
3. Does any module have tests? → If not, auth module tests are the next milestone
4. Is the current milestone blocked? → Check PROGRESS_LOG.md last entry
5. What's the next module in the ADR-010 sequence?
   Auth → Marketplace → Governance → Education → Emergency → Project Loop
```

**Don't skip ahead.** Don't start governance features while auth has no tests.
The module readiness checklist in `CLAUDE.md` section 6 defines "done." A module isn't done because the code exists — it's done when tests pass.

---

## 3. How to Frame a Task (The Difference Between Good and Bad Sessions)

The quality of Claude's output is almost entirely determined by the quality of your task framing.

### Bad framing (vague, produces drift)
```
can you work on the marketplace
```

### Good framing (specific, produces useful output)
```
Mode: Coding
Tier: Standard
Task: Implement GET /api/marketplace/listings with wardId filter.
Returns paginated listings (limit/offset). Auth required (JWT). Discovery-only — no pricing fields in the response.
Reference: backend/src/modules/marketplace/services/marketplace.service.ts

Run Vision Keeper first, then Architect, then Developer.
```

**The golden rule:** If your task sentence has the word "the" before a module name ("work on the marketplace"), it's too vague. A good task sentence has a verb, a specific endpoint or file, and at least one constraint.

---

## 4. Template Quick Reference

| Situation | Template to use |
|---|---|
| Session start | Master Session Opener (above) |
| Need to know what to work on | Reality Check (above) |
| Anything touching tokens/rewards/economy | Template 1 — Vision Check |
| Designing a new feature | Template 2 — Architecture |
| Implementing from a plan | Template 3 — Feature Implementation |
| Something is broken | Template 4 — Debugging |
| Reviewing code | Template 5 — QA |
| Feature is done, needs recording | Template 6 — Documentation |
| Docker/infra change | Template 7 — DevOps |
| M-Pesa integration | Template 8 — M-Pesa |
| Blockchain/token work | Template 9 — Blockchain |
| CLAUDE.md feels out of date | Template 10 — Status Sync |
| Writing tests | Template 11 — Tests |
| Schema change needed | Template 12 — Migration |
| Production incident | EMERGENCY_PROTOCOLS.md — pick the matching protocol |

All templates live in `ai_workflows/PROMPT_TEMPLATES.md`.
Copy, fill brackets, paste. Don't over-adapt — the templates are already calibrated.

---

## 5. Model Selection (Practical)

Switch with `/model` in Claude Code.

| What you're doing | Use |
|---|---|
| Updating docs, logs, status table | `claude-haiku-4-5` |
| Writing code, debugging, reviewing, tests | `claude-sonnet-4-6` (default) |
| Architecture for a new module | `claude-opus-4-6` |
| Vision Keeper check on economy/incentives | `claude-opus-4-6` |
| M-Pesa or blockchain planning | `claude-opus-4-6` |
| Sonnet gave a shallow answer | Escalate to `claude-opus-4-6` for that task |

The default is Sonnet. Don't use Opus by habit — it costs more and isn't always better.

---

## 6. The Non-Negotiable Habits

These aren't suggestions. Sessions that skip these create the technical debt that kills momentum.

**Before writing any code:**
- [ ] Module status checked — are you working on the right thing?
- [ ] Task framed specifically (verb + file/endpoint + constraints)
- [ ] Vision Keeper run if the task touches economy, tokens, or marketplace

**Before ending any session:**
- [ ] CLAUDE.md module status table updated
- [ ] PROGRESS_LOG.md entry written
- [ ] New decisions recorded in DECISIONS.md
- [ ] make dev still works (or the breakage is documented)

**Always:**
- One task per session. Note scope creep and defer it.
- Paste full error output, never paraphrase it.
- Approve plans before implementation starts.
- Don't mark a module `production-ready` until tests pass.

---

## 7. When Claude Goes Off-Track

This happens. Here's how to recover without losing the session.

**Claude is going too broad / writing code before planning:**
```
Stop. Wear only the Architect hat right now.
Give me the plan only. No code yet.
```

**Claude has forgotten the constraints (e.g. adding payments to marketplace):**
```
Stop. Check non-negotiable Rule 1 in CLAUDE.md section 2.
This violates that rule. Propose an alternative that doesn't.
```

**Claude is using wrong file paths:**
```
All paths must start with backend/src/.
The correct path is backend/src/modules/[name]/...
Please correct and continue.
```

**Claude seems confused about project state:**
```
Re-read ai_workflows/CLAUDE.md section 3 (module status table)
and ai_workflows/PROGRESS_LOG.md last two entries.
Tell me what you now understand about where we are before continuing.
```

**The session is getting too long and output is degrading:**
Use `/compact` to compress context, then paste the session opener again with a specific task.

---

## 8. Different Types of Sessions

### Planning Session
Use when you're not sure what to build next, or starting a new module.

```
Mode: Planning
Tier: Major
Task: Design the implementation plan for the [module] module.
Check DECISIONS.md for any relevant ADRs first.
Wear Architect hat. No code — planning only.
Output: architecture decision, schema changes, API contract, implementation order, risks.
```

### Coding Session
Use when you have a plan and want code written.

```
Mode: Coding
Tier: Standard
Task: Implement [specific thing] per the plan from our last session.
[paste the Architect output from previous session if it was in a different conversation]
Wear Developer hat.
```

### Review Session
Use when code exists and you want a second pass before moving on.

```
Mode: Review
Tier: Quick
Task: Review the [module] service layer for correctness, security, and missing tests.
Files: [list specific files]
Wear QA hat.
```

### Test-Writing Session
Use when a module is at `partial` and you want to push it toward `production-ready`.

```
Mode: Coding
Tier: Standard
Task: Write Vitest unit tests for backend/src/modules/auth/services/auth.service.ts
covering OTP verification happy path, expired OTP, brute force detection.
Wear Testing hat. Use Template 11.
```

### Maintenance Session
Use when things have drifted — docs, statuses, decisions haven't been updated in a while.

```
Mode: Documentation
Tier: Quick
Task: Run Template 10 — sync CLAUDE.md module status table with what's actually in backend/src/modules/.
Then check DECISIONS.md for any Under Review decisions that can be closed.
Update PROGRESS_LOG.md.
```

### Emergency Session
Something is broken. Go straight to `ai_workflows/EMERGENCY_PROTOCOLS.md`.
Pick the protocol that matches. Do not use the standard session opener — use the Emergency prompt.

---

## 9. The Weekly Rhythm (Suggested)

This is a sustainable pace for solo development with Claude. Adapt to your actual schedule.

| Cadence | What to do |
|---|---|
| **Start of each session** | 5-minute OPEN ritual. Orient Claude. |
| **End of each session** | 3-minute CLOSE ritual. Update status + log. |
| **Once a week** | Run Template 10 (status sync). Check if any module moved. |
| **Once a week** | Review DECISIONS.md for Under Review items. Can any be closed? |
| **Every milestone** | Read PROGRESS_LOG.md from the last 5 entries. Are you making real progress or spinning? |
| **Before any new module** | Confirm the previous milestone's module has passing tests. Don't skip ahead. |

---

## 10. The Current State (Feb 2026)

So you always know where you are without hunting through docs:

**Done (architecture solid, code exists):**
Auth, User, Economy, Community, Governance, Projects, Marketplace, Notifications, Onboarding, Emergency, Audit, Admin — all at `partial` status. Code exists. No tests.

**Scaffolded only (schema or empty):**
Reputation (service only), Education, Treasury, Integration, Verification.

**Not started:**
Frontend, M-Pesa, On-chain PR/UT (Base Sepolia), Collective project loop.

**Infrastructure (ready as of 2026-02-21):**
- Prisma schemas aligned (77 models merged, validates cleanly)
- Old migrations cleared — clean slate for first `make dev`
- Docker Compose fixed: REDIS_HOST/PORT, traefik/ directory, worker filename
- queue/index.ts fixed (duplicate export removed)
- registerAllListeners() now called at startup

**The immediate next milestone:**
1. Run `make dev` → verify `/health` responds → run `prisma migrate dev --name schema_alignment` inside the web container
2. Write tests for auth module → move it to `production-ready`
3. Then begin marketplace, following ADR-010

**Open decisions (need your call before work can proceed):**
- ADR-009: Privy or Dynamic for embedded wallets? Decide when blockchain module starts.

---

## 11. Files You Should Know

| File | What it is | When to open it |
|---|---|---|
| `ai_workflows/CLAUDE.md` | Project brain, module status table, tech stack, conventions | Every session |
| `ai_workflows/PROGRESS_LOG.md` | Running log of what happened | Every session start and end |
| `ai_workflows/PROMPT_TEMPLATES.md` | Copy-paste starters | When framing a task |
| `ai_workflows/DECISIONS.md` | Why we built it this way | Before designing anything new |
| `ai_workflows/AGENTS.md` | What each hat does | When Claude isn't behaving right |
| `ai_workflows/ORCHESTRATION.md` | How tasks flow step by step | For Standard and Major tasks |
| `ai_workflows/EMERGENCY_PROTOCOLS.md` | When something is broken | Emergencies only |
| `ai_workflows/MODEL_STRATEGY.md` | Which model to use and when | When choosing model |
| `docker/docker-compose.yml` | All services and their config | Docker/infra tasks |
| `backend/Makefile` | All dev commands | Always |

---

## 12. One-Line Rules to Tattoo on Your Brain

1. **One task per session.** Scope creep is how progress dies.
2. **Approve the plan before the code.** Redirect is free. Rewrite is expensive.
3. **Vision Keeper first, always, for anything with tokens.** Non-negotiable.
4. **Update the log at session end.** The next Claude won't remember anything — the log is its only memory.
5. **No module is done without tests.** Structure without tests is just scaffolding.
6. **Paste the real error.** Claude cannot debug what it cannot see.
7. **Follow ADR-010.** Don't build governance on top of untested auth.

---

*This file is yours. Update it when something about the workflow stops working.*
*Version: 1.1 — 2026-02-21*

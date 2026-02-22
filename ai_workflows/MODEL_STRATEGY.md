# MODEL_STRATEGY.md — Model Selection & Token Hygiene

> This file helps YOU decide which Claude model to use and how to keep sessions lean.
> Claude Code doesn't read this and self-select models — you do.

---

## Model Selection

### Model IDs (use these exact strings in Claude Code)

| Name | Model ID | Cost |
|---|---|---|
| Sonnet | `claude-sonnet-4-6` | Mid |
| Opus | `claude-opus-4-6` | High |
| Haiku | `claude-haiku-4-5` | Low |

Switch model in Claude Code with `/model` command, then select from the list.

### Default rule: start with Sonnet (`claude-sonnet-4-6`)

Sonnet handles 80–90% of UjamaaDAO work well. It's fast, consistent, and cheaper. Use it unless you have a specific reason not to.

### When to downgrade to Haiku (`claude-haiku-4-5`)

Use Haiku for tasks that require no reasoning — just reliable execution:
- Updating PROGRESS_LOG.md or CLAUDE.md status table
- Reformatting code or docs
- Generating boilerplate from a clear template
- Running a search or summarising a file

### When to escalate to Opus (`claude-opus-4-6`)

Escalate when Sonnet gives you an unsatisfying first pass, or when the task falls into these categories:

| Task Type | Model | Why |
|---|---|---|
| Routine coding — new endpoints, Prisma migrations, job processors, Docker tweaks | Sonnet | Fast, accurate enough, cheap |
| Documentation, user guides, CLAUDE.md updates | Sonnet | Consistent output, no deep reasoning needed |
| Code review, security audit, auth flow review | Sonnet | Reliable and objective |
| Writing tests — Vitest unit and integration tests | Sonnet | Predictable, follows patterns well |
| Complex architecture — marketplace discovery design, emergency response flow, hybrid blockchain | Opus | Better reasoning on novel system design |
| Incentive/reward safety checks (Vision Keeper) | Opus | Alignment reasoning matters here, don't cut corners |
| Hard debugging — BullMQ dead-letter issues, subtle event bus bugs, race conditions | Opus | Better at tracing through subtle failure paths |
| Blockchain planning — contract design, gas sponsorship architecture, Privy/Dynamic integration | Opus | Novel enough to warrant it |
| M-Pesa integration planning | Opus | High stakes, complex webhook + reconciliation design |

### Rule of thumb

If Sonnet's answer feels shallow or wrong, switch to Opus for that specific task. Don't use Opus by default — you'll burn through budget on tasks that didn't need it.

---

## Token Hygiene

### The biggest wins

**Specify files explicitly.** "Focus on `backend/src/workers.ts` and `backend/src/core/jobs/register.ts`" uses far fewer tokens than "look at all the backend files." Claude doesn't need to read everything — just what's relevant.

**Use `/compact` before major work.** Frees roughly 70% of context space. Use it before starting a new feature, not in the middle of one.

**Break large tasks into steps.** "Plan the marketplace endpoint" → "Now implement the handler" → "Now write tests" is more efficient than asking for all three at once. Each step benefits from a focused, short context.

**Run Vision Keeper first on incentive tasks.** Five minutes of alignment checking before coding prevents an hour of rework on something that would have been rejected anyway.

### Context window management

When starting a session on a specific file or module, say so:
```
Context scope: src/modules/marketplace/ only.
Ignore auth, worker, and blockchain for this session.
```

This keeps Claude focused and reduces irrelevant output.

### Token budget guidelines

These are rough guides, not hard limits:

| Session type | Token budget |
|---|---|
| Quick fix or doc update | < 10k |
| Standard feature (single endpoint) | 20–40k |
| Major feature (new module) | 50–80k |
| Architecture planning session | 30–60k |
| Emergency debug | No cap — fix it |

If you're past 50k tokens and still on the same task, stop and use `/compact` before continuing.

---

## Cost-Conscious Habits

- Default to Sonnet. Escalate to Opus consciously. Downgrade to Haiku for pure formatting/logging tasks.
- Scope context to relevant files only.
- `/compact` before major work.
- Break tasks into tiers — don't ask for code, tests, and docs in one giant prompt.
- Vision Keeper early → avoid wasted tokens on rejected designs.
- Use Template 10 (status sync) at session start instead of having Claude read the whole codebase.

---

## Version History

| Version | Change |
|---|---|
| v1.0 | Initial creation |
| v1.1 | Added Ujamaa-specific model table |
| v1.2 | Added real code references and Vision Keeper checks |
| v1.3 | Added Docker tasks |
| v2.0 | Rewrite — honest framing (you select, not Claude), tighter guidance |
| v2.1 | Added specific model IDs, Haiku tier, /model command, fixed stale file path |

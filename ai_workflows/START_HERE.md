# START_HERE.md — New Session Orientation

> Read this first. It's short. Then go to the right file for your task.

---

## What is this project?

UjamaaDAO is a neighborhood sovereignty platform for Kenyan wards. Think: cooperative governance, community project funding, marketplace for skills and goods — rooted in Ujamaa philosophy (cooperative economics, familyhood).

Real outcomes matter. A feature is worth building if it helps a ward drill a borehole faster.

---

## The five rules you must not break

1. Marketplace = discovery and matching only. No payments, no escrow.
2. Real money flows via M-Pesa to platform accounts. Never P2P in-app.
3. Blockchain is hybrid. On-chain: PR/UT tokens, governance, treasury. Off-chain: everything UX.
4. PR is non-transferable. UT earned in-app has no cash-out path.
5. Everything runs in Docker. Use service names, not localhost.

Full rules are in CLAUDE.md section 2.

---

## Where is the project right now?

Backend architecture is in place: Express API + BullMQ worker, per-module Prisma schemas merged (77 models), Docker Compose fully configured. Infrastructure pre-flight is done — the system has not yet run end-to-end but is ready for first launch.

No tests exist anywhere. Twelve modules are at `partial` status (code written, untested). Five are scaffolded only.

Marketplace, governance, education, emergency response, M-Pesa, and blockchain are all designed but not built.

Frontend doesn't exist yet.

Full picture in CLAUDE.md section 3.

Full picture in CLAUDE.md section 3.

---

## Which file do I need?

| What you're doing | Go to |
|---|---|
| General project context, tech stack, conventions | CLAUDE.md |
| Understanding who does what in a session | AGENTS.md |
| Running a full task from start to finish | ORCHESTRATION.md |
| Copy-paste prompt starters | PROMPT_TEMPLATES.md |
| Something is broken right now | EMERGENCY_PROTOCOLS.md |
| Deciding which model to use | MODEL_STRATEGY.md |
| Why a decision was made a certain way | DECISIONS.md |
| What happened in past sessions | PROGRESS_LOG.md |

---

## Starting a session

Copy this and adapt it:

```
Load full UjamaaDAO context from CLAUDE.md, AGENTS.md, ORCHESTRATION.md, and PROGRESS_LOG.md.

Mode: [Planning / Coding / Review / Emergency / Documentation / DevOps]
Tier: [Quick / Standard / Major]
Task: [your specific task]

Run Vision Keeper check first if this involves rewards, tokens, incentives, or marketplace.
Output in markdown with full file paths in code blocks.
```

---

## The most important habits

- **Vision Keeper runs first** for any incentive/reward/marketplace task
- **Architect plans before Developer codes** for anything Standard or Major
- **PROGRESS_LOG.md gets updated** at the end of every session that changes code
- **`make dev` must work** after any Docker or infrastructure change
- **Module readiness checklist** (CLAUDE.md section 6) defines "done"

---

That's it. Pick your file and get to work.

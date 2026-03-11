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

## Where is the project right now? (Updated 2026-03-10)

**Read `SESSION_STATE.md` for the live snapshot** — it always has the current state, known bugs, and next task.

Quick summary:
- **Backend**: running ✅ — Express API + BullMQ worker, 80 Prisma models, 13 routes mounted
- **Tests**: 269/269 green — auth (104), user (35), economy (34), community (49), governance (47). All other modules: zero tests.
- **Modules tested**: auth, user, economy, community, governance. **Partial** (code, no tests): integration, projects, marketplace, notifications, onboarding, emergency, audit, admin. **Scaffold**: reputation, education, treasury, verification.
- **Frontend**: partial — landing, 4-step registration, sign-in, auth callback, dashboard, profile, groups detail, proposals. Build green (15+ routes). E2E auth flow verified.
- **Blockchain**: PrToken.sol + UtToken.sol written, 13 Foundry tests green. Base Sepolia deploy pending (minter wallet not yet funded).
- **M-Pesa**: not started.
- **Next priorities**: community module gaps (memberCount fix, discovery endpoint, admin routes) → Base Sepolia deploy.

Full picture in CLAUDE.md section 3.

---

## Which file do I need?

| What you're doing | Go to |
|---|---|
| **Live project state, current bugs, next task** | **SESSION_STATE.md ← start here** |
| General project context, tech stack, conventions | CLAUDE.md |
| Understanding who does what in a session | AGENTS.md |
| Running a full task from start to finish | ORCHESTRATION.md |
| Copy-paste prompt starters | PROMPT_TEMPLATES.md |
| Something is broken right now | EMERGENCY_PROTOCOLS.md |
| Deciding which model to use | MODEL_STRATEGY.md |
| Why a decision was made a certain way | DECISIONS.md |
| What happened in past sessions | PROGRESS_LOG.md |
| Full system design and architecture | docs/architecture.md |
| API reference (auth, user, community, governance, economy) | docs/auth-api.md · docs/user-api.md · docs/group-api.md · docs/proposal-api.md · docs/economy-api.md |
| PR/UT/IP token mechanics and earning rules | docs/economy-design.md |
| Treasury structure, M-Pesa flows, UT cash-out | docs/treasury.md |
| Feature inventory by module (status table) | docs/features.md |
| Full project whitepaper | docs/whitepaper.md |
| Ecosystem overview + improvement roadmap | docs/ecosystem.md |
| Payment UX principles + screen mockups | docs/frontend-payment-ux.md |

---

## Starting a session

Copy this and adapt it:

```
Load UjamaaDAO context: SESSION_STATE.md (current state), CLAUDE.md (project brain),
and the last 2 entries of PROGRESS_LOG.md (recent history).

Mode: [Planning / Coding / Review / Emergency / Documentation / DevOps]
Tier: [Quick / Standard / Major]
Task: [your specific task]

Run Vision Keeper check first if this involves rewards, tokens, incentives, or marketplace.
Output in markdown with full file paths in code blocks.
```

---

## The most important habits

- **Read SESSION_STATE.md first** — it has the live snapshot and known open issues
- **Vision Keeper runs first** for any incentive/reward/marketplace task
- **Architect plans before Developer codes** for anything Standard or Major
- **SESSION_STATE.md + PROGRESS_LOG.md get updated** at the end of every session that changes code
- **`make dev` must work** after any Docker or infrastructure change
- **MailHog auto-starts with `make dev`** — web UI at `http://localhost:8025`, no manual start needed
- **Module readiness checklist** (CLAUDE.md section 6) defines "done"

---

That's it. Pick your file and get to work.

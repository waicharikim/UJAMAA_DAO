# Contributing to UjamaaDAO

Thank you for contributing. This document covers the conventions, workflow, and tools you need to contribute effectively.

---

## Getting Started

1. **Fork and clone**
```bash
git clone https://github.com/your-username/ujamaadao.git
cd ujamaadao
```

2. **Start the full stack**
```bash
cd backend
make dev          # starts all 8 services (web, worker, postgres, postgres_test, redis, frontend, mailhog, anvil)
make db-migrate   # run migrations inside the web container
```

3. **Verify it's running**
```
http://localhost:4000/health   → { "success": true, "status": "ok" }
http://localhost:4000/ready    → { "success": true, "status": "ready" }
http://localhost:3000          → frontend
http://localhost:8025          → MailHog (dev email catcher)
```

> Everything runs in Docker — no bare-metal Node.js, no local Postgres. Use service names (`postgres`, `redis`, `web`) not `localhost` in Docker env vars. (ADR-005)

---

## Branching & Workflow

- `main` — stable, production-ready code only.
- `develop` — integration branch. All feature branches come from here.
- `feature/`, `fix/`, `chore/` — branch naming prefix.
- Open PRs against `develop`. PRs to `main` = production releases.
- Keep PRs small and focused.

---

## Coding Guidelines

- TypeScript strict mode everywhere — no `any` without justification.
- Prisma for all DB access — no raw SQL.
- `ApiError` for all HTTP errors — no `res.status(500).json(...)` directly.
- BullMQ for all async/scheduled work — no `setInterval` for recurring jobs.
- Event bus for cross-module communication — no direct imports between modules (with one ADR-021 exception).
- Centralized logger — no `console.log`.

**Run linting before pushing** (CI will catch it):
```bash
cd backend
npm run lint        # check
npm run lint:fix    # auto-fix prettier issues
npx tsc --noEmit    # TypeScript check
```

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add wallet-signature login endpoint
fix(community): fix memberCount not updating on join/leave
docs(group): rewrite group-api.md to match current routes
test(economy): add unit tests for dues opt-in validator
chore(deps): update pino to v8
```

---

## Testing

**Run the test suite:**
```bash
cd backend
npx vitest run
```

> Run from `backend/` — not root. Tests require `fileParallelism: false` (already set in `vitest.config.ts`) because they share a test DB (`ujamaa_postgres_test` on port 5433).

**Current status:** 269 tests green — 104 auth · 35 user · 34 economy · 49 community · 47 governance.

- Write tests for any new feature or bug fix.
- New service-level tests go in `backend/tests/<module>/`.
- Test helpers (seed data, token helpers) are in `backend/tests/<module>/helpers.ts` — reuse these.
- Tests are deterministic and isolated — use `beforeEach` cleanup hooks, never share state between tests.

---

## Adding a New Module

1. Create `backend/src/modules/<name>/` with: `services/`, `controllers/`, `routes/`, `handlers/`, `validators/`, `prisma/schema.prisma`.
2. Add the route to `backend/src/app.ts`.
3. Register any new jobs in `backend/src/core/jobs/register.ts`.
4. Add any new events to the event bus types file.
5. Run `npm run db:merge` from `backend/` to regenerate `prisma/schema.prisma` from per-module schemas.
6. Update `docs/features.md` module status table.
7. Update `ai_workflows/CLAUDE.md` module status table.

---

## Documentation

- Update the relevant `docs/*.md` file for any new or changed API endpoint.
- Update `docs/features.md` module status after any module status change.
- Update `ai_workflows/CLAUDE.md` section 3 at the end of every session that changes module status.
- Log the session in `ai_workflows/PROGRESS_LOG.md`.
- New significant architectural decisions go in `ai_workflows/DECISIONS.md` as an ADR.

---

## Reporting Issues

Use [GitHub Issues](https://github.com/anthropics/claude-code/issues). Include:
- What you expected vs. what happened.
- Reproduction steps.
- Relevant logs (`make logs` or `make logs-worker`).

---

## Communication

Use the project's communication channels (Discord/Slack/email). Ask before making large structural changes — `ai_workflows/CLAUDE.md` is the project brain, read it first.

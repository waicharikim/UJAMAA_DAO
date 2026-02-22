# EMERGENCY_PROTOCOLS.md — When Things Break

> Emergencies mean act fast, but act correctly.
> This file gives you the exact sequence for each failure type.
> Every emergency ends with CLAUDE.md and PROGRESS_LOG.md updated.

---

## Emergency Triage (start here)

Before reaching for any protocol, answer these three questions:

1. **Is this affecting live users right now?** → Yes = Critical. Move immediately.
2. **Is this blocking development?** → Yes = High. Fix before next task.
3. **Is this a known issue with a known fix?** → Check CLAUDE.md section 7 first.

Then pick the protocol below that matches your situation.

---

## Protocol 1 — Job Failure / Queue Stall

**Symptoms:**
- Jobs in `economyQueue` or `userCleanupQueue` failing repeatedly
- Dead-letter queue accumulating
- Worker process crashed
- `failedJobHandler` alert triggered in `workers.ts`

**Immediate (stop the bleeding):**
```bash
make logs-worker          # see what's actually failing
# Open Bull Board at /admin/queues — inspect dead-letter queue
make restart              # if worker is completely down
```

**Diagnose:**
```
Wear the Developer hat in debug mode.

Error from logs: [paste full error]
Failing job: [job name, e.g. MONTHLY_PR_REGENERATION_JOB]
Relevant files: backend/src/workers.ts, backend/src/core/jobs/register.ts, backend/src/core/utils/eventBus.ts

What's the root cause? What's the minimal fix? How do I prevent recurrence?
```

**Permanent fixes to consider:**
- Add retry logic with backoff in the job processor
- Improve `failedJobHandler` logging (add job name, payload, error stack)
- Add `sendJobFailureAlert` to email/Slack webhook (currently placeholder in `workers.ts`)
- Add worker healthcheck to `docker/docker-compose.yml`

**Close out:**
- Add issue + fix to CLAUDE.md section 7
- Update PROGRESS_LOG.md

---

## Protocol 2 — Auth / Verification Failure

**Symptoms:**
- Magic link or OTP verification failing
- Session creation errors
- Users stuck in `OnboardingProgress`
- Token validation errors in `auth.service.ts`

**Immediate:**
```bash
make logs-web             # find the ApiError or JWT error
# If a specific user is stuck:
# Manually set verification level via psql: make db-shell
```

**Diagnose:**
```
Wear the Developer hat in debug mode.

Error from logs: [paste full error from make logs-web]
Failing operation: [magic link / OTP / wallet signature / session]
Relevant files: backend/src/modules/auth/services/auth.service.ts, backend/src/index.ts

What's the root cause? Step-by-step fix with file paths.
```

**Permanent fixes to consider:**
- Improve `detectBruteForce` logic in `auth.service.ts`
- Tighten token expiry handling
- Add fallback login path (phone OTP if email link fails)
- Add admin endpoint to manually re-send verification

**Close out:**
- Add to CLAUDE.md section 7
- Update PROGRESS_LOG.md

---

## Protocol 3 — Docker / Container Issue

**Symptoms:**
- Container won't start or keeps crashing
- Volume corruption (pgdata, redis_data)
- Service name resolution failing (can't reach `postgres` or `redis`)
- Traefik routing broken

**Immediate:**
```bash
docker compose ps                  # what's actually running
make logs-web                      # or make logs-worker
make restart                       # try a clean restart
make dev --build                   # if image is stale
docker compose down -v && make dev # nuclear option (loses local data)
```

**Diagnose:**
```
Wear the DevOps hat.

Container failing: [web / worker / postgres / redis]
Error from logs: [paste output of docker compose ps and relevant logs]
Relevant files: docker/docker-compose.yml, backend/src/index.ts (graceful shutdown)

What's wrong? What's the fix? What healthcheck or depends_on change prevents this?
```

**Permanent fixes:**
- Add `depends_on` with `condition: service_healthy` for all dependent services
- Add `healthcheck` block to any service missing one
- Add readiness probe in `backend/src/index.ts` (wait for Prisma + Redis before accepting traffic)
- Backup `pgdata` volume regularly

**Close out:**
- Add to CLAUDE.md section 7
- Update PROGRESS_LOG.md

---

## Protocol 4 — Incentive Misalignment Detected

**Symptoms:**
- Users gaming low-effort actions for tokens (fake vouches, self-vouching loops)
- UT cash-out exploit discovered
- Inactive users accumulating PR voting power
- Spam or scam listings in marketplace

**Immediate — stop the damage:**
1. Freeze reward issuance: temporarily comment out the relevant `eventBus.publish()` call
2. If marketplace: add a temporary `active: false` flag to affected listing type
3. Document exactly what you found — screenshots, log evidence, user IDs if available

**Diagnose with Vision Keeper:**
```
Wear the Vision Keeper hat. This is an emergency alignment review.

Detected abuse: [describe what's happening]
Mechanism being gamed: [which reward/action/event]
Evidence: [log lines, user counts, what you observed]

Output:
1. Root cause — where did the mechanism fail the "real value" test?
2. Immediate cap or gate to add
3. Long-term fix to the mechanism design
4. Prevention — what check would have caught this before shipping?
```

**Permanent fixes:**
- Mandatory phone verification before vouching or reward eligibility
- Rate limits on high-abuse endpoints (daily vouch limit, listing frequency cap)
- Device/IP fingerprinting for sybil resistance
- Add abuse case to Vision Keeper template for future checks

**Close out:**
- Add to CLAUDE.md section 7 and non-negotiable rules if needed
- Update PROGRESS_LOG.md
- Run Vision Keeper check on similar mechanisms that might have the same flaw

---

## Protocol 5 — Data / Database Issue

**Symptoms:**
- Prisma migration fails
- Data inconsistency between tables
- Query timeout or deadlock
- `pgdata` volume issue

**Immediate:**
```bash
make db-shell             # get into postgres directly
# Check what migrations have run:
# SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;
make logs-web             # find the Prisma error
```

**Diagnose:**
```
Wear the Developer hat in debug mode.

Error: [paste full Prisma error]
Migration that failed: [name]
Relevant schema: [paste the Prisma model or migration that's failing]

Root cause? Safe fix that doesn't lose data? How to verify?
```

**Permanent fixes:**
- Always test migrations on `postgres_test` service before applying to main
- Never edit migration files after they've run — create a new migration
- Add migration step to `make dev` startup sequence

---

## Emergency Prompt (generic — adapt for any incident)

```
EMERGENCY MODE. Skip planning. Act fast.

Wear the Developer hat in debug mode.

System: [web server / worker / auth / queue / docker / database]
Impact: [users can't X / development blocked / data at risk]
Error: [paste full error output]
Already tried: [list what you've attempted]
Relevant files: [list the specific files most likely involved]

Output:
1. Root cause (hypothesis with evidence)
2. Immediate fix (step by step, with file changes)
3. How to verify fix works
4. Prevention for future
5. PROGRESS_LOG.md entry for this incident
```

---

## After Every Emergency

Before declaring it resolved:

- [ ] Root cause documented
- [ ] Fix applied and verified (`make dev` works, `make logs` clean)
- [ ] Added to CLAUDE.md section 7 (Common Issues & Solutions)
- [ ] PROGRESS_LOG.md updated with: date, incident, fix, time to resolve
- [ ] If incentive-related: Vision Keeper re-run on similar mechanisms
- [ ] If job-related: `failedJobHandler` updated if needed
- [ ] If Docker-related: `docker/docker-compose.yml` updated with any new healthchecks

---

## Version History

| Version | Change |
|---|---|
| v1.0 | Initial creation |
| v1.1 | Added incentive misalignment and job failure protocols |
| v1.2 | Added real file references |
| v1.3 | Added Docker-specific recovery |
| v2.0 | Full rewrite — cleaner protocol structure, generic emergency prompt, post-incident checklist |
| v2.1 | Fixed all file paths (backend/ prefix, workers.ts, docker/ prefix) |

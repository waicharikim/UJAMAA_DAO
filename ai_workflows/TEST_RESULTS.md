# TEST_RESULTS.md — Test Run Log

> One entry per test run that warrants review. Latest at the top.
> Format: date, trigger (what changed), result, and any observations.

---

## Run: 2026-03-01 — Session 18 (role bug fixes)

**Trigger:** Fixed 4 bugs in the RBAC layer before community module work.

**Result: 173/173 passed — 0 failures, 0 regressions**

| Suite | File | Tests | Status | Duration |
|---|---|---|---|---|
| Economy | `economy.routes.test.ts` | 16 | ✅ all pass | 35.7s |
| Economy | `participationRights.service.test.ts` | 18 | ✅ all pass | — |
| Auth | `auth.service.test.ts` | 2 | ✅ all pass | 4.4s |
| Auth | `auth.verify.test.ts` | 9 | ✅ all pass | 14.9s |
| Auth | `auth.routes.test.ts` | 34 | ✅ all pass | — |
| Auth | `session.service.test.ts` | 8 | ✅ all pass | 14.1s |
| Auth | `token.service.test.ts` | 7 | ✅ all pass | 12.6s |
| Auth | `refresh-token.service.test.ts` | 6 | ✅ all pass | 10.8s |
| Auth | `phone-verification.test.ts` | 7 | ✅ all pass | 12.7s |
| Auth | `totp-2fa.service.test.ts` | 9 | ✅ all pass | 16.9s |
| Auth | `password-reset.service.test.ts` | 7 | ✅ all pass | 14.2s |
| Auth | `security-events.service.test.ts` | 6 | ✅ all pass | 11.4s |
| Auth | `wallet.service.test.ts` | 9 | ✅ all pass | 17.0s |
| User | `user.routes.test.ts` | 35 | ✅ all pass | — |

**Total:** 14 test files · 173 tests · 325s wall time
**TypeScript:** `npx tsc --noEmit` → 0 errors (verified before run)

---

### What changed (fixes applied this session)

**1. `core/rbac/roles.ts` — SystemRoles values corrected**
- Before: `SUPER_ADMIN: 'super_admin'` (wrong — DB stores `'system:super_admin'`)
- After: all 12 SystemRoles now match actual seeded role names (`system:*`, `location:*`, `group:*`, `project:*`)
- Removed 3 keys that don't exist in the DB: `COMPLIANCE_OFFICER`, `GENERAL_USER`, `GOVERNOR_ADMIN`
- `GroupRoles` unchanged — correctly reflects Prisma `GroupRole` enum on `GroupMember.role`

**2. `core/rbac/authorize.ts` — isSuperAdmin and convenience functions fixed**
- `isSuperAdmin`: `includes('SUPER_ADMIN')` → `includes(SystemRoles.SUPER_ADMIN)`
  - Effect: super-admin bypass was completely broken; any route using `skipAdmin: true` would never bypass for a real super admin
- `requireSuperAdmin()`: `requireSystemRole('SUPER_ADMIN')` → `requireSystemRole(SystemRoles.SUPER_ADMIN)`
- `requireAdmin()`: `requireSystemRole('ADMIN')` → `requireSystemRole(SystemRoles.SUPER_ADMIN)`
  - `'ADMIN'` doesn't exist in the roles table; `requireAdmin` is used in `admin.routes.ts` and `auth.routes.ts` (admin endpoints)
- Added import: `import { SystemRoles } from './roles.js'`

**3. `core/middleware/authorize.ts` — skipAdmin bypass fixed**
- Line 102: `user.roles.includes('SUPER_ADMIN')` → `user.roles.includes(SystemRoles.SUPER_ADMIN)`
- Same root cause as #2. The `authorize()` middleware `skipAdmin` option would never work for super admins.
- Added import: `import { SystemRoles } from '../rbac/roles.js'`

**4. `core/services/role.service.ts` — isVerifier Prisma query fixed**
- `where.group = { locationScope: 'WARD', locationScopeId: wardId }` → `where.group = { locationScope: 'WARD', wardId }`
- `locationScopeId` does not exist on the `Group` model; `wardId` is the actual field
- Effect: `isVerifier(userId, wardId)` would always return `false` for ward-scoped verifier checks (Prisma would throw or silently ignore the unknown field)

---

### Observations

- **No existing tests cover the RBAC layer directly.** The 173 tests exercise auth/user/economy routes, all of which use `authenticate` middleware but none use `skipAdmin: true` or assign the `system:super_admin` role to test users. The bugs existed silently. Tests for the RBAC layer are the next gap to fill.
- **`requireWardLeader(wardId)` still has a conceptual mismatch** (not fixed — scope of this session): it calls `requireGroupRole('LEADER', 'ward:${wardId}')` which checks `req.user.roles` for `'ward:uuid:LEADER'` — a format that is never assigned anywhere. Ward-level admin checks should use `SystemRoles.WARD_ADMIN` (`'location:ward_admin'`). Flag for when admin role-assignment endpoints are built.
- **`BullMQ` eviction policy warning** appears in test stderr (`IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"`). Pre-existing, not introduced by this session. Low urgency — dev Redis only.

---

### Next steps (from SESSION_STATE.md priority order)

1. **RBAC unit tests** — test `role.service.ts`, `authorize.ts` (rbac), `authorize.ts` (middleware) directly
2. **Community module tests** — community is the next module to move `partial` → `tested`
3. **Admin role-assignment endpoints** — assign/revoke system roles on users, promote group members

---

---

## 2026-03-03 — Session 23 smoke test

### Docker services
| Service | Status |
|---|---|
| ujamaa_web | ✅ Up |
| ujamaa_worker | ✅ Up |
| ujamaa_frontend | ✅ Up (Turbopack) |
| ujamaa_postgres | ✅ Up (healthy) |
| ujamaa_postgres_test | ✅ Up (healthy) |
| ujamaa_redis | ✅ Up (healthy) |
| ujamaa_mailhog | ✅ Up |

### API health
- `GET /health` → `{ success: true, status: "ok", version: "2.5" }` ✅
- `GET /ready` → `{ success: true, status: "ready", database: "connected" }` ✅
- `GET /api/v1/docs` → includes `community`, `governance`, `integration` endpoints ✅

### Frontend
- `GET http://localhost:3000` → HTTP 200 ✅
- Turbopack active — `next dev --turbopack`, ready in ~2s, first compile ~95s (cold cache, expected)

### Test suite
```
Test Files  17 passed (17)
Tests       222 passed (222)
Duration    402s
```
✅ All 222 tests green (104 auth · 35 user · 34 economy · 49 community)

# base.prisma — Documentation

> **Important:** Do not edit `backend/prisma/schema.prisma` directly. It is generated.
> See [ADR-014](../../../../../ai_workflows/DECISIONS.md) for the rationale.

---

## Overview

UjamaaDAO uses a **per-module Prisma schema merge** pattern. Each module owns its own `schema.prisma` file. A merge script combines them into a single file that Prisma CLI uses.

```
backend/src/modules/<name>/prisma/schema.prisma  ← edit here
                                    ↓
backend/src/core/database/mergeSchema.ts          ← merge script
                                    ↓
backend/prisma/schema.prisma                      ← generated (do not edit)
```

---

## base.prisma — What It Contains

`backend/src/core/database/base.prisma` is the **backbone schema** — the smallest possible shared foundation that all other module schemas can reference.

It contains:

### Generator + Datasource
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Shared Enums (4)
- `LocationScope` — `LOCAL | CONSTITUENCY | COUNTY | NATIONAL`
- `GroupStatus` — `FORMING | ACTIVE | SUSPENDED | INACTIVE | DISSOLVED | MERGED`
- `GroupRole` — `MEMBER | LEADER | TREASURER | AUDITOR | FACILITATOR | MENTOR`
- `HolderType` — `USER | GROUP`

### Geographic Models (3)
- `County` — Kenyan county (47 total)
- `Constituency` — Belongs to County
- `Ward` — Belongs to Constituency and County

### Industry + Goods/Services Models (2)
- `Industry` — Sector/industry classification
- `GoodsService` — Products or services within an industry

### User Model (1)
The `User` model lives in base because every module references it. It contains:
- Identity fields: `walletAddress`, `email`, `name`, `phoneNumber`
- Location fields: `primaryWardId`, `secondaryWardId`, `currentLocationId`
- Status fields: `verificationLevel`, `membershipStatus`, `isActive`
- Economy fields: `globalImpactPoints`, `utilityTokens`, `participationRights`
- **All back-relations** to module models (listed by module):
  - auth: sessions, accounts, recoveryRequests, loginEvents, emailTokens
  - user: industries, goodsServices, privacySettings, accessibility, residenceChangeRequests
  - economy: impactLogs, locationImpacts, prLogs, duesPayments
  - community: groupMemberships, votes, workLogs, workVerifications
  - governance: createdProposals
  - projects: projectMemberships, ownedProjects, assignedTasks, escrows, escrowReleases
  - treasury: treasuryAudits, walletTransactionsInitiated, walletTransactionsProcessed
  - marketplace: marketplaceListings, marketplacePurchases, marketplaceSales, marketplaceReviews
  - notifications: notifications, notificationPreferences
  - education: createdModules, educationalProgress, educationalReviews
  - emergency: reportedEmergencies, emergencyResponses, conflictsAsComplainant, conflictsAsRespondent
  - system: audits, consents, feedback, comments, organizedEvents, eventAttendances, engagementMetrics

### RBAC Models (3)
- `Role` — System role (admin, member, etc.), with optional election metadata
- `UserRole` — Junction: user ↔ role (with scope, expiry, term)
- `RolePermission` — Fine-grained permission strings per role

### System Configuration (1)
- `SystemConfiguration` — Key/value store for platform-wide settings (governance params, economy thresholds, etc.)

---

## Per-Module Schema Locations

| Module | Schema Path |
|--------|------------|
| auth | `backend/src/modules/auth/prisma/schema.prisma` |
| user | `backend/src/modules/user/prisma/schema.prisma` |
| economy | `backend/src/modules/economy/prisma/schema.prisma` |
| community | `backend/src/modules/community/prisma/schema.prisma` |
| governance | `backend/src/modules/governance/prisma/schema.prisma` |
| projects | `backend/src/modules/projects/prisma/schema.prisma` |
| treasury | `backend/src/modules/treasury/prisma/schema.prisma` |
| marketplace | `backend/src/modules/marketplace/prisma/schema.prisma` |
| education | `backend/src/modules/education/prisma/schema.prisma` |
| emergency | `backend/src/modules/emergency/prisma/schema.prisma` |
| notifications | `backend/src/modules/notifications/prisma/schema.prisma` |

---

## Schema Merge Workflow

### After any schema change:

```bash
# From backend/ directory:

# 1. Merge all module schemas into prisma/schema.prisma
npm run db:merge

# 2. Validate the merged schema
npx prisma validate

# 3. Create and apply a migration (dev only)
npx prisma migrate dev --name <describe_change>

# 4. In production, deploy existing migrations only
npx prisma migrate deploy
```

### Merge script internals

`backend/src/core/database/mergeSchema.ts`:
- Reads `base.prisma` first (generator + datasource must come first)
- Reads each module's `schema.prisma` in `MODULE_ORDER` sequence
- Checks for duplicate model names (fails loudly)
- Writes the merged result to `backend/prisma/schema.prisma`
- Logs a summary: X models, Y duplicates

### Current state (as of 2026-02-21)
- **77 models** merged successfully
- **0 duplicate model names**
- `npx prisma validate` passes with 1 non-blocking warning (SetNull on optional field)
- Old migrations cleared — fresh `schema_alignment` migration pending first `make dev`

---

## Rules

1. **Never edit `backend/prisma/schema.prisma` directly.** It is regenerated on every `npm run db:merge`.
2. **Add new models to the relevant module's schema**, not to base.prisma.
3. **Add to base.prisma only** if a model or enum is referenced by 3+ other modules.
4. **Maintain `MODULE_ORDER`** in `mergeSchema.ts` — modules that reference other modules' models must come after those modules.
5. **Always run `npm run db:merge && npx prisma validate`** after any schema change.

---

*Last updated: 2026-02-21 — Schema alignment complete (Phase 1–3). See PROGRESS_LOG.md for details.*

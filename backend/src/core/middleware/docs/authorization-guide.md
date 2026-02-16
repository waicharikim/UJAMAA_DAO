# UjamaaDAO Authorization Guide - Corrected Sections

## Layer 3: Role-Based Access Control (rbac/authorize.ts)

**Purpose:** Fast in-memory role checks (~0.1ms)

### Important: Check Functions vs Middleware

Layer 3 provides **check functions** that throw `ApiError` on failure. These must be wrapped with `toMiddleware()` to use as Express middleware:

```typescript
import { requireAdmin, requireWardLeader, toMiddleware } from './rbac/authorize';

// ✅ CORRECT - Wrapped with toMiddleware()
router.post('/admin/reports',
  authenticate,
  toMiddleware(requireAdmin()),
  reportsHandler
);

// ❌ WRONG - Direct usage will cause runtime errors
router.post('/admin/reports',
  authenticate,
  requireAdmin(),  // This throws, not returns middleware!
  reportsHandler
);
```

### Available Check Functions

All return `(req: AuthRequest) => void` - they throw on failure:

```typescript
requireSuperAdmin()           // Super admin (bypasses all checks)
requireAdmin()                // Platform admin
requireWardLeader(wardId)     // Ward-specific leader
requireTreasurer(scope)       // Treasurer in scope
requireVerifier(scope?)       // Global or scoped verifier
requireModerator(scope)       // Moderator in scope
requireOwnershipOrAdmin(resourceUserId, adminRole?) // Owner OR admin
```

### Utility Functions (for handlers)

These return boolean values, don't throw:

```typescript
hasAnyRole(req, ['ADMIN', 'MODERATOR'])  // Has any of these roles?
hasAllRoles(req, ['VERIFIER', 'ADMIN'])  // Has all of these roles?
userHasRole(req, 'ADMIN', scope?)        // Has specific role?
isOwner(req, resourceOwnerId)            // Owns this resource?
getEffectiveRoles(req)                   // Get user's roles array
```

---

## Usage Examples (Corrected)

### Example 1: Simple Admin-Only Endpoint

```typescript
router.get('/admin/reports',
  authenticate,
  toMiddleware(requireAdmin()),  // ✅ Wrapped
  reportsHandler
);
```

### Example 2: Community Action with Token Requirement

```typescript
router.post('/proposal',
  authenticate,
  authorize({
    verificationLevel: 'COMMUNITY_VERIFIED',
    minParticipationRights: 50,
  }),
  createProposalHandler
);
```

### Example 3: Ward-Specific Action (Dynamic Parameters)

**Problem:** `req.params.wardId` doesn't exist at route definition time.

**Solution A:** Check in handler
```typescript
router.post('/ward/:wardId/event',
  authenticate,
  authorize({
    verificationLevel: 'LOCATION_VERIFIED',
  }),
  async (req: AuthRequest, res: Response) => {
    // Check ward leadership in handler
    const check = requireWardLeader(req.params.wardId);
    check(req); // Throws if not leader
    
    // Process event creation...
  }
);
```

**Solution B:** Custom middleware wrapper
```typescript
const requireWardLeaderParam = (paramName: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const wardId = req.params[paramName];
    try {
      const check = requireWardLeader(wardId);
      check(req);
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        const apiError = ApiError.systemError('Authorization failed');
        res.status(500).json(apiError.toJSON());
      }
    }
  };
};

router.post('/ward/:wardId/event',
  authenticate,
  authorize({ verificationLevel: 'LOCATION_VERIFIED' }),
  requireWardLeaderParam('wardId'),
  createEventHandler
);
```

### Example 4: Complex Ownership Check

```typescript
router.put('/project/:projectId',
  authenticate,
  authorize({
    minParticipationRights: 10,
    // Database-backed check (async, ~5-50ms)
    resourceOwnerCheck: anyOf([
      isProjectOwner(),      // Check project ownership
      hasGroupRole('ADMIN'), // OR group admin
      isVerifier()           // OR verifier
    ])
  }),
  updateProjectHandler
);
```

**Note:** `resourceOwnerCheck` runs **async database queries** inside `authorize()`, making this slower (~5-50ms instead of ~1ms).

### Example 5: Handler-Level Permission Logic

```typescript
async function voteHandler(req: AuthRequest, res: Response) {
  const proposalId = req.params.proposalId;
  const userId = req.user!.userId;

  // Get proposal details
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { wardId: true, status: true }
  });

  // Business logic check
  if (proposal.status !== 'ACTIVE') {
    throw ApiError.badRequest('Proposal not active');
  }

  // Permission check using roleService (Layer 4)
  const canVote = await roleService.hasLocationRole(
    userId,
    proposal.wardId,
    'MEMBER'
  );

  if (!canVote) {
    throw ApiError.insufficientPermissions('Cannot vote in this ward');
  }

  // Process vote...
}
```

### Example 6: Combining All Layers (Fixed)

```typescript
// Use static scope for treasurer check
router.post('/budget/approve',
  // Layer 1: Authenticate
  authenticate,
  
  // Layer 2: Platform requirements
  authorize({
    verificationLevel: 'FULL_VERIFIED',
    minParticipationRights: 500,
    requiresWalletAuth: true,
  }),
  
  // Layer 3: Role requirement (wrapped)
  toMiddleware(requireTreasurer('ward:finance')),
  
  // Handler (Layer 4: complex logic)
  async (req: AuthRequest, res: Response) => {
    const wardId = req.body.wardId;
    
    // Verify geographic match
    if (req.geographicContext?.primaryWardId !== wardId) {
      throw ApiError.geographicError('Cannot approve budget for different ward');
    }
    
    // Additional business logic
    const budget = await getBudget(wardId);
    if (budget.status !== 'PENDING') {
      throw ApiError.badRequest('Budget not pending approval');
    }
    
    // Process approval...
  }
);
```

---

## Performance Guidelines (Corrected)

### Middleware Layer Performance

**Fastest → Slowest**

```
├─ authenticate (JWT verify)              ~1ms
├─ rbac/authorize (array check)           ~0.1ms
├─ middleware/authorize (simple checks)   ~1ms
├─ middleware/authorize (with async)      ~5-50ms  ← NEW
└─ role.service (database + cache)        ~5-50ms
```

**Key Point:** `authorize()` has **two performance profiles**:

1. **Simple checks (~1ms):** verification level, token amounts, wallet auth
2. **With async checks (~5-50ms):** `resourceOwnerCheck`, `scopeCheck` with database queries

### When to Use Each

**Hot path (every request):** Use layers 1-3
```typescript
authenticate → authorize (simple) → toMiddleware(requireAdmin())
```

**Occasional checks:** Use Layer 2 with async checks
```typescript
authorize({ resourceOwnerCheck: isProjectOwner() })
```

**One-time checks:** Query database directly in handler
```typescript
const canEdit = await roleService.isProjectLeader(userId, projectId);
```

---

## Best Practices (Updated)

### ✅ DO:

**1. Always wrap Layer 3 checks with toMiddleware()**
```typescript
router.post('/action', 
  authenticate, 
  toMiddleware(requireAdmin()),  // ✅ Wrapped
  handler
);
```

**2. Use utility functions in handlers (no wrapper needed)**
```typescript
async function handler(req: AuthRequest, res: Response) {
  if (hasAnyRole(req, ['ADMIN', 'MODERATOR'])) {  // ✅ Direct use
    // Process admin/moderator action
  }
}
```

**3. Handle dynamic parameters correctly**
```typescript
// ✅ In handler
async function handler(req: AuthRequest, res: Response) {
  const check = requireWardLeader(req.params.wardId);
  check(req);
}

// ❌ NOT in route definition
router.post('/ward/:wardId', requireWardLeader(req.params.wardId), handler);
```

**4. Understand performance tradeoffs**
```typescript
// Fast (~1ms) - simple checks only
authorize({
  verificationLevel: 'COMMUNITY_VERIFIED',
  minParticipationRights: 100
})

// Slower (~5-50ms) - includes database queries
authorize({
  verificationLevel: 'COMMUNITY_VERIFIED',
  resourceOwnerCheck: isProjectOwner()  // ← async database check
})
```

### ❌ DON'T:

**1. Don't use Layer 3 checks without toMiddleware()**
```typescript
// ❌ BAD - Runtime error
router.post('/admin', authenticate, requireAdmin(), handler);

// ✅ GOOD
router.post('/admin', authenticate, toMiddleware(requireAdmin()), handler);
```

**2. Don't access req.params at route definition time**
```typescript
// ❌ BAD - req.params.wardId is undefined
router.post('/ward/:wardId', 
  toMiddleware(requireWardLeader(req.params.wardId)), 
  handler
);

// ✅ GOOD - Check in handler
router.post('/ward/:wardId', handler);
async function handler(req: AuthRequest, res: Response) {
  requireWardLeader(req.params.wardId)(req);
  // ...
}
```

---

## Quick Reference (Corrected)

```typescript
// Authentication
import { authenticate } from './middleware/auth.middleware';

// Platform Authorization
import { authorize } from './middleware/authorize';

// Role Checks (must wrap with toMiddleware!)
import {
  requireAdmin,
  requireWardLeader,
  requireOwnershipOrAdmin,
  toMiddleware,  // ← ESSENTIAL!
  hasAnyRole,    // ← Utility (no wrapper needed)
  userHasRole,   // ← Utility (no wrapper needed)
} from './rbac/authorize';

// Dynamic Checks
import { roleService } from './services/role.service';
import {
  isProjectOwner,
  hasGroupRole,
  anyOf,
  allOf
} from './rbac/integration';

// Usage
router.post('/endpoint',
  authenticate,                          // Layer 1
  authorize({...}),                      // Layer 2
  toMiddleware(requireAdmin()),          // Layer 3 ✅ WRAPPED!
  handler                                // Layer 4 (if needed)
);

// In handlers (no wrapper needed)
async function handler(req: AuthRequest, res: Response) {
  if (hasAnyRole(req, ['ADMIN'])) {      // ✅ Direct use
    // Admin logic
  }
}
```

---

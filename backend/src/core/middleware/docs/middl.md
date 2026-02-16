## Layer 2: Platform Authorization (middleware/authorize.ts)

Purpose: Check platform-wide requirements **and resource ownership**

### Simple Usage (Fast)
authorize({
  verificationLevel: 'COMMUNITY_VERIFIED',
  minParticipationRights: 100,
  requiresWalletAuth: true
})

### Advanced Usage (Database-Backed)
authorize({
  minParticipationRights: 100,
  resourceOwnerCheck: isProjectOwner(),  // ← Async database check
  scopeCheck: async (req) => {...}        // ← Custom async validation
})

**Performance Note:** 
- Simple checks: ~1ms (validation only)
- With `resourceOwnerCheck`: ~5-50ms (includes database query + cache)
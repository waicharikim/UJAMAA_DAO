/**
 * @file src/modules/admin/routes/admin.routes.ts
 * @description
 * Admin Routes — Protected management endpoints
 *
 * Security layers:
 * 1. authenticate → must be logged in
 * 2. rate limiting → prevent abuse
 * 3. authorize + RBAC → role & permission check
 *
 * Version: 2.1 — February 2026
 * Added: PR adjustment, user suspension, pending lists, admin security events view
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../core/utils/response.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { toMiddleware, requireAdmin } from '../../../core/rbac/authorize.js';
import { SystemRoles } from '../../../core/rbac/roles.js';
import { buildRateLimiter } from '../../../core/middleware/rateLimiter.js';

// Validators
import {
  communityVerificationReviewSchema,
  pendingVerificationsQuerySchema,
  residenceChangeReviewSchema,
  pendingResidenceChangesQuerySchema,
  prAdjustSchema,
  banUserSchema,
  resolveSecurityEventAdminSchema,
  userIdParamSchema, // for security events view
} from '../validators/admin.validators.js';

// Handlers (expanded)
import {
  reviewCommunityVerification,
  getPendingVerifications,
  reviewResidenceChange,
  getPendingResidenceChanges,
  adjustParticipationRights,
  suspendUser,
  resolveSecurityEvent,
  updateSystemConfig,
  getUserSecurityEventsAdmin, // NEW
  getStats,
  listUsers,
  getSystemConfig,
} from '../handlers/admin.handlers.js';

const router = Router();

// ============================================================================
// GLOBAL ADMIN MIDDLEWARE
// ============================================================================

router.use(authenticate);

router.use(
  authorize({
    allowedRoles: [SystemRoles.SUPER_ADMIN, SystemRoles.COMPLIANCE_OFFICER],
  }),
  toMiddleware(requireAdmin())
);

// Global admin rate limit (60 actions / 15 min per IP)
router.use(
  buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
  })
);

// ============================================================================
// PLATFORM STATS / USER LIST / CONFIG READ
// ============================================================================

router.get('/stats', asyncHandler(getStats));
router.get('/users', asyncHandler(listUsers));
router.get('/config', asyncHandler(getSystemConfig));

// ============================================================================
// COMMUNITY VERIFICATION
// ============================================================================

router.patch(
  '/verification/community/approve',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 15 }),
  validateRequest({
    schema: communityVerificationReviewSchema,
    target: 'body',
  }),
  asyncHandler(reviewCommunityVerification)
);

router.get(
  '/verification/community/pending',
  validateRequest({ schema: pendingVerificationsQuerySchema, target: 'query' }),
  asyncHandler(getPendingVerifications)
);

// ============================================================================
// RESIDENCE CHANGE MANAGEMENT
// ============================================================================

router.post(
  '/residence/approve',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  validateRequest({ schema: residenceChangeReviewSchema, target: 'body' }),
  asyncHandler(reviewResidenceChange)
);

router.get(
  '/residence/pending',
  validateRequest({
    schema: pendingResidenceChangesQuerySchema,
    target: 'query',
  }),
  asyncHandler(getPendingResidenceChanges)
);

// ============================================================================
// PARTICIPATION RIGHTS MANAGEMENT
// ============================================================================

router.post(
  '/pr/adjust',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  validateRequest({ schema: prAdjustSchema, target: 'body' }),
  asyncHandler(adjustParticipationRights)
);

// ============================================================================
// USER SUSPENSION / BAN
// ============================================================================

router.post(
  '/users/:userId/suspend',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),
  validateRequest({ schema: banUserSchema, target: 'body' }),
  asyncHandler(suspendUser)
);

// ============================================================================
// SECURITY & COMPLIANCE
// ============================================================================

router.patch(
  '/security-events/:eventId/resolve',
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
  validateRequest({ schema: resolveSecurityEventAdminSchema, target: 'body' }),
  asyncHandler(resolveSecurityEvent)
);

/**
 * GET /admin/users/:userId/security-events
 * View security events for a specific user (admin view)
 * Roles: COMPLIANCE_OFFICER, SUPER_ADMIN
 */
router.get(
  '/users/:userId/security-events',
  authorize({
    allowedRoles: [SystemRoles.COMPLIANCE_OFFICER, SystemRoles.SUPER_ADMIN],
  }),
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
  validateRequest({ schema: userIdParamSchema, target: 'params' }),
  asyncHandler(getUserSecurityEventsAdmin)
);

// ============================================================================
// SYSTEM CONFIGURATION (SUPER_ADMIN only)
// ============================================================================

router.post(
  '/config/update',
  authorize({ allowedRoles: [SystemRoles.SUPER_ADMIN] }),
  buildRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),
  validateRequest({
    schema: z.object({
      key: z.string().min(1),
      value: z.any(),
    }),
    target: 'body',
  }),
  asyncHandler(updateSystemConfig)
);

export default router;

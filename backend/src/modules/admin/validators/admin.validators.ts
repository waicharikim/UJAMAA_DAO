/**
 * @file src/modules/admin/validators/admin.validators.ts
 * @description
 * Zod validation schemas for admin endpoints
 *
 * All admin requests (body, params, query) should be validated with these schemas.
 *
 * Version: 1.0 — February 2026
 */

import { z } from 'zod';
import { uuidSchema } from '../../auth/validators/auth.validators.js'; // Reuse common UUID
import { SystemRoles } from '../../../core/rbac/roles.js';

// ============================================================================
// REUSABLE ADMIN SCHEMAS
// ============================================================================

const reasonSchema = z
  .string()
  .max(500, 'Reason/feedback too long (max 500 characters)')
  .optional()
  .transform((val) => (val ? val.trim() : undefined));

export const userIdParamSchema = z.object({
  userId: uuidSchema,
});

export const requestIdParamSchema = z.object({
  requestId: uuidSchema,
});

export const eventIdParamSchema = z.object({
  eventId: uuidSchema,
});

// ============================================================================
// COMMUNITY VERIFICATION ADMIN ACTIONS
// ============================================================================

/**
 * PATCH /admin/verification/community/approve
 * Approve, reject, or request more info on a community verification
 */
export const communityVerificationReviewSchema = z.object({
  requestId: uuidSchema,
  approved: z.boolean(),
  reason: reasonSchema,
  // Optional: admin can request more documents/info
  requestMoreInfo: z.boolean().optional(),
  requestedFields: z.array(z.string()).optional(),
});

/**
 * GET /admin/verification/community/pending
 * Query params for filtering pending verifications
 */
export const pendingVerificationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(100).default(20),
  status: z
    .enum(['PENDING', 'VOUCHING', 'PAYMENT_PENDING', 'ADMIN_REVIEW'])
    .optional(),
  wardId: uuidSchema.optional(),
  search: z.string().optional(), // e.g. phone or name partial match
});

// ============================================================================
// RESIDENCE CHANGE ADMIN ACTIONS
// ============================================================================

/**
 * POST /admin/residence/approve
 * Approve or deny residence change request
 */
export const residenceChangeReviewSchema = z.object({
  requestId: uuidSchema,
  approved: z.boolean(),
  reason: reasonSchema,
});

/**
 * GET /admin/residence/pending
 * Query params for filtering pending residence changes
 */
export const pendingResidenceChangesQuerySchema =
  pendingVerificationsQuerySchema.extend({
    // Can reuse most fields, add residence-specific ones if needed
    targetWardId: uuidSchema.optional(),
  });

// ============================================================================
// PARTICIPATION RIGHTS (PR) MANUAL ADJUSTMENT
// ============================================================================

/**
 * POST /admin/pr/adjust
 * Manually add or deduct Participation Rights
 */
export const prAdjustSchema = z.object({
  userId: uuidSchema,
  amount: z.number().int('Amount must be integer'),
  type: z.enum(['ADD', 'DEDUCT'], {
    required_error: 'type is required: must be "ADD" or "DEDUCT"',
    invalid_type_error: 'type must be "ADD" or "DEDUCT"',
  }),
  reason: z.string().min(1, 'Reason required').max(500),
});

// ============================================================================
// USER BAN / SUSPEND
// ============================================================================

/**
 * POST /admin/users/:userId/ban
 * Ban or suspend a user
 */
export const banUserSchema = z.object({
  userId: uuidSchema,
  banned: z.boolean(),
  reason: z.string().min(1, 'Reason required').max(500),
  durationDays: z.number().int().min(1).max(365).optional(), // temp ban
});

// ============================================================================
// SECURITY EVENT RESOLUTION
// ============================================================================

/**
 * PATCH /admin/security-events/:eventId/resolve
 * Resolve a security event
 */
export const resolveSecurityEventAdminSchema = z.object({
  eventId: uuidSchema,
  resolved: z.boolean(),
  resolutionNotes: reasonSchema,
  actionTaken: z.string().optional(),
});

// ============================================================================
// ADMIN ROLE MANAGEMENT (SUPER_ADMIN only)
// ============================================================================

/**
 * POST /admin/users/:userId/roles
 * Grant a system role to a user
 */
const systemRoleValues = Object.values(SystemRoles) as [string, ...string[]];

export const addAdminRoleSchema = z.object({
  role: z.enum(systemRoleValues),
  scope: z.string().optional(),
});

export const revokeRoleParamSchema = z.object({
  userId: uuidSchema,
  role: z.string().min(1),
});

export const listUserRolesQuerySchema = z.object({
  userId: uuidSchema,
});

// ============================================================================
// REPORT GENERATION
// ============================================================================

export const reportQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const reportTypeParamSchema = z.object({
  type: z.enum(['users', 'governance', 'economy']),
});

export default {
  communityVerificationReviewSchema,
  pendingVerificationsQuerySchema,
  residenceChangeReviewSchema,
  pendingResidenceChangesQuerySchema,
  prAdjustSchema,
  banUserSchema,
  resolveSecurityEventAdminSchema,
  addAdminRoleSchema,
  revokeRoleParamSchema,
  listUserRolesQuerySchema,
  reportQuerySchema,
  reportTypeParamSchema,
};

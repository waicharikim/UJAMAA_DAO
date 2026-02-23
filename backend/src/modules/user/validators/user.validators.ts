/**
 * @file src/modules/user/validators/user.validators.ts
 * @description
 * User Module Validation Schemas
 *
 * Exports Zod schemas for request validation
 * Version: 1.0 — January 2026
 */

import { z } from 'zod';

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * Update Profile Schema
 */
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  privacySettings: z
    .object({
      profileVisibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
      showEmail: z.boolean().optional(),
      showPhone: z.boolean().optional(),
      showWallet: z.boolean().optional(),
      showImpactPoints: z.boolean().optional(),
      allowDirectMessages: z.boolean().optional(),
      allowMarketplace: z.boolean().optional(),
      dataProcessingConsent: z.boolean().optional(),
    })
    .optional(),
  accessibility: z
    .object({
      visualImpairment: z.boolean().optional(),
      hearingImpairment: z.boolean().optional(),
      motorImpairment: z.boolean().optional(),
      cognitiveImpairment: z.boolean().optional(),
      preferredLanguage: z.string().length(2).optional(),
      screenReaderEnabled: z.boolean().optional(),
      highContrast: z.boolean().optional(),
      fontSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'XLARGE']).optional(),
    })
    .optional(),
});

/**
 * UUID Param Schema (for route params)
 */
export const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

// ============================================================================
// INDUSTRIES
// ============================================================================

/**
 * Select Industries Schema (max 3)
 */
export const selectIndustriesSchema = z.object({
  industryIds: z
    .array(z.string().uuid())
    .min(1, 'At least one industry required')
    .max(3, 'Maximum 3 industries allowed'),
  primaryIndustryId: z.string().uuid().optional(),
});

// ============================================================================
// GOODS/SERVICES
// ============================================================================

/**
 * Select Goods/Services Schema
 */
export const selectGoodsServicesSchema = z
  .object({
    goodsServiceIds: z
      .array(z.string().uuid())
      .min(1, 'At least one good/service required')
      .max(20, 'Maximum 20 goods/services allowed'),
    canProvide: z.array(z.boolean()),
    canRequest: z.array(z.boolean()),
  })
  .refine(
    (data) =>
      data.goodsServiceIds.length === data.canProvide.length &&
      data.goodsServiceIds.length === data.canRequest.length,
    { message: 'All arrays must have the same length' }
  );

// ============================================================================
// RESIDENCE & LOCATION
// ============================================================================

/**
 * Request Residence Change Schema
 */
export const requestResidenceChangeSchema = z.object({
  newPrimaryWardId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  proofUrl: z.string().url('Must be a valid URL (e.g., image/document link)').optional(),
});

/**
 * Set Temporary Location Schema
 */
export const setTemporaryLocationSchema = z.object({
  wardId: z.string().uuid(),
  until: z.string().datetime(), // ISO 8601 date string
});

// New: Community Verification
export const vouchRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  wardId: z.string().uuid(),
});

export const paymentVerificationSchema = z.object({
  transactionId: z.string().min(10).max(20),
});

export const adminApproveSchema = z.object({
  requestId: z.string().uuid(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

// ============================================================================
// REFERENCE DATA QUERY PARAMS
// ============================================================================

export const constituencyQuerySchema = z.object({
  countyId: z.string().uuid().optional(),
});

export const wardQuerySchema = z.object({
  constituencyId: z.string().uuid().optional(),
  countyId: z.string().uuid().optional(),
});

export const goodsServicesQuerySchema = z.object({
  industryId: z.string().uuid().optional(),
});

export const wardIdParamSchema = z.object({
  wardId: z.string().uuid(),
});

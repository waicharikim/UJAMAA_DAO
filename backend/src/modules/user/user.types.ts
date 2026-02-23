/**
 * @file src/modules/user/types/user.types.ts
 * @description
 * User Module Type Definitions and DTOs
 *
 * Version: 1.1 — January 2026
 * Added: Community verification types
 */

import { z } from 'zod';

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const UpdateProfileSchema = z.object({
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

export const SelectIndustriesSchema = z.object({
  industryIds: z
    .array(z.string().uuid())
    .min(1, 'At least one industry required')
    .max(3, 'Maximum 3 industries allowed'),
  primaryIndustryId: z.string().uuid().optional(),
});

export const SelectGoodsServicesSchema = z
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

export const RequestResidenceChangeSchema = z.object({
  newPrimaryWardId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  proofUrl: z
    .string()
    .url('Must be a valid URL (e.g., image/document link)')
    .optional(),
});

export const SetTemporaryLocationSchema = z.object({
  wardId: z.string().uuid(),
  until: z.string().datetime(),
});

export const UuidParamSchema = z.object({
  userId: z.string().uuid(),
});

// New: Community Verification
export const VouchRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  wardId: z.string().uuid(),
});

export const PaymentVerificationSchema = z.object({
  transactionId: z.string().min(10).max(20),
});

export const AdminApproveSchema = z.object({
  requestId: z.string().uuid(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

// ============================================================================
// TYPESCRIPT TYPES (inferred from Zod)
// ============================================================================

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type SelectIndustriesDto = z.infer<typeof SelectIndustriesSchema>;
export type SelectGoodsServicesDto = z.infer<typeof SelectGoodsServicesSchema>;
export type RequestResidenceChangeDto = z.infer<
  typeof RequestResidenceChangeSchema
>;
export type SetTemporaryLocationDto = z.infer<
  typeof SetTemporaryLocationSchema
>;

// New: Community Verification
export type VouchRequestDto = z.infer<typeof VouchRequestSchema>;
export type PaymentVerificationDto = z.infer<typeof PaymentVerificationSchema>;
export type AdminApproveDto = z.infer<typeof AdminApproveSchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface UserProfileResponse {
  id: string;
  email: string | null;
  name: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;

  geographic: {
    primaryWard: { id: string; name: string } | null;
    primaryConstituency: { id: string; name: string } | null;
    primaryCounty: { id: string; name: string } | null;
    secondaryWard: { id: string; name: string } | null;
    currentLocation: {
      wardId: string;
      wardName: string | null;
      until: Date | null;
    } | null;
  };

  verification: {
    level: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    communityVerified: boolean;
  };

  impact: {
    global: number;
    primary: {
      ward: { points: number; tier: string };
    } | null;
    allLocations: any[];
    totals: any;
  };

  economic: {
    utilityTokens: number;
    participationRights: number;
  };

  industries: { id: string; name: string; isPrimary: boolean }[];

  metadata: {
    createdAt: Date;
    lastLoginAt: Date | null;
  };

  /** Included internally for privacy filtering — stripped before sending to other users */
  _privacySettings?: {
    profileVisibility: string;
    showEmail: boolean;
    showPhone: boolean;
    showWallet: boolean;
    showImpactPoints: boolean;
  } | null;
}

export interface UserIndustryResponse {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface UserGoodsServiceResponse {
  id: string;
  name: string;
  category: string | null;
  canProvide: boolean;
  canRequest: boolean;
}

export interface ResidenceChangeRequestResponse {
  id: string;
  status: string;
  newWardId: string;
  newWardName: string;
  oldWardId: string | null;
  oldWardName: string | null;
  reason: string | null;
  proofUrl: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface TemporaryLocationResponse {
  currentLocationId: string | null;
  currentLocationUntil: Date | null;
  wardName: string | null;
}

// New: Verification Status Response
export interface VerificationStatusResponse {
  status:
    | 'PENDING'
    | 'VOUCHING'
    | 'PAYMENT_PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'EXPIRED';
  vouchesReceived: number;
  vouchesNeeded: number;
  expiresAt?: Date | null;
  rejectionReason?: string | null;
}

// Reference data responses
export interface CountyResponse {
  id: string;
  name: string;
  code: string;
}

export interface ConstituencyResponse {
  id: string;
  name: string;
  countyId: string;
}

export interface WardResponse {
  id: string;
  name: string;
  constituencyId: string;
  countyId: string;
}

export interface IndustryResponse {
  id: string;
  name: string;
}

export interface GoodsServiceResponse {
  id: string;
  name: string;
  industryId: string;
  category: string | null;
}

export interface WardMemberResponse {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  verificationLevel: string;
  primaryWardId: string | null;
}

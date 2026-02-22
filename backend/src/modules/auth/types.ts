/**
 * @file src/modules/auth/types.ts
 * @description
 * Auth Module Type Definitions and DTOs
 *
 * Combines Zod validation schemas with TypeScript types.
 * All request/response types and utility functions for auth module.
 *
 * Version: 2.1 — January 2026
 */

import { z } from 'zod';

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

/**
 * Send Magic Link Schema
 * Used for both new user registration and returning user login
 */
export const SendMagicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .optional(),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (E.164)')
    .optional(),
  primaryWardId: z.string().uuid('Invalid primary ward ID').optional(),
  secondaryWardId: z.string().uuid('Invalid secondary ward ID').optional(),
  industryIds: z
    .array(z.string().uuid())
    .min(1, 'At least one industry is required')
    .max(10, 'Maximum 10 industries allowed')
    .optional(),
  goodsServiceIds: z
    .array(z.string().uuid())
    .min(1, 'At least one goods/service is required')
    .max(20, 'Maximum 20 goods/services allowed')
    .optional(),
});

/**
 * Verify Token Query Params
 */
export const VerifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

/**
 * Logout Schema
 */
export const LogoutSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

/**
 * Wallet Nonce Request Schema
 */
export const WalletNonceSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

/**
 * Wallet Verify Signature Schema
 */
export const WalletVerifySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  signature: z.string().min(1, 'Signature is required'),
});

// ============================================================================
// TYPESCRIPT TYPES (inferred from Zod schemas)
// ============================================================================

export type SendMagicLinkDto = z.infer<typeof SendMagicLinkSchema>;
export type VerifyTokenDto = z.infer<typeof VerifyTokenSchema>;
export type LogoutDto = z.infer<typeof LogoutSchema>;
export type WalletNonceDto = z.infer<typeof WalletNonceSchema>;
export type WalletVerifyDto = z.infer<typeof WalletVerifySchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Auth User Response (safe for client)
 */
export interface AuthUserResponse {
  id: string;
  email: string | null;
  name: string | null;
  phoneNumber: string | null;
  walletAddress: string | null;
  verificationLevel: string;
  primaryWardId: string | null;
  secondaryWardId: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  communityVerified: boolean;
  locationVerified: boolean;
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights: number;
  roles?: string[];
  createdAt?: Date;
  lastLoginAt?: Date;
}

/**
 * Session Response (safe for client - no token!)
 */
export interface SessionResponse {
  id: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActive: Date;
  expiresAt: Date;
  isCurrent?: boolean;
}

/**
 * Send Magic Link Response
 */
export interface SendMagicLinkResponse {
  newUser: boolean;
  sentVerification?: boolean;
  sentLogin?: boolean;
}

/**
 * Magic Link Auth Result (returned after verification)
 */
export interface MagicLinkAuthResult {
  user: AuthUserResponse;
  sessionToken: string;
  session: SessionResponse;
  needsProfileCompletion: boolean;
  missingFields?: OnboardingMissingFields;
}

/**
 * Wallet Auth Result (same as MagicLinkAuthResult)
 */
export interface WalletAuthResult extends MagicLinkAuthResult {}

/**
 * Nonce Response
 */
export interface NonceResponse {
  nonce: string;
  message: string;
  expiresIn: number; // seconds
}

/**
 * Onboarding Missing Fields
 */
export interface OnboardingMissingFields {
  email?: boolean;
  phoneNumber?: boolean;
  name?: boolean;
  primaryWard?: boolean;
  secondaryWard?: boolean;
  industries?: boolean;
  goodsServices?: boolean;
}

// ============================================================================
// INTERNAL TYPES (used by services)
// ============================================================================

/**
 * Magic Link Token Payload (for JWT)
 */
export interface MagicLinkPayload {
  sub: string;
  email?: string;
  type: 'magic-link';
}

/**
 * Verification Token Record (stored in database)
 */
export interface VerificationTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Wallet Auth Context (for tracking)
 */
export interface WalletAuthContext {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Prisma User to safe AuthUserResponse
 */
export function toUserResponse(user: any): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    walletAddress: user.walletAddress,
    verificationLevel: user.verificationLevel,
    primaryWardId: user.primaryWardId,
    secondaryWardId: user.secondaryWardId,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    communityVerified: user.communityVerified,
    locationVerified: user.locationVerified,
    globalImpactPoints: user.globalImpactPoints,
    utilityTokens: user.utilityTokens,
    participationRights: user.participationRights,
    roles: user.userRoles?.map((ur: any) => ur.role.name),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

/**
 * Convert Prisma Session to safe SessionResponse
 */
export function toSessionResponse(
  session: any,
  isCurrent = false
): SessionResponse {
  return {
    id: session.id,
    deviceInfo: session.deviceInfo,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastActive: session.lastActive,
    expiresAt: session.expiresAt,
    isCurrent,
  };
}

/**
 * Get missing fields for onboarding
 */
export function getMissingFields(user: any): OnboardingMissingFields {
  const missing: OnboardingMissingFields = {};

  if (!user.email) missing.email = true;
  if (!user.phoneNumber) missing.phoneNumber = true;
  if (!user.name) missing.name = true;
  if (!user.primaryWardId) missing.primaryWard = true;
  if (!user.secondaryWardId) missing.secondaryWard = true;

  return missing;
}

/**
 * Check if user needs onboarding
 */
export function needsOnboarding(user: any): boolean {
  return (
    !user.email ||
    !user.primaryWardId ||
    !user.secondaryWardId ||
    user.verificationLevel === 'UNVERIFIED'
  );
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { VerificationLevel } from '../../core/types/Ujamaadao.types.js';

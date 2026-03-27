/**
 * @file src/modules/auth/validators/auth.validators.ts
 * @description
 * Zod validation schemas for authentication endpoints.
 *
 * All request bodies, query params, and route params should be validated
 * using these schemas before processing. Never trust client input.
 *
 * Version: 2.3 — February 2026
 * Updates:
 * - Stricter E.164 Kenyan phone number regex
 * - Added resetTokenQuerySchema for /password/verify-token
 * - Consistent naming and documentation
 */

import { z } from 'zod';

// ============================================================================
// REUSABLE FIELD VALIDATORS
// ============================================================================

const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .trim();

const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name too long')
  .regex(
    /^[a-zA-Z\s'-]+$/,
    'Name can only contain letters, spaces, hyphens, and apostrophes'
  )
  .trim();

const phoneNumberSchema = z
  .string()
  .regex(
    /^\+254[17]\d{8}$/,
    'Phone must be in strict E.164 format: +2547XXXXXXXX or +2541XXXXXXXX'
  )
  .transform((val) => val.trim());

export const uuidSchema = z.string().uuid('Invalid UUID format').trim();

const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid Ethereum address')
  .transform((val) => val.toLowerCase());

const ethereumSignatureSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{130}$/i, 'Invalid Ethereum signature');

// ============================================================================
// MAGIC LINK VALIDATORS
// ============================================================================

const messagingPlatformPreferenceSchema = z.object({
  platform: z.enum(['TELEGRAM', 'WHATSAPP', 'DISCORD']),
  handle: z
    .string()
    .max(100)
    .regex(/^@?[\w.\-]+$/, 'Handle must only contain letters, numbers, _, -, .')
    .optional(),
});

export const sendMagicLinkSchema = z
  .object({
    email: emailSchema,
    name: nameSchema.optional(),
    phoneNumber: phoneNumberSchema.optional(),
    primaryWardId: uuidSchema.optional(),
    secondaryWardId: uuidSchema.optional(),
    industryIds: z
      .array(uuidSchema)
      .min(1, 'At least one industry required')
      .max(3, 'Maximum 3 industries allowed')
      .optional(),
    goodsServiceIds: z
      .array(uuidSchema)
      .min(1, 'At least one good/service required')
      .max(10, 'Maximum 10 goods/services allowed')
      .optional(),
    messagingPlatforms: z
      .array(messagingPlatformPreferenceSchema)
      .max(3)
      .optional(),
  })
  .refine(
    (data) => {
      const hasOnboardingFields =
        data.name ||
        data.phoneNumber ||
        data.primaryWardId ||
        data.secondaryWardId ||
        data.industryIds ||
        data.goodsServiceIds;

      if (!hasOnboardingFields) return true; // existing user, email only

      // New user - require all onboarding fields
      return (
        data.name &&
        data.phoneNumber &&
        data.primaryWardId &&
        data.secondaryWardId &&
        data.industryIds &&
        data.goodsServiceIds
      );
    },
    {
      message:
        'New users must provide: name, phoneNumber, primaryWardId, secondaryWardId, industryIds, and goodsServiceIds',
    }
  );

export const verifyEmailTokenSchema = z.object({
  token: z.string().min(64).max(64, 'Invalid token format'),
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1, 'Token required'),
});

// ============================================================================
// WALLET VALIDATORS
// ============================================================================

export const walletNonceSchema = z.object({
  walletAddress: ethereumAddressSchema,
});

export const walletVerifySchema = z.object({
  walletAddress: ethereumAddressSchema,
  signature: ethereumSignatureSchema,
});

export const walletLinkSchema = walletVerifySchema;

// ============================================================================
// PHONE VALIDATION SCHEMAS
// ============================================================================

export const sendPhoneCodeSchema = z.object({
  phoneNumber: phoneNumberSchema,
  channel: z.enum(['sms', 'whatsapp', 'telegram']).optional().default('sms'),
});

export const verifyPhoneCodeSchema = z.object({
  phoneNumber: phoneNumberSchema,
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must contain only digits'),
});

// ============================================================================
// SESSION VALIDATORS
// ============================================================================

export const sessionIdSchema = z.object({
  sessionId: uuidSchema,
});

export const deviceNameSchema = z.object({
  deviceName: z
    .string()
    .min(1, 'Device name cannot be empty')
    .max(100, 'Device name too long (max 100 characters)')
    .regex(
      /^[a-zA-Z0-9\s\-_()]+$/,
      'Device name can only contain letters, numbers, spaces, hyphens, underscores, and parentheses'
    )
    .trim(),
});

// ============================================================================
// SECURITY EVENT VALIDATORS
// ============================================================================

export const securityEventIdSchema = z.object({
  eventId: z.string().uuid('Invalid event ID format'),
});

export const resolveSecurityEventSchema = z.object({
  notes: z
    .string()
    .max(500, 'Notes too long (max 500 characters)')
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
});

// ============================================================================
// REFRESH TOKEN VALIDATORS
// ============================================================================

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'Refresh token is required')
    .max(500, 'Refresh token too long'),
});

// ============================================================================
// TWO-FACTOR AUTHENTICATION (2FA) VALIDATORS
// ============================================================================

export const twoFactorCodeSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must contain only digits'),
});

// ============================================================================
// PASSWORD RESET VALIDATORS
// ============================================================================

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const resetTokenQuerySchema = z.object({
  token: z.string().length(64, 'Invalid reset token format'),
});

export const passwordResetSchema = z.object({
  token: z.string().length(64, 'Invalid token format'),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
});

// ============================================================================
// CONTEXT VALIDATORS (internal use)
// ============================================================================

export const authContextSchema = z.object({
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  deviceInfo: z.string().max(200).optional(),
});

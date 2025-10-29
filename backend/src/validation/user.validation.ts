/**
 * @file user.validation.ts
 *
 * @description
 * UJAMAADAO Enhanced Zod Schemas for User Input Validation
 * * Comprehensive validation schemas for the UJAMAADAO platform that include:
 * - Geographic hierarchy validation (ward → constituency → county)
 * - Progressive verification system input validation (NOW INCLUDING EMAIL)
 * - Three-tier economic system transaction validation
 * - Community governance role and permission validation
 * - Enhanced location validation with hierarchy consistency checks
 * * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic hierarchy consistency validation
 * - Progressive verification workflow input validation
 * - Economic system transaction amount validation
 * - Voting weight calculation input validation
 * - Community governance proposal validation
 * - Enhanced privacy settings validation
 * * Validation Features:
 * - Preprocessing for normalization (wallet, email, phone)
 * - Geographic hierarchy consistency checks
 * - Economic system business rule enforcement
 * - Verification level progression validation
 * - Custom error messages for community users
 */

import { z } from 'zod';

/**
 * UJAMAADAO Geographic Hierarchy Constants
 */
const GEOGRAPHIC_LEVELS = ['WARD', 'CONSTITUENCY', 'COUNTY', 'NATIONAL'] as const;
const VERIFICATION_LEVELS = ['UNVERIFIED', 'PHONE_VERIFIED', 'COMMUNITY_VERIFIED', 'FULL_VERIFIED'] as const;
const ECONOMIC_TIERS = ['TIER_1', 'TIER_2', 'TIER_3'] as const;

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize wallet address: trim + lowercase for consistent validation
 */
function normalizeWalletAddressRaw(value: unknown) {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

/**
 * Normalize email: trim + lowercase for consistent validation
 */
function normalizeEmailRaw(value: unknown) {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

/**
 * Normalize phone input to canonical international +254 form for Kenyan numbers
 */
function normalizePhoneToInternationalRaw(value: unknown) {
  if (typeof value !== 'string') return value;
  const p = value.replace(/\s+/g, '');

  if (p.startsWith('+254')) return p;
  if (p.startsWith('254')) return '+' + p;
  if (p.startsWith('0')) return '+254' + p.slice(1);
  if (/^[71]\d{8}$/.test(p)) return '+254' + p;
  return p;
}

/**
 * Normalize geographic identifier: trim and validate format
 */
function normalizeGeographicIdRaw(value: unknown) {
  if (typeof value !== 'string') return value;
  return value.trim().toUpperCase();
}

// ============================================================================
// BASE VALIDATION SCHEMAS
// ============================================================================

/**
 * Kenyan phone number validation with canonical +254 format
 */
const canonicalPhoneRegex = /^\+254(7\d{8}|1\d{8})$/;
const phoneSchema = z.preprocess(
  normalizePhoneToInternationalRaw,
  z
    .string()
    .refine((val: string) => canonicalPhoneRegex.test(val), {
      message: 'Please provide a valid Kenyan phone number (+254XXXXXXXXX)'
    })
);

/**
 * Ethereum wallet address validation
 */
const walletAddressSchema = z.preprocess(
  normalizeWalletAddressRaw,
  z
    .string()
    .min(42, 'Wallet address must be 42 characters')
    .max(42, 'Wallet address must be 42 characters')
    .regex(/^0x[a-fA-F0-9]{40}$/, {
      message: 'Please provide a valid Ethereum wallet address (0x...)'
    })
);

/**
 * Email validation with normalization
 */
const emailSchema = z.preprocess(
  normalizeEmailRaw,
  z.string().email('Please provide a valid email address')
);

/**
 * Geographic UUID validation for ward, constituency, county
 */
const geographicUuidSchema = z.string().uuid('Please provide a valid geographic identifier');

/**
 * County code validation (Kenyan counties: 01-47)
 */
const countyCodeSchema = z
  .string()
  .length(2, 'County code must be 2 digits')
  .refine((code: string) => /^\d{2}$/.test(code) && parseInt(code) >= 1 && parseInt(code) <= 47, {
    message: 'County code must be between 01 and 47'
  });

/**
 * Location name validation for geographic areas
 */
const locationNameSchema = z
  .string()
  .min(2, 'Location name must be at least 2 characters')
  .max(100, 'Location name must be less than 100 characters')
  .regex(/^[a-zA-Z0-9\s\-']+$/, {
    message: 'Location name can only contain letters, numbers, spaces, hyphens, and apostrophes'
  });

// ============================================================================
// UJAMAADAO ENHANCED VALIDATION SCHEMAS
// ============================================================================

/**
 * UJAMAADAO Geographic Hierarchy Schema
 * * Validates geographic hierarchy consistency for ward → constituency → county
 */
const geographicHierarchySchema = z.object({
  // Primary geographic identity (required for location-based operations)
  primaryWardId: geographicUuidSchema.optional()
    .describe('Primary residential ward for geographic identity'),
  
  // Optional secondary ward affiliation
  secondaryWardId: geographicUuidSchema.optional()
    .describe('Secondary ward affiliation for cross-community participation'),
  
  // Automatic constituency and county derivation (validated in service layer)
  constituencyId: geographicUuidSchema.optional(),
  countyId: geographicUuidSchema.optional(),
  
  // String-based location input (alternative to UUIDs for easy registration)
  countyCode: countyCodeSchema.optional(),
  constituencyName: locationNameSchema.optional(),
  wardName: locationNameSchema.optional(),
})
.refine(
  (data: { primaryWardId: any; countyCode: any; constituencyName: any; wardName: any; }) => !(data.primaryWardId && (data.countyCode || data.constituencyName || data.wardName)),
  {
    message: 'Cannot provide both UUID and string-based location data',
    path: ['primaryWardId']
  }
)
.refine(
  (data: { countyCode: any; constituencyName: any; wardName: any; }) => {
    // If providing string locations, all three must be provided
    const hasStringLocation = data.countyCode || data.constituencyName || data.wardName;
    if (hasStringLocation) {
      return !!(data.countyCode && data.constituencyName && data.wardName);
    }
    return true;
  },
  {
    message: 'String-based location requires countyCode, constituencyName, and wardName',
    path: ['countyCode']
  }
);

/**
 * UJAMAADAO Progressive Verification Schema
 * * Validates verification-related inputs for the progressive verification system
 */
const verificationInputSchema = z.object({
  // Verification status updates (admin/system only)
  emailVerified: z.boolean().optional(), // <--- ADDED: System field for email verification
  phoneVerified: z.boolean().optional(),
  communityVerified: z.boolean().optional(),
  locationVerified: z.boolean().optional(),
  
  // Verification workflow inputs
  verificationType: z.enum(['EMAIL', 'PHONE', 'COMMUNITY', 'LOCATION']).optional(), // <--- UPDATED: Added 'EMAIL'
  verificationCode: z.string().min(4).max(10).optional(),
  verificationData: z.record(z.any()).optional(),
})
.refine(
  (data: { communityVerified: any; phoneVerified: any; locationVerified: any; }) => {
    // Community verification requires phone verification first
    if (data.communityVerified && !data.phoneVerified) {
      return false;
    }
    // Location verification requires community verification first
    if (data.locationVerified && !data.communityVerified) {
      return false;
    }
    return true;
  },
  {
    message: 'Verification must follow progression: Phone → Community → Location',
    path: ['phoneVerified']
  }
);

/**
 * UJAMAADAO Economic System Schema
 * * Validates economic system inputs for the three-tier economic model
 */
const economicInputSchema = z.object({
  // Impact Points adjustments
  globalImpactPoints: z.number().int().min(0).max(10000).optional(),
  
  // Utility Token transactions
  utilityTokens: z.number().int().min(0).max(1000000).optional(),
  
  // Participation Rights management
  participationRights: z.number().int().min(0).max(100).optional(),
  
  // Economic transactions
  transactionAmount: z.number().positive().max(1000000).optional(),
  transactionMemo: z.string().max(500).optional(),
})
.refine(
  (data: { globalImpactPoints: number | undefined; }) => {
    // Validate economic tier consistency
    if (data.globalImpactPoints !== undefined) {
      const tier = data.globalImpactPoints >= 501 ? 'TIER_3' : 
                  data.globalImpactPoints >= 101 ? 'TIER_2' : 'TIER_1';
      // Additional business rules can be added here
      return true;
    }
    return true;
  },
  {
    message: 'Invalid economic system configuration',
    path: ['globalImpactPoints']
  }
);

/**
 * UJAMAADAO Privacy Settings Schema
 * * Validates privacy settings for the community governance platform
 */
const privacySettingsSchema = z.object({
  settings: z.record(
    z.enum(['public', 'group', 'private']),
    {
      description: 'Privacy settings for user data visibility'
    }
  ).optional(),
})
.refine(
  (data: { settings: {}; }) => {
    if (data.settings) {
      const validFields = [
        'email', 'phoneNumber', 'walletAddress', 'primaryWardId',
        'globalImpactPoints', 'utilityTokens', 'verificationLevel'
      ];
      return Object.keys(data.settings).every(field => validFields.includes(field));
    }
    return true;
  },
  {
    message: 'Invalid privacy settings field',
    path: ['settings']
  }
);

// ============================================================================
// COMPREHENSIVE USER SCHEMAS
// ============================================================================

/**
 * UJAMAADAO Enhanced User Creation Schema
 * * Comprehensive validation for user registration with geographic, verification,
 * and economic system context.
 */
export const createUserSchema = z.object({
  // Core Identity Fields (Required)
  walletAddress: walletAddressSchema,
  email: emailSchema,
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, {
      message: 'Name can only contain letters, spaces, hyphens, and apostrophes'
    }),
  
  // Contact Information
  phoneNumber: phoneSchema,
  
  // UJAMAADAO Geographic Identity
  ...geographicHierarchySchema.shape,
  
  // Business Context
  industryId: z.string().uuid('Please provide a valid industry identifier').optional(),
  goodsServices: z.array(z.string().uuid('Please provide valid goods/services identifiers'))
    .max(10, 'Cannot select more than 10 goods/services')
    .optional(),
  
  // Profile Information
  avatarUrl: z.string().url('Please provide a valid avatar URL').optional(),
  
  // UJAMAADAO System Fields (Set by system)
  nonce: z.string().optional(), // Generated by system
  isActive: z.boolean().optional().default(true),
})
.refine(
  (data: { primaryWardId: any; countyCode: any; constituencyName: any; wardName: any; }) => {
    // Ensure at least one form of geographic identity is provided
    return !!(data.primaryWardId || (data.countyCode && data.constituencyName && data.wardName));
  },
  {
    message: 'Either primaryWardId or complete string location (countyCode, constituencyName, wardName) is required',
    path: ['primaryWardId']
  }
);

/**
 * UJAMAADAO Enhanced User Update Schema
 * * Validation for user profile updates with comprehensive platform context
 */
export const updateUserSchema = createUserSchema
  .partial()
  .refine(
    (data: {}) => Object.keys(data).length > 0,
    {
      message: 'At least one field must be provided for update',
    }
  )
  .refine(
    (data: { walletAddress: undefined; }) => {
      // Prevent updating wallet address after registration
      if (data.walletAddress !== undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'Wallet address cannot be updated after registration',
      path: ['walletAddress']
    }
  );

/**
 * UJAMAADAO Verification Update Schema
 * * Specialized validation for verification workflow inputs
 */
export const updateVerificationSchema = z.object({
  verificationType: z.enum(['EMAIL', 'PHONE', 'COMMUNITY', 'LOCATION'], { // <--- UPDATED: Added 'EMAIL'
    required_error: 'Verification type is required',
    invalid_type_error: 'Verification type must be EMAIL, PHONE, COMMUNITY, or LOCATION'
  }),
  verificationData: z.record(z.any(), {
    required_error: 'Verification data is required'
  }).refine(
    (data: {}) => Object.keys(data).length > 0,
    {
      message: 'Verification data cannot be empty'
    }
  ),
});

/**
 * UJAMAADAO Utility Token Transfer Schema
 * * Validation for economic system token transfers
 */
export const transferUtilityTokensSchema = z.object({
  recipientWalletAddress: walletAddressSchema,
  amount: z.number()
    .positive('Transfer amount must be positive')
    .min(1, 'Minimum transfer amount is 1 UT')
    .max(100000, 'Maximum transfer amount is 100,000 UT'),
  memo: z.string()
    .max(200, 'Memo must be less than 200 characters')
    .optional(),
})
.refine(
  (data: { recipientWalletAddress: any; senderWalletAddress: any; }) => data.recipientWalletAddress !== data.senderWalletAddress,
  {
    message: 'Cannot transfer tokens to yourself',
    path: ['recipientWalletAddress']
  }
);

/**
 * UJAMAADAO Geographic Context Schema
 * * Validation for geographic context in requests
 */
export const geographicContextSchema = z.object({
  primaryWardId: geographicUuidSchema.optional(),
  constituencyId: geographicUuidSchema.optional(),
  countyId: geographicUuidSchema.optional(),
  locationScope: z.enum(GEOGRAPHIC_LEVELS).optional(),
})
.refine(
  (data: { constituencyId: any; countyId: any; primaryWardId: any; }) => {
    // If any geographic ID is provided, primaryWardId should be the source
    if ((data.constituencyId || data.countyId) && !data.primaryWardId) {
      return false;
    }
    return true;
  },
  {
    message: 'Geographic context must be derived from primary ward',
    path: ['primaryWardId']
  }
);

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateVerificationInput = z.infer<typeof updateVerificationSchema>;
export type TransferUtilityTokensInput = z.infer<typeof transferUtilityTokensSchema>;
export type GeographicContextInput = z.infer<typeof geographicContextSchema>;
export type VerificationInput = z.infer<typeof verificationInputSchema>;
export type EconomicInput = z.infer<typeof economicInputSchema>;
export type PrivacySettingsInput = z.infer<typeof privacySettingsSchema>;

// ============================================================================
// VALIDATION UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate Geographic Hierarchy Consistency
 * * Utility function to validate ward → constituency → county hierarchy consistency
 */
export async function validateGeographicHierarchy(input: GeographicContextInput) {
  // This would typically check against the database
  // to ensure the geographic hierarchy is valid
  return geographicContextSchema.parse(input);
}

/**
 * Validate Economic Transaction
 * * Utility function to validate economic transactions against business rules
 */
export function validateEconomicTransaction(input: TransferUtilityTokensInput, userContext: any) {
  const validated = transferUtilityTokensSchema.parse(input);
  
  // Additional business rule validation
  if (userContext.utilityTokens < validated.amount) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: 'Insufficient utility tokens for transfer',
        path: ['amount']
      }
    ]);
  }
  
  return validated;
}

/**
 * Validate Verification Progression
 * * Utility function to ensure verification follows the correct progression
 */
export function validateVerificationProgression(currentLevel: string, targetLevel: string) {
  const levelHierarchy = {
    'UNVERIFIED': 0,
    'PHONE_VERIFIED': 1,
    'COMMUNITY_VERIFIED': 2,
    'FULLY_VERIFIED': 3
  };
  
  const current = levelHierarchy[currentLevel as keyof typeof levelHierarchy] || 0;
  const target = levelHierarchy[targetLevel as keyof typeof levelHierarchy] || 0;
  
  if (target <= current) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: `Cannot regress verification level from ${currentLevel} to ${targetLevel}`,
        path: ['verificationLevel']
      }
    ]);
  }
  
  return true;
}
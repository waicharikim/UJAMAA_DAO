/**
 * @file user.validation.ts
 *
 * @description
 * Zod schemas for validating user input.
 * - Uses z.preprocess so normalization happens before validation.
 * - Canonical phone format: +254XXXXXXXXX.
 * - **ENHANCED**: Supports BOTH UUID locations AND string names for easy registration.
 */

import { z } from 'zod';

/**
 * Normalize wallet address: trim + lowercase.
 */
function normalizeWalletAddressRaw(value: unknown) {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

/**
 * Normalize email: trim + lowercase.
 */
function normalizeEmailRaw(value: unknown) {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

/**
 * Normalize phone input to canonical international +254 form.
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

const canonicalPhoneRegex = /^\+254(7\d{8}|1\d{8})$/;

/**
 * **NEW: Location UUID or String schemas**
 */
const locationUuidSchema = z.string().uuid('Invalid UUID');
const locationStringSchema = z.string().min(1, 'Location name required');

/**
 * **NEW: County code (2 digits: '01'-'47')**
 */
const countyCodeSchema = z
  .string()
  .length(2)
  .refine((code) => /^\d{2}$/.test(code) && parseInt(code) >= 1 && parseInt(code) <= 47, {
    message: 'County code must be 01-47'
  });

/**
 * Wallet, email, phone schemas (UNCHANGED)
 */
const walletAddressSchema = z.preprocess(
  normalizeWalletAddressRaw,
  z
    .string()
    .min(10, 'Invalid wallet address')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address')
    .optional()
);

const emailSchema = z.preprocess(
  normalizeEmailRaw,
  z.string().email('Invalid email')
);

const phoneSchema = z.preprocess(
  normalizePhoneToInternationalRaw,
  z
    .string()
    .refine((val) => !val || canonicalPhoneRegex.test(val), 'Invalid Kenyan phone number')
    .optional()
);

/**
 * **ENHANCED BASE SCHEMA**
 * - Keeps ALL existing UUID fields (for advanced users)
 * - Adds OPTIONAL string fields (for easy registration)
 */
const baseSchema = z.object({
  // **CORE FIELDS**
  email: emailSchema,
  name: z.string().min(2, 'Name is too short'),
  phoneNumber: phoneSchema,

  // **EXISTING UUID LOCATION FIELDS** (Keep for compatibility)
  constituencyOrigin: locationUuidSchema.optional(),
  countyOrigin: locationUuidSchema.optional(),
  constituencyLive: locationUuidSchema.optional(),
  countyLive: locationUuidSchema.optional(),

  // **NEW: EASY STRING LOCATION FIELDS** (Optional - for simple registration)
  countyCode: countyCodeSchema.optional(),
  constituencyName: locationStringSchema.optional(),
  wardName: locationStringSchema.optional(),

  // **EXISTING BUSINESS FIELDS** (Unchanged)
  walletAddress: walletAddressSchema,
  industryId: z.string().uuid().optional(),
  goodsServices: z.array(z.string().uuid()).optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Exported schemas
 */
export const createUserSchema = baseSchema;
export const updateUserSchema = baseSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
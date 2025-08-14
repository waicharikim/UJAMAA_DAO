/**
 * @file user.validation.ts
 *
 * @description
 * Zod schemas for validating user input.
 * - Uses z.preprocess so normalization happens before validation (avoids Zod transform chaining issues).
 * - Canonical phone format is international: +254XXXXXXXXX.
 * - Accepts industryId as canonical UUID field.
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
 * Accepts variants like:
 *  - "+254712345678"
 *  - "254712345678"
 *  - "0712345678"
 *  - "712345678"
 *
 * Returns same string unchanged if it cannot be interpreted.
 */
function normalizePhoneToInternationalRaw(value: unknown) {
  if (typeof value !== 'string') return value;
  const p = value.replace(/\s+/g, '');

  if (p.startsWith('+254')) return p;
  if (p.startsWith('254')) return '+' + p;
  if (p.startsWith('0')) return '+254' + p.slice(1); // 07... -> +2547...
  if (/^[71]\d{8}$/.test(p)) return '+254' + p; // 7xxxxxxxx or 1xxxxxxxx -> +254...
  return p;
}

/**
 * Phone validation regex for canonical +254 format:
 * Allows +2547XXXXXXXX and +2541XXXXXXXX (mobile + some landline prefix).
 * - +254
 * - then either 7 or 1
 * - then 8 digits -> total 9 digits after prefix
 */
const canonicalPhoneRegex = /^\+254(7\d{8}|1\d{8})$/;

/**
 * Wallet address schema (preprocess for normalization, then validate).
 * Using preprocess lets us normalize before running .min/.regex validations.
 */
const walletAddressSchema = z.preprocess(
  normalizeWalletAddressRaw,
  z
    .string()
    .min(10, 'Invalid wallet address')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address')
);

/**
 * Email schema: normalize then validate.
 */
const emailSchema = z.preprocess(
  normalizeEmailRaw,
  z.string().email('Invalid email')
);

/**
 * Phone schema: normalize then ensure canonical +254 format.
 */
const phoneSchema = z.preprocess(
  normalizePhoneToInternationalRaw,
  z
    .string()
    .refine((val) => !val || canonicalPhoneRegex.test(val), 'Invalid Kenyan phone number')
    .optional()
);

/**
 * Base schema for user creation.
 * NOTE: industryId is the canonical field expected by the backend.
 */
const baseSchema = z.object({
  walletAddress: walletAddressSchema,
  email: emailSchema,
  name: z.string().min(2, 'Name is too short'),
  phoneNumber: phoneSchema,
  constituencyOrigin: z.string().uuid('Invalid constituencyOrigin UUID'),
  countyOrigin: z.string().uuid('Invalid countyOrigin UUID'),
  constituencyLive: z.string().uuid('Invalid constituencyLive UUID'),
  countyLive: z.string().uuid('Invalid countyLive UUID'),

  // canonical industryId (UUID)
  industryId: z.string().uuid().optional(),

  goodsServices: z.array(z.string().uuid()).optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Exported schemas:
 * - createUserSchema: required fields as per baseSchema
 * - updateUserSchema: partial version to allow partial updates
 */
export const createUserSchema = baseSchema;
export const updateUserSchema = baseSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
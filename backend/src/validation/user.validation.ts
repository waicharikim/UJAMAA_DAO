/**
 * @file user.validation.ts
 *
 * @description
 * Defines Zod schemas for validating user-related inputs.
 * - CreateUserInput: validates inputs for user creation.
 * - UpdateUserInput: partial schema for user updates.
 */

import { z } from 'zod';

/**
 * Schema for creating a new user.
 * Validates wallet address, email, name, locations, and optional fields.
 */
export const createUserSchema = z.object({
  walletAddress: z
    .string()
    .min(10, 'Invalid wallet address')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address'),
  email: z.string().email('Invalid email'),
  name: z.string().min(2, 'Name is too short'),
  phoneNumber: z.string().optional(),
  constituencyOrigin: z.string().uuid('Invalid constituencyOrigin UUID'),
  countyOrigin: z.string().uuid('Invalid countyOrigin UUID'),
  constituencyLive: z.string().uuid('Invalid constituencyLive UUID'),
  countyLive: z.string().uuid('Invalid countyLive UUID'),
  industry: z.string().optional(),
  goodsServices: z.array(z.string().uuid()).optional(),
  avatarUrl: z.string().url().optional(), // Optional avatar URL field
});

/**
 * Schema for updating an existing user (partial fields).
 */
export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
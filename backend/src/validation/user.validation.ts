/**
 * @file user.validation.ts
 *
 * @description
 * Defines Zod validation schemas for User entity operations.
 *
 * Includes:
 * - Schema for creating a new user with required and optional fields.
 * - Partial schema for updating an existing user allowing optional fields.
 *
 * Provides strong typing support via TypeScript inference.
 */

import { z } from 'zod';

/**
 * User creation validation schema.
 * Validates required fields like walletAddress, email, name,
 * and location-related fields.
 * Optional fields include phoneNumber, industry, and goods/services array.
 */
export const createUserSchema = z.object({
  walletAddress: z.string().min(10, 'Invalid wallet address'),
  email: z.string().email('Invalid email'),
  name: z.string().min(2, 'Name is too short'),
  phoneNumber: z.string().optional(),
  constituencyOrigin: z.string().min(1),
  countyOrigin: z.string().min(1),
  constituencyLive: z.string().min(1),
  countyLive: z.string().min(1),
  industry: z.string().optional(),
  goodsServices: z.array(z.string()).optional(),
});

/**
 * User update validation schema.
 * All fields are optional to allow partial updates,
 * but validated according to the same rules as creation.
 */
export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
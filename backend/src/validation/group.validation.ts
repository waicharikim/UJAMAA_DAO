/**
 * @file group.validation.ts
 *
 * @description
 * Defines Zod validation schemas for Group entity operations.
 *
 * Includes:
 * - Validation schema for creating a new group with required fields and constraints.
 * - Validation schema for updating existing groups allowing partial inputs.
 *
 * These schemas enforce input correctness for API requests and support
 * strong typing via TypeScript inference.
 */

import { z } from 'zod';

/**
 * @description
 * Schema for validating group creation input.
 * Ensures required fields like name, walletAddress, constituency, and county are provided and properly formatted.
 * Optional fields like description, industryFocus, and productsServices have appropriate validations.
 */
export const createGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters long'),
  description: z.string().optional(),
  walletAddress: z.string().min(10, 'Invalid wallet address'), // You can add a regex for Ethereum address if needed
  constituency: z.string().min(1, 'Constituency is required'),
  county: z.string().min(1, 'County is required'),
  industryFocus: z.string().optional(),
  productsServices: z.array(z.string()).optional(),
});

/**
 * @description
 * Schema for validating group update inputs.
 * All fields are optional to allow partial updates but keep the same validation rules as creation.
 */
export const updateGroupSchema = createGroupSchema.partial();

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
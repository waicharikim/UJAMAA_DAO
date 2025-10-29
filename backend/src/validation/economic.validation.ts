/**
 * @file economic.validation.ts
 *
 * @description
 * UJAMAADAO Economic System Validation Schemas
 *
 * Zod validation schemas for economic system operations with
 * UJAMAADAO-specific business rules and constraints.
 */

import { z } from 'zod';

/**
 * Economic Transaction Types
 */
const economicTransactionTypeSchema = z.enum([
  'INITIAL_GRANT',
  'VERIFICATION_BONUS',
  'WORK_COMPLETION',
  'PROJECT_CONTRIBUTION',
  'COMMUNITY_SERVICE',
  'TOKEN_TRANSFER',
  'MARKETPLACE_PURCHASE',
  'GOVERNANCE_PARTICIPATION'
]);

/**
 * Location Scope for Impact Points
 */
const locationScopeSchema = z.enum(['LOCAL', 'SYSTEM']);

/**
 * Base Schema for Award Impact Points (Internal Use)
 */
const awardImpactPointsBaseSchema = z.object({
  userId: z.string().uuid('Please provide a valid user ID'),
  points: z.number()
    .int('Impact points must be whole numbers')
    .min(1, 'Minimum award is 1 impact point')
    .max(1000, 'Maximum single award is 1000 impact points'),
  transactionType: economicTransactionTypeSchema,
  description: z.string()
    .min(5, 'Description must be at least 5 characters')
    .max(500, 'Description must be less than 500 characters'),
  locationScope: locationScopeSchema,
  relatedEntityId: z.string().uuid('Please provide a valid entity ID').optional(),
  relatedEntityType: z.string().min(2, 'Entity type must be at least 2 characters').optional()
});

/**
 * Base Schema for Transfer Utility Tokens (Internal Use)
 */
const transferTokensBaseSchema = z.object({
  recipientWalletAddress: z.string()
    .length(42, 'Wallet address must be 42 characters') // Using length instead of min/max for clarity
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Please provide a valid Ethereum wallet address'),
  amount: z.number()
    .int('Token amount must be a whole number')
    .min(1, 'Minimum transfer amount is 1 UT')
    .max(100000, 'Maximum transfer amount is 100,000 UT'),
  memo: z.string()
    .max(200, 'Memo must be less than 200 characters')
    .optional()
});

/**
 * Schemas formatted for the `validateRequest` middleware
 */
export const economicValidations = {
  awardImpactPoints: z.object({
    body: awardImpactPointsBaseSchema,
  }),

  transferTokens: z.object({
    body: transferTokensBaseSchema,
  }),

  // Used for GET /profile/:userId route
  getEconomicProfile: z.object({
    params: z.object({
      userId: z.string().uuid('Please provide a valid user ID'),
    }),
  }),

  // Used for GET /transaction-history/:userId route
  getTransactionHistory: z.object({
    params: z.object({
      userId: z.string().uuid('Please provide a valid user ID'),
    }),
    query: z.object({
      page: z.string().optional().default('1').transform(val => parseInt(val)),
      limit: z.string().optional().default('10').transform(val => parseInt(val)),
    }).partial(),
  }),
};


// Export types for use in controllers
export type AwardImpactPointsInput = z.infer<typeof awardImpactPointsBaseSchema>;
export type TransferTokensInput = z.infer<typeof transferTokensBaseSchema>;

export default economicValidations;
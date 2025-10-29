/**
 * @file wallet.validation.ts
 *
 * @description
 * Zod validation schemas for Wallet Controller operations.
 */

import { z } from 'zod';

// Helper schema for holder type (USER or GROUP)
const holderTypeSchema = z.enum(['USER', 'GROUP']).transform(val => val.toUpperCase());

// Query parameter for group ID (required if holderType is GROUP)
const groupIdQuerySchema = z.object({
    groupId: z.string().uuid('Invalid group ID format').optional(),
});

// Base schema for pagination
const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema for GET /wallet/balance
 * Allows query params: holderType, groupId
 */
export const getBalanceValidation = z.object({
    query: z.object({
        holderType: holderTypeSchema.optional().default('USER'),
    }).merge(groupIdQuerySchema),
});

/**
 * Schema for GET /wallet/transactions
 * Allows query params: holderType, groupId, limit, offset
 */
export const getTransactionsValidation = z.object({
    query: z.object({
        holderType: holderTypeSchema.optional().default('USER'),
    })
    .merge(groupIdQuerySchema)
    .merge(paginationSchema),
});

/**
 * @file audit.validation.ts
 *
 * @description
 * Zod validation schemas for Audit Controller operations.
 */

import { z } from 'zod';

// Base schema for pagination and user ID
const userAuditQuerySchema = z.object({
    userId: z.string().uuid('Invalid User ID format').optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema for GET /audit/logs/:userId?
 * Allows optional userId in params, and pagination in query.
 */
export const getAuditLogsValidation = z.object({
    params: z.object({
        userId: z.string().uuid('Invalid User ID format').optional(),
    }),
    query: userAuditQuerySchema.omit({ userId: true }),
});

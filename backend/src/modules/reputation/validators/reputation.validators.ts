/**
 * @file src/modules/reputation/validators/reputation.validators.ts
 */

import { z } from 'zod';

export const userIdParamSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

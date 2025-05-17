import { z } from 'zod';

/**
 * Schema for adding or subtracting impact points.
 */
export const impactPointUpdateSchema = z.object({
  holderType: z.enum(['USER', 'GROUP']),
  holderId: z.string().uuid(),
  locationScope: z.enum(['LOCAL', 'CONSTITUENCY', 'COUNTY', 'NATIONAL']).optional(),
  points: z.number().int(),
  constituency: z.string().optional(),
  county: z.string().optional(),
});

/**
 * Schema for token balance updates (transfer, mint, spend).
 */
export const tokenBalanceUpdateSchema = z.object({
  holderType: z.enum(['USER', 'GROUP']),
  holderId: z.string().uuid(),
  amount: z.number().int(),
});

export type ImpactPointUpdate = z.infer<typeof impactPointUpdateSchema>;
export type TokenBalanceUpdate = z.infer<typeof tokenBalanceUpdateSchema>;
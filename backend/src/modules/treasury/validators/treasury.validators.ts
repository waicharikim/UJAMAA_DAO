/**
 * @file src/modules/treasury/validators/treasury.validators.ts
 */

import { z } from 'zod';

export const depositSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  referenceType: z
    .enum(['PROPOSAL', 'PROJECT', 'DUES', 'ESCROW', 'MANUAL'])
    .optional(),
  proposalId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

export const withdrawSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  referenceType: z
    .enum(['PROPOSAL', 'PROJECT', 'DUES', 'ESCROW', 'MANUAL'])
    .optional(),
  proposalId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

export const transactionQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  transactionType: z.enum(['CREDIT', 'DEBIT']).optional(),
  referenceType: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

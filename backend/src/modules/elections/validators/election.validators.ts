/**
 * @file src/modules/elections/validators/election.validators.ts
 * Version: 1.0 — March 2026
 */

import { z } from 'zod';

export const nominateSchema = z.object({
  statement: z
    .string()
    .max(1000, 'Statement must be 1000 characters or less')
    .optional(),
});

export const castVoteSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID'),
});

export const listElectionsSchema = z.object({
  groupId: z.string().uuid().optional(),
  countyId: z.string().uuid().optional(),
  scope: z.enum(['GROUP', 'SYSTEM']).optional(),
  status: z
    .enum(['PENDING', 'NOMINATIONS_OPEN', 'VOTING_OPEN', 'CLOSED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const electionIdSchema = z.object({
  electionId: z.string().uuid('Invalid election ID'),
});

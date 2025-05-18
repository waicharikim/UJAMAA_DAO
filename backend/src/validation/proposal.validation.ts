import { z } from 'zod';

const baseCreateProposalSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  proposalType: z.enum(['BUSINESS', 'NON_PROFIT', 'BILL']),
  funded: z.boolean(),
  budget: z.number().int().positive().optional(),
  timeline: z.string().optional(),
  locationScope: z.enum(['LOCAL', 'CONSTITUENCY', 'COUNTY', 'NATIONAL']),
  constituency: z.string().optional(),
  county: z.string().optional(),
  isPrivate: z.boolean().optional().default(false),
  purposeDetails: z.any().optional(),
  creatorUserId: z.string().uuid().optional(),
  creatorGroupId: z.string().uuid().optional(),
});

// Add conditional refinement as a separate schema layer
export const createProposalSchema = baseCreateProposalSchema.superRefine((data, ctx) => {
  if (data.funded) {
    if (data.budget === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Budget must be specified for funded proposals',
        path: ['budget'],
      });
    }
  }
});

// Now `.partial()` works on the base schema, not the superRefine one
export const updateProposalSchema = baseCreateProposalSchema.partial();

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
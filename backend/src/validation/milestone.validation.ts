import { z } from 'zod';

export const createMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().min(5),
  dueDate: z.string().optional(), // ISO-8601 date string
  fundingAmount: z.number().int().positive(),
});

export const submitMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
});

export const reviewMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  approved: z.boolean(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type SubmitMilestoneInput = z.infer<typeof submitMilestoneSchema>;
export type ReviewMilestoneInput = z.infer<typeof reviewMilestoneSchema>;
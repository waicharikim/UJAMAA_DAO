import { z } from 'zod';

export const createProjectSchema = z.object({
  proposalId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().min(5),
  budget: z.number().int().nonnegative().optional(),
  timeline: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
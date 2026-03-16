/**
 * @file src/modules/education/validators/education.validators.ts
 * @description Zod validators for the Education module.
 */

import { z } from 'zod';

export const moduleIdParamSchema = z.object({
  moduleId: z.string().uuid(),
});

export const listModulesSchema = z.object({
  category: z.string().trim().optional(),
  difficulty: z
    .enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const completeModuleSchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
});

export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

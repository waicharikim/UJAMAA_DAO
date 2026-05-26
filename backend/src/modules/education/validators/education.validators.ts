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

const moduleBodyBase = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(500),
  content: z.string().trim().min(100),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  duration: z.number().int().min(1).max(300), // minutes
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  category: z.string().trim().min(1).max(50),
  completionIP: z.number().int().min(0).max(200).optional(),
});

export const createModuleSchema = moduleBodyBase;

export const updateModuleSchema = moduleBodyBase.partial();

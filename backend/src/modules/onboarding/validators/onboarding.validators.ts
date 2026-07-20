/**
 * @file src/modules/onboarding/validators/onboarding.validators.ts
 */

import { z } from 'zod';

export const tutorialKeyParamSchema = z.object({
  tutorialKey: z
    .string()
    .min(3)
    .max(100)
    .regex(
      /^[a-z0-9_]+$/,
      'tutorialKey must be lowercase letters, numbers, and underscores'
    ),
});

export const markMilestoneSchema = z.object({
  milestoneKey: z
    .string()
    .min(3)
    .max(100)
    .regex(
      /^[a-z0-9_]+$/,
      'milestoneKey must be lowercase letters, numbers, and underscores'
    ),
});

/**
 * @file src/modules/onboarding/routes/onboarding.routes.ts
 * @description
 * Onboarding Routes
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { OnboardingController } from '../controllers/onboarding.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import {
  tutorialKeyParamSchema,
  markMilestoneSchema,
} from '../validators/onboarding.validators.js';

const router = Router();

router.use(authenticate);

router.get('/progress', asyncHandler(OnboardingController.getProgress));
router.post(
  '/tutorial/:tutorialKey/complete',
  validateRequest({ schema: tutorialKeyParamSchema, target: 'params' }),
  asyncHandler(OnboardingController.completeTutorial)
);
router.post(
  '/milestone',
  validateRequest({ schema: markMilestoneSchema, target: 'body' }),
  asyncHandler(OnboardingController.markMilestone)
);

export default router;

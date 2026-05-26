/**
 * @file src/modules/education/routes/education.routes.ts
 * @description Education Routes
 * Route order: /search before /:moduleId to avoid parameterised shadowing.
 * Version: 1.0 — March 2026
 */

import { Router } from 'express';
import { EducationController } from '../controllers/education.controller.js';
import {
  authenticate,
  optionalAuthenticate,
} from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import {
  listModulesSchema,
  moduleIdParamSchema,
  completeModuleSchema,
  submitReviewSchema,
} from '../validators/education.validators.js';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────

router.get(
  '/',
  validateRequest({ schema: listModulesSchema, target: 'query' }),
  asyncHandler(EducationController.listModules)
);

// ── Authenticated routes (static paths before /:moduleId) ─────────────────────

router.get(
  '/my-progress',
  authenticate,
  asyncHandler(EducationController.getMyProgress)
);

router.get(
  '/:moduleId',
  optionalAuthenticate,
  validateRequest({ schema: moduleIdParamSchema, target: 'params' }),
  asyncHandler(EducationController.getModule)
);

// ── Authenticated module actions ──────────────────────────────────────────────

router.post(
  '/:moduleId/start',
  authenticate,
  validateRequest({ schema: moduleIdParamSchema, target: 'params' }),
  asyncHandler(EducationController.startModule)
);

router.post(
  '/:moduleId/complete',
  authenticate,
  validateRequest({ schema: moduleIdParamSchema, target: 'params' }),
  validateRequest({ schema: completeModuleSchema, target: 'body' }),
  asyncHandler(EducationController.completeModule)
);

router.post(
  '/:moduleId/review',
  authenticate,
  validateRequest({ schema: moduleIdParamSchema, target: 'params' }),
  validateRequest({ schema: submitReviewSchema, target: 'body' }),
  asyncHandler(EducationController.submitReview)
);

export default router;

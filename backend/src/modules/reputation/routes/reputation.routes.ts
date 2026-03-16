/**
 * @file src/modules/reputation/routes/reputation.routes.ts
 * @description Reputation Routes
 * Version: 1.0 — March 2026
 */

import { Router } from 'express';
import { ReputationController } from '../controllers/reputation.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import {
  userIdParamSchema,
  historyQuerySchema,
} from '../validators/reputation.validators.js';

const router = Router();

// GET /reputation/me — authenticated
router.get(
  '/me',
  authenticate,
  asyncHandler(ReputationController.getMyReputation)
);

// GET /reputation/me/history — authenticated
router.get(
  '/me/history',
  authenticate,
  validateRequest({ schema: historyQuerySchema, target: 'query' }),
  asyncHandler(ReputationController.getMyHistory)
);

// GET /reputation/:userId — public
router.get(
  '/:userId',
  validateRequest({ schema: userIdParamSchema, target: 'params' }),
  asyncHandler(ReputationController.getUserReputation)
);

export default router;

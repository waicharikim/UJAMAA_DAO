/**
 * @file src/modules/community/routes/conflict.routes.ts
 * @description Conflict Case Routes
 */

import { Router } from 'express';
import { ConflictController } from '../controllers/conflict.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { z } from 'zod';
import { asyncHandler } from '../../../core/utils/response.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validateRequest({
    schema: z.object({
      respondentId: z.string().uuid(),
      description: z.string().min(20).max(2000),
      evidence: z.array(z.string()).max(5).optional(),
    }),
    target: 'body',
  }),
  asyncHandler(ConflictController.fileConflict)
);

router.get('/my-cases', asyncHandler(ConflictController.listMyCases));

router.get('/:caseId', asyncHandler(ConflictController.getCase));

router.patch(
  '/:caseId/resolve',
  validateRequest({
    schema: z.object({
      resolution: z.string().min(10).max(2000),
    }),
    target: 'body',
  }),
  asyncHandler(ConflictController.resolveCase)
);

export default router;

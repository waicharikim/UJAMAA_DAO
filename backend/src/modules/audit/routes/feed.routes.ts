/**
 * @file src/modules/audit/routes/feed.routes.ts
 * @description
 * Public activity feed route — accessible to all authenticated users.
 * Separate from audit.routes.ts which is admin-only.
 */

import { Router } from 'express';
import { FeedController } from '../controllers/feed.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { asyncHandler } from '../../../core/utils/response.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(FeedController.getFeed));

export default router;

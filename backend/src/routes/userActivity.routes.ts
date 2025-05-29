/**
 * @file userActivity.routes.ts
 *
 * @description
 * Routes for user activity logs.
 * - Protected by authentication.
 * - Restricted to admin access roles.
 */

import express from 'express';
import * as userActivityController from '../controllers/userActivity.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { ADMIN_ACCESS_ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/:userId',
  authorize(ADMIN_ACCESS_ROLES),
  userActivityController.getUserActivityLogsHandler,
);

export default router;
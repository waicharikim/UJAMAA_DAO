/**
 * @file userAudit.routes.ts
 *
 * @description
 * Routes for user audit logs.
 * - Protected by authentication.
 * - Restricted to admin access roles.
 */

import express from 'express';
import * as auditController from '../controllers/userAudit.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { ADMIN_ACCESS_ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/:userId',
  authorize(ADMIN_ACCESS_ROLES),
  auditController.getUserAuditLogsHandler,
);

export default router;
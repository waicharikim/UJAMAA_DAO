/**
 * @file userPrivacy.routes.ts
 *
 * @description
 * Routes for managing user privacy settings and audit logs.
 * - User endpoints protected by authentication.
 * - Admin-only routes for audit log access.
 */

import express from 'express';
import * as userAuditController from '../controllers/userAudit.controller.js';
import * as userPrivacyController from '../controllers/userPrivacy.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// User privacy settings
router.get('/me/privacy', userPrivacyController.getPrivacySettingsHandler);
router.patch('/me/privacy', userPrivacyController.updatePrivacySettingsHandler);

// Admin route to get user's audit log, restricted to super admins
router.get(
  '/:userId/audit-log',
  authorize(['system:super_admin']),
  userAuditController.getUserAuditLogsHandler,
);

export default router;
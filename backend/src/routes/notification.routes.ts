/**
 * @file notification.routes.ts
 *
 * @description
 * Defines routes for managing user notification preferences.
 * All routes require authentication.
 */

import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';
import { USER_ACCESS_ROLES } from '../constants/roles.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/preferences', notificationController.getNotificationPreferencesHandler);

router.patch('/preferences', authorize(USER_ACCESS_ROLES), notificationController.updateNotificationPreferenceHandler);

export default router;
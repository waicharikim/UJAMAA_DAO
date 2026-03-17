/**
 * @file src/modules/notifications/routes/notification.routes.ts
 * @description
 * Notification Routes
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { z } from 'zod';
import { asyncHandler } from '../../../core/utils/response.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(NotificationController.getNotifications));

router.get(
  '/unread-count',
  asyncHandler(NotificationController.getUnreadCount)
);

router.post(
  '/mark-read',
  validateRequest({
    schema: z.object({
      notificationId: z.string().uuid(),
    }),
    target: 'body',
  }),
  asyncHandler(NotificationController.markAsRead)
);

router.post('/mark-all-read', asyncHandler(NotificationController.markAllRead));

router.get('/preferences', asyncHandler(NotificationController.getPreferences));

router.put(
  '/preferences',
  validateRequest({
    schema: z.object({
      channel: z.string().min(1),
      category: z.string().min(1),
      enabled: z.boolean(),
    }),
    target: 'body',
  }),
  asyncHandler(NotificationController.updatePreference)
);

export default router;

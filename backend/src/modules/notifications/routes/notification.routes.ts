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
import { asyncHandler, sendSuccess } from '../../../core/utils/response.js';
import { pushService } from '../services/push.service.js';

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

// ── Web Push ──────────────────────────────────────────────────────────────────

router.get('/push/vapid-public-key', asyncHandler(async (_req, res) => {
  sendSuccess(res, { publicKey: pushService.getPublicKey() });
}));

router.post(
  '/push/subscribe',
  validateRequest({
    schema: z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string().min(1),
        auth:   z.string().min(1),
      }),
    }),
    target: 'body',
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const userAgent = req.headers['user-agent'];
    const sub = await pushService.subscribe(userId, req.body, userAgent);
    sendSuccess(res, { id: sub.id }, 'Push subscription registered');
  })
);

router.delete(
  '/push/unsubscribe',
  validateRequest({
    schema: z.object({ endpoint: z.string().url() }),
    target: 'body',
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    await pushService.unsubscribe(userId, req.body.endpoint);
    sendSuccess(res, null, 'Unsubscribed');
  })
);

export default router;

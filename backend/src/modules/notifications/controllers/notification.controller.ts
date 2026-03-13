/**
 * @file src/modules/notifications/controllers/notification.controller.ts
 * @description
 * Notification Controller
 * Version: 2.0 — December 2025
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { notificationService } from '../services/notification.service.js';

export class NotificationController {
  static async getNotifications(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const unreadOnly = req.query.unread === 'true';
    const notifications = await notificationService.getUserNotifications(
      userId,
      unreadOnly
    );
    sendSuccess(res, notifications, 'Notifications retrieved');
  }

  static async markAsRead(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { notificationId } = req.body;
    await notificationService.markAsRead(userId, notificationId);
    sendSuccess(res, null, 'Notification marked as read');
  }

  static async getUnreadCount(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const count = await notificationService.getUnreadCount(userId);
    sendSuccess(res, { count });
  }
}

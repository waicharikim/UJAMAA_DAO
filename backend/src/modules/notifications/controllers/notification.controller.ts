/**
 * @file src/modules/notifications/controllers/notification.controller.ts
 * @description
 * Notification Controller
 * Version: 2.0 — December 2025
 */

import { Request, Response } from "express";
import { sendSuccess } from "../../../core/utils/response.js";
import { notificationService } from "../services/notification.service.js";

export class NotificationController {
  static async getNotifications(req: Request, res: Response) {
    const userId = req.user!.userId;
    const unreadOnly = req.query.unread === "true";
    const notifications = await notificationService.getUserNotifications(userId, unreadOnly);
    sendSuccess(res, notifications, "Notifications retrieved");
  }

  static async markAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { notificationId } = req.body;
    await notificationService.markAsRead(userId, notificationId);
    sendSuccess(res, null, "Notification marked as read");
  }
}
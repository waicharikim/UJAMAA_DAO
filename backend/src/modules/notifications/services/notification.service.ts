/**
 * @file src/modules/notifications/services/notification.service.ts
 * @description
 * Notification Service — Multi-Channel Alerts
 *
 * Handles:
 * - Send notifications (email, SMS, in-app)
 * - Preference check
 * - Log delivery
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from "../../../core/database/client.js";
import { sendEmail } from "../../../core/utils/email.service.js"; // We'll add SMS later
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { NotificationType, NotificationChannel, SendNotificationDto } from "../types.js";

class NotificationService {
  /**
   * Send notification with preference check
   */
  async send(dto: SendNotificationDto) {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId: dto.userId },
    });

    const channels = dto.channels || this.getDefaultChannels(dto.type);

    const allowedChannels = channels.filter(channel => {
      if (!preferences) return true; // Default allow all
      switch (channel) {
        case "EMAIL": return preferences.emailEnabled;
        case "SMS": return preferences.smsEnabled;
        case "IN_APP": return preferences.inAppEnabled;
        case "PUSH": return preferences.pushEnabled;
        default: return true;
      }
    });

    if (allowedChannels.length === 0) {
      logger.info({ userId: dto.userId, type: dto.type }, "Notification skipped — all channels disabled");
      return;
    }

    // Create in-app record
    await prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data ? JSON.parse(JSON.stringify(dto.data)) : undefined,
        read: false,
      },
    });

    // Send email if allowed
    if (allowedChannels.includes("EMAIL")) {
      const user = await prisma.user.findUnique({
        where: { id: dto.userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: dto.title,
          text: dto.message,
          html: `<p>${dto.message}</p>`, // Simple template
        });
      }
    }

    // SMS/PUSH to be added later

    logger.info(
      { userId: dto.userId, type: dto.type, channels: allowedChannels },
      "Notification sent"
    );
  }

  private getDefaultChannels(type: NotificationType): NotificationChannel[] {
    switch (type) {
      case NotificationType.DUES_OVERDUE:
      case NotificationType.DUES_REMINDER:
        return ["EMAIL", "SMS", "IN_APP"];
      case NotificationType.PROPOSAL_PASSED:
      case NotificationType.PROJECT_MILESTONE_VERIFIED:
        return ["EMAIL", "IN_APP"];
      default:
        return ["IN_APP"];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}

export const notificationService = new NotificationService();
/**
 * @file src/modules/notifications/services/notification.service.ts
 * @description
 * Notification Service — Multi-Channel Alerts
 *
 * Version: 2.2 — March 2026
 * Updated: Export class for testability; map read → isRead in responses
 */

import { NotificationType as PrismaNotificationType } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { sendEmail } from '../../../core/utils/email.service.js';
import { logger } from '../../../core/logger/logger.js';
import {
  NotificationType,
  NotificationChannel,
  SendNotificationDto,
  NotificationResponseDto,
} from '../types.js';

export class NotificationService {
  /**
   * Send notification with preference check
   */
  async send(dto: SendNotificationDto) {
    const channels = dto.channels || this.getDefaultChannels(dto.type);

    // Check per-channel preferences
    const allowedChannels: NotificationChannel[] = [];
    for (const channel of channels) {
      const pref = await prisma.notificationPreference.findFirst({
        where: { userId: dto.userId, channel, enabled: false },
      });
      if (!pref) allowedChannels.push(channel); // Not explicitly disabled = allowed
    }

    if (allowedChannels.length === 0) {
      logger.info(
        { userId: dto.userId, type: dto.type },
        'Notification skipped — all channels disabled'
      );
      return;
    }

    // Create in-app record — map local type to Prisma schema type
    await prisma.notification.create({
      data: {
        userId: dto.userId,
        type: this.toPrismaType(dto.type),
        title: dto.title,
        message: dto.message,
        metadata: dto.data ? JSON.parse(JSON.stringify(dto.data)) : undefined,
        read: false,
      },
    });

    // Send email if allowed
    if (allowedChannels.includes(NotificationChannel.EMAIL)) {
      const user = await prisma.user.findUnique({
        where: { id: dto.userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: dto.title,
          text: dto.message,
          html: `<p>${dto.message}</p>`,
        });
      }
    }

    logger.info(
      { userId: dto.userId, type: dto.type, channels: allowedChannels },
      'Notification sent'
    );
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  /**
   * Get user's notifications, mapping Prisma `read` → `isRead` for frontend
   */
  async getUserNotifications(
    userId: string,
    unreadOnly = false
  ): Promise<NotificationResponseDto[]> {
    const rows = await prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.read,
      metadata: n.metadata as Record<string, unknown> | null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  /**
   * Count unread notifications for the bell badge
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  private toPrismaType(type: NotificationType): PrismaNotificationType {
    switch (type) {
      case NotificationType.DUES_REMINDER:
      case NotificationType.DUES_OVERDUE:
        return PrismaNotificationType.ECONOMIC;
      case NotificationType.PROPOSAL_NEW:
      case NotificationType.PROPOSAL_VOTING_STARTED:
      case NotificationType.PROPOSAL_VOTE_CAST:
      case NotificationType.PROPOSAL_PASSED:
        return PrismaNotificationType.PROPOSAL;
      default:
        return PrismaNotificationType.SYSTEM;
    }
  }

  private getDefaultChannels(type: NotificationType): NotificationChannel[] {
    switch (type) {
      case NotificationType.DUES_OVERDUE:
      case NotificationType.DUES_REMINDER:
        return [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.IN_APP,
        ];
      case NotificationType.PROPOSAL_PASSED:
      case NotificationType.PROJECT_MILESTONE_VERIFIED:
        return [NotificationChannel.EMAIL, NotificationChannel.IN_APP];
      default:
        return [NotificationChannel.IN_APP];
    }
  }
}

export const notificationService = new NotificationService();

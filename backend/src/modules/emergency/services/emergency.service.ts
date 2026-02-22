/**
 * @file src/modules/emergency/services/emergency.service.ts
 * @description
 * Emergency Response Service — Rapid Crisis Coordination
 *
 * Version: 2.1 — February 2026
 * Updated: Align with actual Prisma schema field names
 */

import {
  EmergencyType as PrismaEmergencyType,
  EmergencySeverity,
} from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import { notificationService } from '../../notifications/services/notification.service.js';
import {
  NotificationType,
  NotificationChannel,
} from '../../notifications/types.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { ReportEmergencyDto } from '../types.js';

const EMERGENCY_PR_COST = 10;

class EmergencyService {
  /**
   * Report emergency — spend small PR, alert local admins + members
   */
  async reportEmergency(userId: string, dto: ReportEmergencyDto) {
    await participationRightsService.spend(
      userId,
      EMERGENCY_PR_COST,
      ParticipationRightsReason.EMERGENCY_REPORTED,
      { type: dto.type, wardId: dto.locationWardId }
    );

    const alert = await prisma.emergencyAlert.create({
      data: {
        reporterId: userId,
        // Map local emergency types to Prisma schema types (best-effort)
        emergencyType: PrismaEmergencyType.ENVIRONMENTAL,
        severity: EmergencySeverity.HIGH,
        title: `Emergency: ${dto.type}`,
        description: dto.description,
        location: dto.locationWardId ?? 'Unknown',
        neededResources: {},
        availableResources: {},
        status: 'ACTIVE',
      },
    });

    const nearbyMembers = await prisma.groupMember.findMany({
      where: {
        group: { wardId: dto.locationWardId },
        active: true,
      },
      select: { userId: true },
      take: 50,
    });

    const recipients = new Set(nearbyMembers.map((m) => m.userId));

    for (const recipientId of recipients) {
      await notificationService.send({
        userId: recipientId,
        type: NotificationType.GENERAL_ANNOUNCEMENT,
        title: `Emergency Reported: ${dto.type}`,
        message: dto.description,
        data: { alertId: alert.id, wardId: dto.locationWardId },
        channels: [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.IN_APP,
        ],
      });
    }

    logger.info(
      { userId, alertId: alert.id, type: dto.type },
      'Emergency reported'
    );

    return alert;
  }

  /**
   * Respond to emergency (admin/member)
   */
  async respondToEmergency(userId: string, alertId: string, message: string) {
    const alert = await prisma.emergencyAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) throw ApiError.notFound('Emergency Alert');

    const response = await prisma.emergencyResponse.create({
      data: {
        emergencyId: alertId,
        userId,
        role: 'RESPONDER',
        notes: message,
      },
    });

    logger.info({ userId, alertId, message }, 'Emergency response recorded');

    return response;
  }
}

export const emergencyService = new EmergencyService();

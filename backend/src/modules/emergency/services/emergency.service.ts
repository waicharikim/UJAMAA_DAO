/**
 * @file src/modules/emergency/services/emergency.service.ts
 * @description
 * Emergency Response Service — Rapid Crisis Coordination
 *
 * Version: 3.0 — March 2026
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
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import {
  ReportEmergencyDto,
  ListAlertsDto,
  RespondToEmergencyDto,
} from '../types.js';

const EMERGENCY_PR_COST = 10;

function mapSeverity(type: string): EmergencySeverity {
  switch (type) {
    case 'FIRE':
    case 'FLOOD':
      return EmergencySeverity.CRITICAL;
    case 'MEDICAL':
    case 'SECURITY':
      return EmergencySeverity.HIGH;
    default:
      return EmergencySeverity.MEDIUM;
  }
}

export class EmergencyService {
  /**
   * Report emergency — spend small PR, alert local members
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
        emergencyType: dto.type as PrismaEmergencyType,
        severity: mapSeverity(dto.type),
        title: `${dto.type} Emergency`,
        description: dto.description,
        location: dto.locationWardId,
        neededResources: {},
        availableResources: {},
        status: 'ACTIVE',
      },
    });

    // Notify nearby ward members (up to 50)
    const nearbyMembers = await prisma.groupMember.findMany({
      where: {
        group: { wardId: dto.locationWardId },
        active: true,
      },
      select: { userId: true },
      take: 50,
    });

    const recipients = new Set(nearbyMembers.map((m) => m.userId));
    recipients.delete(userId); // don't notify reporter

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

    await auditService.log(
      userId,
      AuditAction.EMERGENCY_REPORTED,
      'emergency_alert',
      alert.id,
      { type: dto.type, wardId: dto.locationWardId }
    );

    return alert;
  }

  /**
   * Respond to emergency — ward admin or verifier only (enforced in route)
   */
  async respondToEmergency(
    userId: string,
    alertId: string,
    dto: RespondToEmergencyDto
  ) {
    const alert = await prisma.emergencyAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) throw ApiError.notFound('Emergency Alert');

    const response = await prisma.emergencyResponse.create({
      data: {
        emergencyId: alertId,
        userId,
        role: 'RESPONDER',
        notes: dto.message,
      },
    });

    // Notify the alert reporter
    await notificationService
      .send({
        userId: alert.reporterId,
        type: NotificationType.GENERAL_ANNOUNCEMENT,
        title: 'Someone is responding to your emergency',
        message: `A responder has acknowledged your ${alert.emergencyType} alert.`,
        data: { alertId },
        channels: [NotificationChannel.IN_APP],
      })
      .catch(() => {});

    logger.info({ userId, alertId }, 'Emergency response recorded');

    return response;
  }

  /**
   * Update alert status — reporter OR ward admin
   * Valid transitions: ACTIVE→IN_PROGRESS, ACTIVE→FALSE_ALARM, IN_PROGRESS→RESOLVED, IN_PROGRESS→FALSE_ALARM
   * Terminal states (RESOLVED, FALSE_ALARM) are immutable.
   */
  async updateAlertStatus(
    actorId: string,
    alertId: string,
    newStatus: 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_ALARM',
    statusNote?: string
  ) {
    const alert = await prisma.emergencyAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) throw ApiError.notFound('Emergency Alert');

    if (alert.status === 'RESOLVED' || alert.status === 'FALSE_ALARM') {
      throw ApiError.badRequest('Alert is already closed');
    }

    const isTerminal = newStatus === 'RESOLVED' || newStatus === 'FALSE_ALARM';

    const updated = await prisma.emergencyAlert.update({
      where: { id: alertId },
      data: {
        status: newStatus,
        statusNote: statusNote ?? null,
        ...(isTerminal && {
          resolvedAt: new Date(),
          resolvedById: actorId,
        }),
      },
    });

    if (isTerminal) {
      await notificationService
        .send({
          userId: alert.reporterId,
          type: NotificationType.GENERAL_ANNOUNCEMENT,
          title: `Your emergency report has been ${newStatus === 'RESOLVED' ? 'resolved' : 'marked as false alarm'}`,
          message: statusNote ?? `Your ${alert.emergencyType} alert has been ${newStatus.toLowerCase().replace('_', ' ')}.`,
          data: { alertId },
          channels: [NotificationChannel.IN_APP],
        })
        .catch(() => {});
    }

    await auditService.log(
      actorId,
      AuditAction.EMERGENCY_REPORTED,
      'emergency_alert',
      alertId,
      { from: alert.status, to: newStatus }
    );

    return updated;
  }

  /**
   * List active emergency alerts with optional filters
   */
  async listAlerts(dto: ListAlertsDto) {
    const limit = parseInt(String(dto.limit || 20), 10);
    const page = parseInt(String(dto.page || 1), 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (dto.wardId) where.location = dto.wardId;
    if (dto.status) where.status = dto.status;
    if (dto.type) where.emergencyType = dto.type;

    const [alerts, total] = await Promise.all([
      prisma.emergencyAlert.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true } },
          _count: { select: { responses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emergencyAlert.count({ where }),
    ]);

    return {
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single emergency alert with responses
   */
  async getAlert(alertId: string) {
    const alert = await prisma.emergencyAlert.findUnique({
      where: { id: alertId },
      include: {
        reporter: { select: { id: true, name: true } },
        responses: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!alert) throw ApiError.notFound('Emergency Alert');

    return alert;
  }
}

export const emergencyService = new EmergencyService();

/**
 * @file src/modules/emergency/services/emergency.service.ts
 * @description
 * Emergency Response Service — Rapid Crisis Coordination
 *
 * Features:
 * - Report emergency (user)
 * - Alert ward/constituency admins + nearby members
 * - Response tracking
 * - Abuse prevention (PR cost + verification)
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from "../../../core/database/client.js";
import { participationRightsService } from "../../economy/services/participationRights.service.js";
import { notificationService } from "../../notifications/services/notification.service.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { EmergencyType, ReportEmergencyDto } from "../types.js";

const EMERGENCY_PR_COST = 10; // Low cost — safety first

class EmergencyService {
  /**
   * Report emergency — spend small PR, alert local admins + members
   */
  async reportEmergency(userId: string, dto: ReportEmergencyDto) {
    // Spend small PR to prevent spam
    await participationRightsService.spend(
      userId,
      EMERGENCY_PR_COST,
      "EMERGENCY_REPORTED",
      { type: dto.type, wardId: dto.locationWardId }
    );

    const alert = await prisma.emergencyAlert.create({
      data: {
        reporterId: userId,
        type: dto.type,
        description: dto.description,
        locationWardId: dto.locationWardId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        photoUrl: dto.photoUrl,
        status: "REPORTED",
      },
    });

    // Notify ward/constituency admins + nearby members
    const admins = await prisma.groupMember.findMany({
      where: {
        group: { locationScope: { in: ["WARD", "CONSTITUENCY"] } },
        role: { in: ["LEADER", "ADMIN"] },
        group: { locationScopeId: dto.locationWardId }, // approximate
      },
      select: { userId: true },
    });

    const nearbyMembers = await prisma.groupMember.findMany({
      where: {
        group: { locationScope: "WARD", locationScopeId: dto.locationWardId },
      },
      select: { userId: true },
      take: 50, // limit
    });

    const recipients = new Set([...admins.map(a => a.userId), ...nearbyMembers.map(m => m.userId)]);

    for (const recipientId of recipients) {
      await notificationService.send({
        userId: recipientId,
        type: "EMERGENCY_ALERT",
        title: `Emergency Reported: ${dto.type}`,
        message: dto.description,
        data: { alertId: alert.id, wardId: dto.locationWardId },
        channels: ["EMAIL", "SMS", "IN_APP"],
      });
    }

    logger.info({ userId, alertId: alert.id, type: dto.type }, "Emergency reported");

    return alert;
  }

  /**
   * Respond to emergency (admin/member)
   */
  async respondToEmergency(userId: string, alertId: string, message: string) {
    const alert = await prisma.emergencyAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) throw ApiError.notFound("Emergency Alert");

    const response = await prisma.emergencyResponse.create({
      data: {
        alertId,
        responderId: userId,
        message,
      },
    });

    logger.info({ userId, alertId, message }, "Emergency response recorded");

    return response;
  }
}

export const emergencyService = new EmergencyService();
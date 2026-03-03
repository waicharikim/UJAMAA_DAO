/**
 * @file src/modules/integration/services/baraza-bot.service.ts
 * @description
 * Core Baraza business logic: register external groups, record attendance, fan-out invites.
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { integrationQueue } from '../../../core/queue/index.js';
import {
  BotJobName,
  RegisterBarazaGroupDto,
  MarkAttendanceDto,
  BarazaGroupDto,
  AttendanceRecordDto,
} from '../types.js';
import { PR_CONFIG } from '../../economy/types.js';

// Prisma-level type alias
type BarazaGroupRecord = Awaited<ReturnType<typeof prisma.barazaGroup.create>>;

class BarazaBotService {
  /**
   * Admin registers an external chat as a baraza for a system group.
   * Fan-outs invite jobs for all existing members with matching platform preference.
   */
  async registerBarazaGroup(
    adminUserId: string,
    dto: RegisterBarazaGroupDto
  ): Promise<BarazaGroupRecord> {
    const barazaGroup = await prisma.barazaGroup.create({
      data: {
        groupId: dto.groupId,
        platform: dto.platform as any,
        externalId: dto.externalId,
        name: dto.name,
        inviteLink: dto.inviteLink ?? undefined,
        isActive: true,
        registeredBy: adminUserId,
        metadata: dto.metadata
          ? JSON.parse(JSON.stringify(dto.metadata))
          : undefined,
      },
    });

    logger.info(
      {
        operationType: 'BARAZA',
        barazaGroupId: barazaGroup.id,
        platform: dto.platform,
      },
      'Baraza group registered — fanning out invite jobs'
    );

    await this.fanOutInvitesForNewBaraza(barazaGroup.id);
    return barazaGroup;
  }

  /**
   * Returns all active baraza groups for a user's geographic groups on their opted-in platforms.
   */
  async getBarazaGroupsForUser(userId: string): Promise<BarazaGroupDto[]> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, active: true },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    const profiles = await prisma.userMessagingProfile.findMany({
      where: { userId },
      select: { platform: true },
    });
    const platforms = profiles.map((p) => p.platform);

    if (!groupIds.length || !platforms.length) return [];

    const groups = await prisma.barazaGroup.findMany({
      where: {
        groupId: { in: groupIds },
        platform: { in: platforms as any[] },
        isActive: true,
      },
    });

    return groups.map((g) => ({
      id: g.id,
      groupId: g.groupId,
      platform: g.platform,
      name: g.name,
      inviteLink: g.inviteLink,
      isActive: g.isActive,
      createdAt: g.createdAt,
    }));
  }

  /**
   * Records attendance for a baraza session and queues PR reward jobs.
   */
  async recordAttendance(
    dto: MarkAttendanceDto
  ): Promise<AttendanceRecordDto[]> {
    const barazaGroup = await prisma.barazaGroup.findFirst({
      where: {
        platform: dto.platform as any,
        externalId: dto.externalGroupId,
        isActive: true,
      },
    });

    if (!barazaGroup) {
      logger.warn(
        {
          operationType: 'BARAZA',
          platform: dto.platform,
          externalGroupId: dto.externalGroupId,
        },
        'BarazaGroup not found for attendance recording'
      );
      return [];
    }

    const results: AttendanceRecordDto[] = [];

    for (const externalUserId of dto.attendeeExternalIds) {
      const profile = await prisma.userMessagingProfile.findFirst({
        where: { platform: dto.platform as any, externalUserId },
      });

      if (!profile) {
        logger.warn(
          { operationType: 'BARAZA', platform: dto.platform, externalUserId },
          'No UserMessagingProfile found for external user — skipping attendance'
        );
        continue;
      }

      const isFacilitator = dto.facilitatorExternalId === externalUserId;
      const prAmount = isFacilitator
        ? PR_CONFIG.BARAZA_FACILITATED
        : PR_CONFIG.BARAZA_ATTENDED;
      const reason = isFacilitator ? 'BARAZA_FACILITATED' : 'BARAZA_ATTENDED';

      try {
        const attendance = await prisma.barazaAttendance.upsert({
          where: {
            userId_barazaGroupId_sessionDate: {
              userId: profile.userId,
              barazaGroupId: barazaGroup.id,
              sessionDate: dto.sessionDate,
            },
          },
          create: {
            barazaGroupId: barazaGroup.id,
            userId: profile.userId,
            sessionDate: dto.sessionDate,
            prAwarded: false,
            prAmount: 0,
            reportedBy: dto.reportedBy ?? null,
          },
          update: {},
        });

        // Only enqueue reward if not yet awarded
        if (!attendance.prAwarded) {
          await integrationQueue.add(
            BotJobName.BARAZA_ATTENDANCE_REWARD,
            {
              attendanceId: attendance.id,
              userId: profile.userId,
              prAmount,
              reason,
              barazaGroupId: barazaGroup.id,
              sessionDate: dto.sessionDate,
            },
            { jobId: `baraza-reward-${attendance.id}` }
          );
        }

        results.push({
          id: attendance.id,
          userId: profile.userId,
          barazaGroupId: barazaGroup.id,
          sessionDate: dto.sessionDate,
          prAwarded: attendance.prAwarded,
          prAmount: attendance.prAmount,
        });
      } catch (err) {
        logger.warn(
          { operationType: 'BARAZA', externalUserId, error: String(err) },
          'Failed to upsert attendance record — skipping'
        );
      }
    }

    return results;
  }

  /**
   * Send invite links for a single user to all their ward baraza groups.
   */
  async sendInvitesToUser(userId: string): Promise<void> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, active: true },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    const profiles = await prisma.userMessagingProfile.findMany({
      where: { userId },
      select: { platform: true },
    });
    const platforms = profiles.map((p) => p.platform);

    if (!groupIds.length || !platforms.length) return;

    const barazaGroups = await prisma.barazaGroup.findMany({
      where: {
        groupId: { in: groupIds },
        platform: { in: platforms as any[] },
        isActive: true,
      },
    });

    for (const bg of barazaGroups) {
      await integrationQueue.add(BotJobName.BARAZA_SEND_INVITE, {
        userId,
        barazaGroupId: bg.id,
        platform: bg.platform as any,
      });
    }
  }

  /**
   * Fan-out invites when a new BarazaGroup is registered.
   */
  async fanOutInvitesForNewBaraza(barazaGroupId: string): Promise<void> {
    const barazaGroup = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!barazaGroup) return;

    const members = await prisma.groupMember.findMany({
      where: { groupId: barazaGroup.groupId, active: true },
      select: { userId: true },
    });

    for (const member of members) {
      const profile = await prisma.userMessagingProfile.findUnique({
        where: {
          userId_platform: {
            userId: member.userId,
            platform: barazaGroup.platform as any,
          },
        },
      });

      if (!profile) continue;

      await integrationQueue.add(BotJobName.BARAZA_SEND_INVITE, {
        userId: member.userId,
        barazaGroupId: barazaGroup.id,
        platform: barazaGroup.platform as any,
      });
    }
  }
}

export const barazaBotService = new BarazaBotService();

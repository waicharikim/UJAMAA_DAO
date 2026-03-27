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
  BarazaSessionDto,
  BarazaSessionReminderJobData,
} from '../types.js';
import { PR_CONFIG } from '../../economy/types.js';
import {
  NotificationType,
  NotificationChannel,
} from '../../notifications/types.js';
import { notificationService } from '../../notifications/services/notification.service.js';

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
    // For Telegram groups without an explicit invite link, auto-generate one via the Bot API
    let inviteLink = dto.inviteLink ?? undefined;
    if (dto.platform === 'TELEGRAM' && !inviteLink) {
      inviteLink = await this.createTelegramInviteLink(dto.externalId);
    }

    const barazaGroup = await prisma.barazaGroup.create({
      data: {
        groupId: dto.groupId,
        platform: dto.platform as any,
        externalId: dto.externalId,
        name: dto.name,
        inviteLink,
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

    if (!groupIds.length) return [];

    // Return ALL active baraza groups for groups the user is a member of,
    // regardless of whether they have a linked messaging profile.
    // This lets users discover and join Telegram/Discord groups before linking.
    const groups = await prisma.barazaGroup.findMany({
      where: {
        groupId: { in: groupIds },
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
   * Creates a BarazaSession and queues a 1-hour reminder job.
   * Returns the session record.
   */
  async scheduleSession(
    barazaGroupId: string,
    scheduledAt: Date,
    createdBy: string
  ): Promise<BarazaSessionDto> {
    const session = await prisma.barazaSession.create({
      data: { barazaGroupId, scheduledAt, createdBy },
    });

    // Queue a delayed reminder job — fires 1 hour before scheduled time
    const delay = scheduledAt.getTime() - Date.now() - 60 * 60 * 1000;
    if (delay > 0) {
      const barazaGroup = await prisma.barazaGroup.findUnique({
        where: { id: barazaGroupId },
      });
      if (barazaGroup) {
        const payload: BarazaSessionReminderJobData = {
          barazaSessionId: session.id,
          barazaGroupId,
          chatId: barazaGroup.externalId,
        };
        const job = await integrationQueue.add(
          BotJobName.BARAZA_SESSION_REMINDER,
          payload,
          {
            delay,
            jobId: `baraza-reminder-${session.id}`,
          }
        );
        // Persist the BullMQ job ID so it can be cancelled if needed
        await prisma.barazaSession.update({
          where: { id: session.id },
          data: { reminderJobId: job.id ?? null },
        });
      }
    }

    logger.info(
      { operationType: 'BARAZA_SCHEDULE', barazaGroupId, scheduledAt },
      'Baraza session scheduled'
    );

    return {
      id: session.id,
      barazaGroupId: session.barazaGroupId,
      scheduledAt: session.scheduledAt,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      createdBy: session.createdBy,
      createdAt: session.createdAt,
    };
  }

  /**
   * Mark the upcoming session for a baraza group as open.
   */
  async openSession(barazaGroupId: string): Promise<BarazaSessionDto | null> {
    const session = await prisma.barazaSession.findFirst({
      where: { barazaGroupId, openedAt: null, closedAt: null },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!session) return null;

    const updated = await prisma.barazaSession.update({
      where: { id: session.id },
      data: { openedAt: new Date() },
    });

    logger.info(
      { operationType: 'BARAZA_OPEN', barazaGroupId, sessionId: session.id },
      'Baraza session opened'
    );

    return {
      id: updated.id,
      barazaGroupId: updated.barazaGroupId,
      scheduledAt: updated.scheduledAt,
      openedAt: updated.openedAt,
      closedAt: updated.closedAt,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Close the currently open session for a baraza group.
   * Returns the session and attendance count.
   */
  async closeSession(
    barazaGroupId: string
  ): Promise<{ session: BarazaSessionDto; attendanceCount: number } | null> {
    const session = await prisma.barazaSession.findFirst({
      where: { barazaGroupId, openedAt: { not: null }, closedAt: null },
    });
    if (!session) return null;

    const [updated, attendanceCount] = await Promise.all([
      prisma.barazaSession.update({
        where: { id: session.id },
        data: { closedAt: new Date() },
      }),
      prisma.barazaAttendance.count({
        where: {
          barazaGroupId,
          sessionDate: new Date().toISOString().slice(0, 10),
        },
      }),
    ]);

    logger.info(
      {
        operationType: 'BARAZA_CLOSE',
        barazaGroupId,
        sessionId: session.id,
        attendanceCount,
      },
      'Baraza session closed'
    );

    return {
      session: {
        id: updated.id,
        barazaGroupId: updated.barazaGroupId,
        scheduledAt: updated.scheduledAt,
        openedAt: updated.openedAt,
        closedAt: updated.closedAt,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt,
      },
      attendanceCount,
    };
  }

  /**
   * Returns the currently open session for a baraza group, or null.
   */
  async getOpenSession(barazaGroupId: string) {
    return prisma.barazaSession.findFirst({
      where: { barazaGroupId, openedAt: { not: null }, closedAt: null },
    });
  }

  /**
   * Notify all members of a group via platform + email.
   * Telegram DMs are sent directly in the controller/job to reuse sendTelegramMessage.
   */
  async notifyGroupMembers(
    barazaGroupId: string,
    title: string,
    message: string
  ): Promise<void> {
    const barazaGroup = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
      include: {
        group: { include: { members: { select: { userId: true } } } },
      },
    });
    if (!barazaGroup) return;

    const memberIds = barazaGroup.group.members.map((m) => m.userId);

    for (const userId of memberIds) {
      try {
        await notificationService.send({
          userId,
          type: NotificationType.GENERAL_ANNOUNCEMENT,
          title,
          message,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        });
      } catch (err) {
        logger.warn(
          { operationType: 'BARAZA_NOTIFY', userId, error: String(err) },
          'Failed to send baraza notification to member'
        );
      }
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
  /**
   * Calls the Telegram Bot API to create a permanent invite link for a chat.
   * Returns the link string, or undefined if the bot token is not configured or the call fails.
   */
  private async createTelegramInviteLink(
    chatId: string
  ): Promise<string | undefined> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return undefined;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/createChatInviteLink`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: Number(chatId) }),
        }
      );
      if (!res.ok) return undefined;
      const data = (await res.json()) as {
        ok: boolean;
        result?: { invite_link: string };
      };
      return data.ok ? data.result?.invite_link : undefined;
    } catch (err) {
      logger.warn(
        { err, chatId },
        'Failed to create Telegram invite link — group will show without link'
      );
      return undefined;
    }
  }

  /**
   * Refreshes the stored Telegram invite link for a baraza group.
   * Used when a group was registered before the bot had admin rights.
   */
  async refreshInviteLink(barazaGroupId: string): Promise<string | null> {
    const group = await prisma.barazaGroup.findUnique({
      where: { id: barazaGroupId },
    });
    if (!group || group.platform !== 'TELEGRAM') return null;

    const link = await this.createTelegramInviteLink(group.externalId);
    if (!link) return null;

    await prisma.barazaGroup.update({
      where: { id: barazaGroupId },
      data: { inviteLink: link },
    });

    return link;
  }
}

export const barazaBotService = new BarazaBotService();

/**
 * @file src/modules/integration/services/baraza-bot.service.ts
 * @description
 * Core Baraza business logic: register external groups, record attendance, fan-out invites.
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { ApiError } from '../../../core/errors/ApiError.js';
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
import { PR_CONFIG, ParticipationRightsReason } from '../../economy/types.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import {
  NotificationType,
  NotificationChannel,
} from '../../notifications/types.js';
import { notificationService } from '../../notifications/services/notification.service.js';
import { ElectionThresholds, SystemRoles } from '../../../core/rbac/roles.js';

/** A community with members but no active Telegram baraza. */
export interface BarazaDemandRow {
  groupId: string;
  name: string;
  isSystem: boolean;
  systemType: string | null;
  members: number;
  eligible: number;
  threshold: number;
  alertedAt: Date | null;
}

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
    // One canonical Baraza per community group + platform. If an active one already
    // exists: same external group → idempotent (return it); a different group →
    // reject, so a ward can't end up with rival Telegram chats fragmenting the
    // conversation. (Deactivate the existing one first to switch.)
    const existingActive = await prisma.barazaGroup.findFirst({
      where: {
        groupId: dto.groupId,
        platform: dto.platform as any,
        isActive: true,
      },
    });
    if (existingActive) {
      if (existingActive.externalId === dto.externalId) return existingActive;
      throw ApiError.conflict(
        `This community already has an active ${dto.platform} Baraza ("${existingActive.name}"). Deactivate it before registering a different group.`
      );
    }

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

    // Clear any pending demand alert — the community now has a baraza. If it is
    // later removed, the next scan (null flag, no active baraza) re-alerts.
    await prisma.group.update({
      where: { id: dto.groupId },
      data: { barazaAlertSentAt: null },
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

    // Reward the coordinator who submitted this attendance report
    if (dto.reportedBy) {
      await participationRightsService
        .award(
          dto.reportedBy,
          PR_CONFIG.BARAZA_REPORT_SUBMITTED,
          ParticipationRightsReason.BARAZA_REPORT_SUBMITTED,
          { barazaGroupId: barazaGroup.id, sessionDate: dto.sessionDate }
        )
        .catch(() => {});
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
   * Send invite links to ONE user for every community they belong to that
   * already has an active baraza on the platform. Used right after a user links
   * their account (e.g. via /verify) so they get pulled into existing barazas.
   */
  async fanOutInvitesToUser(
    userId: string,
    platform: 'TELEGRAM' | 'WHATSAPP' | 'DISCORD' = 'TELEGRAM'
  ): Promise<void> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, active: true },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    if (!groupIds.length) return;

    const barazas = await prisma.barazaGroup.findMany({
      where: {
        groupId: { in: groupIds },
        platform: platform as any,
        isActive: true,
      },
      select: { id: true },
    });
    for (const b of barazas) {
      await integrationQueue.add(BotJobName.BARAZA_SEND_INVITE, {
        userId,
        barazaGroupId: b.id,
        platform: platform as any,
      });
    }
  }

  /**
   * Communities that have crossed the member threshold but have no active baraza
   * on the platform — ranked by eligible members. System communities count
   * community-verified members; voluntary groups count all active members
   * (mirrors the election eligibility rule). Used by the admin worklist and the
   * demand-scan job.
   */
  async getCommunitiesNeedingBaraza(
    platform: 'TELEGRAM' | 'WHATSAPP' | 'DISCORD' = 'TELEGRAM'
  ): Promise<BarazaDemandRow[]> {
    const existing = await prisma.barazaGroup.findMany({
      where: { platform: platform as any, isActive: true },
      select: { groupId: true },
    });
    const haveBaraza = new Set(existing.map((b) => b.groupId));

    const [allCounts, verifiedCounts] = await Promise.all([
      prisma.groupMember.groupBy({
        by: ['groupId'],
        where: { active: true },
        _count: { _all: true },
      }),
      prisma.groupMember.groupBy({
        by: ['groupId'],
        where: { active: true, user: { communityVerified: true } },
        _count: { _all: true },
      }),
    ]);
    const allMap = new Map(allCounts.map((c) => [c.groupId, c._count._all]));
    const verifiedMap = new Map(
      verifiedCounts.map((c) => [c.groupId, c._count._all])
    );

    const candidateIds = [...allMap.keys()].filter((id) => !haveBaraza.has(id));
    if (!candidateIds.length) return [];

    const groups = await prisma.group.findMany({
      where: { id: { in: candidateIds } },
      select: {
        id: true,
        name: true,
        isSystemGroup: true,
        systemType: true,
        barazaAlertSentAt: true,
      },
    });

    const rows: BarazaDemandRow[] = [];
    for (const g of groups) {
      const eligible = g.isSystemGroup
        ? (verifiedMap.get(g.id) ?? 0)
        : (allMap.get(g.id) ?? 0);
      const threshold = barazaThresholdFor(g.isSystemGroup, g.systemType);
      if (eligible >= threshold) {
        rows.push({
          groupId: g.id,
          name: g.name,
          isSystem: g.isSystemGroup,
          systemType: g.systemType,
          members: allMap.get(g.id) ?? 0,
          eligible,
          threshold,
          alertedAt: g.barazaAlertSentAt,
        });
      }
    }
    rows.sort((a, b) => b.eligible - a.eligible);
    return rows;
  }

  /**
   * Scans for communities needing a baraza and alerts every SUPER_ADMIN once
   * per community (deduped via Group.barazaAlertSentAt). Run on a schedule.
   */
  async scanAndAlertBarazaDemand(): Promise<{
    scanned: number;
    alerted: number;
  }> {
    const demand = await this.getCommunitiesNeedingBaraza('TELEGRAM');
    const fresh = demand.filter((d) => !d.alertedAt);
    if (!fresh.length) return { scanned: demand.length, alerted: 0 };

    const admins = await prisma.user.findMany({
      where: {
        userRoles: { some: { role: { name: SystemRoles.SUPER_ADMIN } } },
      },
      select: { id: true },
    });
    if (!admins.length) {
      logger.warn(
        { operationType: 'BARAZA' },
        'Baraza demand: communities need a baraza but no SUPER_ADMIN to alert'
      );
      return { scanned: demand.length, alerted: 0 };
    }

    for (const d of fresh) {
      const message = `${d.name} has ${d.eligible} verified member${
        d.eligible === 1 ? '' : 's'
      } (threshold ${d.threshold}) but no Telegram baraza yet. Create one in the admin panel — members will be invited automatically.`;
      for (const a of admins) {
        await notificationService.send({
          userId: a.id,
          type: NotificationType.BARAZA_NEEDED,
          title: 'Community needs a Telegram baraza',
          message,
          data: {
            groupId: d.groupId,
            eligible: d.eligible,
            threshold: d.threshold,
          },
        });
      }
    }

    await prisma.group.updateMany({
      where: { id: { in: fresh.map((d) => d.groupId) } },
      data: { barazaAlertSentAt: new Date() },
    });

    logger.info(
      {
        operationType: 'BARAZA',
        alerted: fresh.length,
        admins: admins.length,
      },
      'Baraza demand alerts sent to SUPER_ADMINs'
    );
    return { scanned: demand.length, alerted: fresh.length };
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
          // Cap so a slow Telegram never hangs an admin register/refresh request.
          signal: AbortSignal.timeout(10_000),
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

/**
 * Member threshold a community must cross before we alert admins to create a
 * baraza. Mirrors the election thresholds for consistency.
 */
function barazaThresholdFor(
  isSystem: boolean,
  systemType: string | null
): number {
  if (!isSystem) return ElectionThresholds.VOLUNTARY_GROUP_LEADER;
  if (systemType === 'WARD') return ElectionThresholds.WARD_LEADER;
  if (systemType === 'CONSTITUENCY')
    return ElectionThresholds.CONSTITUENCY_LEADER;
  if (systemType === 'COUNTY' || systemType === 'NATIONAL')
    return ElectionThresholds.COUNTY_LEADER;
  return ElectionThresholds.WARD_LEADER;
}

export const barazaBotService = new BarazaBotService();

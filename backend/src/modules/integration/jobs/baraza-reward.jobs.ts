/**
 * @file src/modules/integration/jobs/baraza-reward.jobs.ts
 * @description
 * BullMQ job processors for Baraza integration:
 *   - BARAZA_ATTENDANCE_REWARD: award PR for baraza attendance (idempotent)
 *   - BARAZA_SEND_INVITE: send platform invite link to a user
 */

import { Job } from 'bullmq';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import {
  telegramSendInviteLink,
  isTelegramConfigured,
} from '../services/telegram.service.js';
import {
  discordSendInviteLink,
  isDiscordConfigured,
} from '../services/discord.service.js';
import {
  BarazaAttendanceRewardJobData,
  BarazaSendInviteJobData,
} from '../types.js';

export async function processBarazaAttendanceReward(
  job: Job<BarazaAttendanceRewardJobData>
): Promise<void> {
  const { attendanceId, userId, prAmount, reason, sessionDate } = job.data;

  const attendance = await prisma.barazaAttendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    logger.warn(
      { operationType: 'BARAZA_REWARD', attendanceId },
      'BarazaAttendance not found — skipping'
    );
    return;
  }

  if (attendance.prAwarded) {
    logger.info(
      { operationType: 'BARAZA_REWARD', attendanceId },
      'PR already awarded for this attendance — idempotency guard'
    );
    return;
  }

  await participationRightsService.award(
    userId,
    prAmount,
    reason as ParticipationRightsReason,
    { source: 'baraza', attendanceId, sessionDate }
  );

  await prisma.barazaAttendance.update({
    where: { id: attendanceId },
    data: { prAwarded: true, prAmount },
  });

  logger.info(
    { operationType: 'BARAZA_REWARD', attendanceId, userId, prAmount, reason },
    'Baraza attendance PR awarded'
  );
}

export async function processBarazaSendInvite(
  job: Job<BarazaSendInviteJobData>
): Promise<void> {
  const { userId, barazaGroupId, platform } = job.data;

  const [profile, barazaGroup] = await Promise.all([
    prisma.userMessagingProfile.findUnique({
      where: { userId_platform: { userId, platform: platform as any } },
    }),
    prisma.barazaGroup.findUnique({ where: { id: barazaGroupId } }),
  ]);

  if (!barazaGroup || !barazaGroup.inviteLink) {
    logger.info(
      { operationType: 'BARAZA_INVITE', barazaGroupId, userId },
      'No invite link on BarazaGroup — nothing to send'
    );
    return;
  }

  if (!profile) {
    logger.warn(
      { operationType: 'BARAZA_INVITE', userId, platform },
      'No UserMessagingProfile for user on this platform — skipping'
    );
    return;
  }

  if (!profile.externalUserId) {
    logger.info(
      { operationType: 'BARAZA_INVITE', userId, platform },
      'externalUserId not yet known for user — invite queued but cannot be delivered yet'
    );
    return;
  }

  if (platform === 'TELEGRAM') {
    if (!isTelegramConfigured()) {
      logger.warn(
        { operationType: 'BARAZA_INVITE', platform },
        'Telegram not configured — invite not sent'
      );
      return;
    }
    await telegramSendInviteLink(
      profile.externalUserId,
      barazaGroup.name,
      barazaGroup.inviteLink
    );
  } else if (platform === 'DISCORD') {
    if (!isDiscordConfigured()) {
      logger.warn(
        { operationType: 'BARAZA_INVITE', platform },
        'Discord not configured — invite not sent'
      );
      return;
    }
    await discordSendInviteLink(
      profile.externalUserId,
      barazaGroup.name,
      barazaGroup.inviteLink
    );
  } else {
    // WHATSAPP: cannot send DM via API — invite links are shared manually
    logger.info(
      { operationType: 'BARAZA_INVITE', platform, userId },
      'WhatsApp invite requires manual sharing — no automated DM possible'
    );
  }
}

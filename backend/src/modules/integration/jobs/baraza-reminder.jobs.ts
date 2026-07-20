/**
 * @file src/modules/integration/jobs/baraza-reminder.jobs.ts
 * @description
 * BullMQ processor for BARAZA_SESSION_REMINDER delayed job.
 * Fires 1 hour before a scheduled baraza session to:
 *   1. Post a Telegram reminder to the group chat
 *   2. Notify all group members via platform + email
 */

import { Job } from 'bullmq';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { BarazaSessionReminderJobData } from '../types.js';
import { barazaBotService } from '../services/baraza-bot.service.js';

export const BARAZA_SESSION_REMINDER_JOB = 'BARAZA_SESSION_REMINDER';

async function sendTelegramGroupMessage(
  chatId: string,
  text: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Number(chatId),
      text,
      parse_mode: 'Markdown',
    }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { description?: string };
    throw new Error(body.description ?? `HTTP ${res.status}`);
  }
}

async function sendTelegramDM(userId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Number(userId),
      text,
      parse_mode: 'Markdown',
    }),
  });
  if (!res.ok) {
    // Non-fatal — user may not have started the bot
    const body = (await res.json()) as { description?: string };
    logger.warn(
      { operationType: 'BARAZA_REMINDER', userId, error: body.description },
      'Could not send reminder DM'
    );
  }
}

export async function processBarazaSessionReminder(
  job: Job<BarazaSessionReminderJobData>
): Promise<void> {
  const { barazaSessionId, barazaGroupId, chatId } = job.data;

  const session = await prisma.barazaSession.findUnique({
    where: { id: barazaSessionId },
  });

  if (!session || session.closedAt) {
    logger.info(
      { operationType: 'BARAZA_REMINDER', barazaSessionId },
      'Session already closed or not found — reminder skipped'
    );
    return;
  }

  const formattedTime = session.scheduledAt.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Nairobi',
  });
  const formattedDate = session.scheduledAt.toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  });

  const reminderText =
    `⏰ *Baraza inaanza saa moja!*\n\n` +
    `📅 ${formattedDate} saa ${formattedTime}\n\n` +
    `Kumbuka kuja na /present unapofika. Hii ndiyo Ujamaa — show up! 💪`;

  // 1. Post to Telegram group
  try {
    await sendTelegramGroupMessage(chatId, reminderText);
  } catch (err) {
    logger.warn(
      { operationType: 'BARAZA_REMINDER', chatId, error: String(err) },
      'Failed to post group reminder — continuing with DMs'
    );
  }

  // 2. DM members who have Telegram linked + platform/email notification
  const barazaGroup = await prisma.barazaGroup.findUnique({
    where: { id: barazaGroupId },
    include: { group: { include: { members: { select: { userId: true } } } } },
  });

  if (!barazaGroup) return;

  const memberIds = barazaGroup.group.members.map((m) => m.userId);

  for (const userId of memberIds) {
    // Telegram DM
    const telegramProfile = await prisma.userMessagingProfile.findUnique({
      where: { userId_platform: { userId, platform: 'TELEGRAM' } },
    });
    if (telegramProfile?.externalUserId) {
      await sendTelegramDM(telegramProfile.externalUserId, reminderText);
    }
  }

  // Platform + email via notificationService
  await barazaBotService.notifyGroupMembers(
    barazaGroupId,
    'Baraza inaanza saa moja!',
    `Baraza yako ina muda wa saa moja — ${formattedDate} ${formattedTime}. Kumbuka kuja na /present.`
  );

  logger.info(
    {
      operationType: 'BARAZA_REMINDER',
      barazaSessionId,
      memberCount: memberIds.length,
    },
    'Baraza session reminder dispatched'
  );
}

/**
 * @file src/modules/notifications/jobs/dues-reminder.jobs.ts
 * @description
 * DUES_REMINDER BullMQ job.
 *
 * Runs daily at 08:00. Finds users with active DUES commitments and sends
 * a reminder notification 3 days before the next monthly billing date
 * (the 1st of each month). Fires when today is the 26th–28th of the month.
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { notificationService } from '../services/notification.service.js';
import { NotificationType } from '../types.js';

export const DUES_REMINDER_JOB = 'dues-reminder';

export async function processDuesReminder(): Promise<void> {
  const today = new Date();
  const dayOfMonth = today.getDate();

  // Only fire on days 26–28 so members get ~3 days warning before month-end
  if (dayOfMonth < 26 || dayOfMonth > 28) {
    logger.info(
      { job: DUES_REMINDER_JOB, dayOfMonth },
      'Not a reminder day — skipping'
    );
    return;
  }

  logger.info(
    { job: DUES_REMINDER_JOB, dayOfMonth },
    'Starting dues reminder job'
  );

  // Find all active dues commitments
  const commitments = await prisma.commitment.findMany({
    where: { type: 'DUES', status: 'ACTIVE' },
    select: { userId: true },
    distinct: ['userId'],
  });

  let sent = 0;
  for (const { userId } of commitments) {
    try {
      // Skip if already reminded this month (check for an existing DUES_REMINDER this month)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'ECONOMIC',
          title: { contains: 'dues' },
          createdAt: { gte: monthStart },
        },
      });
      if (existing) continue;

      await notificationService.send({
        userId,
        type: NotificationType.DUES_REMINDER,
        title: 'Dues reminder',
        message:
          'Your monthly dues are due in 3 days. Ensure your account is topped up to avoid missing your commitment.',
      });
      sent++;
    } catch (err) {
      logger.error(
        { job: DUES_REMINDER_JOB, userId, error: String(err) },
        'Failed to send dues reminder to user'
      );
    }
  }

  logger.info(
    { job: DUES_REMINDER_JOB, sent, total: commitments.length },
    'Dues reminder job completed'
  );
}

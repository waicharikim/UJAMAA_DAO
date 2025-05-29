/**
 * @file notification.service.ts
 *
 * @description
 * Service handling user notification preferences and delivery.
 * - Retrieves and updates user preferences for various notification channels and events.
 * - Dispatches notifications respecting user preferences.
 * - Currently uses logging as placeholder for actual delivery mechanisms.
 */

import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';

/**
 * Retrieves notification preferences for a given user.
 *
 * @param userId - ID of the user
 * @returns Array of NotificationPreference objects for the user
 */
export async function getUserNotificationPreferences(userId: string) {
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  return prefs;
}

/**
 * Updates or creates a notification preference for a user,
 * specifying if a channel/eventType is enabled or disabled.
 *
 * @param userId - ID of the user
 * @param channel - Notification channel (e.g., 'email', 'sms', 'in-app')
 * @param eventType - Event type (e.g., 'email_verification', 'proposal_update')
 * @param enabled - Whether the notification is enabled
 * @returns The upserted NotificationPreference record
 */
export async function updateUserNotificationPreference(userId: string, channel: string, eventType: string, enabled: boolean) {
  return prisma.notificationPreference.upsert({
    where: {
      userId_channel_eventType: { userId, channel, eventType },
    },
    create: {
      userId,
      channel,
      eventType,
      enabled,
    },
    update: {
      enabled,
    },
  });
}

/**
 * Dispatches a notification to a user, considering their preferences.
 * Currently logs the notification attempt; actual sending logic would integrate with email/SMS/etc.
 *
 * @param userId - ID of the user
 * @param channel - Notification channel
 * @param eventType - Type of event triggering notification
 * @param payload - Additional data/payload for notification
 * @returns true if notification sent or expected to send; false if disabled by preferences
 */
export async function dispatchNotification(userId: string, channel: string, eventType: string, payload: any) {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId_channel_eventType: { userId, channel, eventType } },
  });

  if (prefs && !prefs.enabled) {
    logger.info(`Notification for ${userId} on channel ${channel} and event ${eventType} is disabled.`);
    return false;
  }

  // TODO: Integrate with real delivery service (SendGrid, Twilio, etc.)
  logger.info(`Sending ${eventType} notification to user ${userId} via ${channel}`, { payload });

  return true;
}
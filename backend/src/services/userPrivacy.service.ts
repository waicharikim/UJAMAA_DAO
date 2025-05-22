/**
 * @file userPrivacy.service.ts
 *
 * @description
 * Service for managing user privacy settings including retrieval, update,
 * privacy-aware filtering of user data, audit logging of settings changes,
 * and notification dispatch on updates.
 */

import prisma from '../prismaClient.js';
import { logUserAudit } from './userAudit.service.js';
import { dispatchNotification } from './notification.service.js';
import type { UserPrivacySettings, User } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * Returns the default privacy settings applied when a user has no explicit settings saved.
 * All sensitive fields default to 'private' except 'countyLive' is 'public'.
 */
export function getDefaultPrivacySettings(): Record<string, string> {
  return {
    email: 'private',
    phoneNumber: 'private',
    walletAddress: 'private',
    countyLive: 'public',
    constituencyLive: 'private',
    countyOrigin: 'private',
    constituencyOrigin: 'private',
  };
}

/**
 * Filters user object fields based on privacy settings and requester's roles.
 * Super admins have unrestricted access.
 *
 * @param user User object with optional embedded privacySettings.
 * @param requesterRoles Array of roles (strings) of the requesting user.
 * @returns Filtered Partial<User> object containing only allowed fields.
 */
export function filterUserByPrivacy(
  user: User & { privacySettings?: UserPrivacySettings | null },
  requesterRoles: string[]
): Partial<User> {
  const isSuperAdmin = requesterRoles.includes('system:super_admin');
  const privacy = user.privacySettings?.settings ?? getDefaultPrivacySettings();

  // Start with non-sensitive public fields.
  const result: Partial<User> = {
    id: user.id,
    name: user.name,
    industryId: user.industryId,
    avatarUrl: user.avatarUrl,
  };

  // Determine if a field is visible according to privacy setting and roles.
  const canView = (field: string): boolean => {
    if (isSuperAdmin) return true;
    const setting = privacy[field] ?? 'private';
    switch (setting) {
      case 'public':
        return true;
      case 'group':
        return requesterRoles.some(r => r.startsWith('group:'));
      case 'private':
      default:
        return false;
    }
  };

  if (canView('email')) result.email = user.email;
  if (canView('phoneNumber')) result.phoneNumber = user.phoneNumber;
  if (canView('walletAddress')) result.walletAddress = user.walletAddress;
  if (canView('countyLive')) result.countyLive = user.countyLive;
  if (canView('constituencyLive')) result.constituencyLive = user.constituencyLive;
  if (canView('countyOrigin')) result.countyOrigin = user.countyOrigin;
  if (canView('constituencyOrigin')) result.constituencyOrigin = user.constituencyOrigin;

  return result;
}

/**
 * Fetches existing UserPrivacySettings for a user or creates defaults if none exist.
 *
 * @param userId User ID to get or create privacy settings for.
 * @returns UserPrivacySettings object with settings JSON.
 */
export async function getUserPrivacySettings(userId: string) {
  let settings = await prisma.userPrivacySettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.userPrivacySettings.create({
      data: {
        userId,
        settings: getDefaultPrivacySettings(),
      },
    });
  }
  return settings;
}

/**
 * Updates user's privacy settings, logs changes for audit and dispatches notifications.
 *
 * @param userId User ID being updated.
 * @param newSettings New privacy settings to apply.
 * @param changedById User ID making the change (typically same user).
 * @returns Updated UserPrivacySettings object.
 */
export async function updateUserPrivacySettings(
  userId: string,
  newSettings: Record<string, string>,
  changedById?: string,
) {
  const oldSettings = await getUserPrivacySettings(userId);

  const updated = await prisma.userPrivacySettings.upsert({
    where: { userId },
    create: { userId, settings: newSettings },
    update: { settings: newSettings },
  });

  // Asynchronously audit each changed setting key
  if (changedById) {
    for (const key of Object.keys(newSettings)) {
      const oldVal = oldSettings.settings[key] ?? null;
      const newVal = newSettings[key];
      if (oldVal !== newVal) {
        logUserAudit({
          userId,
          field: `privacySettings.${key}`,
          oldValue: oldVal,
          newValue: newVal,
          changedBy: changedById,
        }).catch((error) => {
          logger.error('Failed to log user privacy audit', { userId, field: key, error });
        });
      }
    }
  }

  // Notify user (example via email) about privacy settings update
  await dispatchNotification(userId, 'email', 'privacySettingsUpdated', { changedSettings: newSettings });

  return updated;
}
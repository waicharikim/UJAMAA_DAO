/**
 * @file userPrivacy.service.ts
 *
 * @description
 * Service for managing user privacy settings including retrieval, update,
 * privacy-aware filtering of user data, audit logging of settings changes,
 * and data anonymization for compliance.
 */

import prisma from '../prismaClient.js';
import { logUserAudit } from './userAudit.service.js';
import { dispatchNotification } from './notification.service.js';
import type { UserPrivacySettings, User } from '@prisma/client';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { Prisma } from '@prisma/client';

// The User model as it appears in the database (we need to know what fields to anonymize)
interface UserWithAllFields extends User {
    // Extend User type if Prisma.User doesn't include all necessary fields directly
    // Assuming 'email', 'phoneNumber', 'walletAddress', 'countyLive', etc., are directly on Prisma.User
}

/**
 * Returns the default privacy settings applied when a user has no explicit settings saved.
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

  const result: Partial<User> = {
    id: user.id,
    name: user.name,
    industryId: user.industryId,
    avatarUrl: user.avatarUrl,
    // Add other non-sensitive fields here
  };

  // List of fields controlled by privacy settings
  const sensitiveFields: Array<keyof User> = [
    'email', 'phoneNumber', 'walletAddress', 'countyLive', 'constituencyLive', 'countyOrigin', 'constituencyOrigin'
  ];

  const canView = (field: keyof User): boolean => {
    if (isSuperAdmin) return true;
    const setting = privacy[field as string] ?? 'private';
    switch (setting) {
      case 'public':
        return true;
      case 'group':
        // Check if requester has any group-scoped role
        return requesterRoles.some(r => r.startsWith('group:'));
      case 'private':
      default:
        return false;
    }
  };

  for (const field of sensitiveFields) {
      if (canView(field) && user[field] !== undefined) {
          (result as any)[field] = user[field];
      }
  }

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
        settings: getDefaultPrivacySettings() as Prisma.JsonValue,
      },
    });
  }
  return settings;
}

/**
 * Updates user's privacy settings, performs ATOMIC audit logging, and dispatches notifications.
 * This operation is wrapped in a transaction to ensure audit logging success.
 *
 * @param userId User ID being updated.
 * @param newSettings New privacy settings to apply.
 * @param changedById User ID making the change (typically same user).
 * @returns Updated UserPrivacySettings object.
 */
export async function updateUserPrivacySettings(
  userId: string,
  newSettings: Record<string, string>,
  changedById: string,
) {
  // 1. Fetch old settings before starting the transaction
  const oldSettings = await getUserPrivacySettings(userId);
  const settingsKeys = Object.keys(newSettings);

  return await prisma.$transaction(async (tx) => {
    // 2. Perform the update/upsert within the transaction
    const updated = await tx.userPrivacySettings.upsert({
      where: { userId },
      create: { userId, settings: newSettings as Prisma.JsonValue },
      update: { settings: newSettings as Prisma.JsonValue },
    });

    // 3. ATOMICALLY audit each changed setting key
    const auditPromises: Promise<any>[] = [];
    for (const key of settingsKeys) {
      const oldVal = oldSettings.settings[key] ?? null;
      const newVal = newSettings[key];
      
      if (oldVal !== newVal) {
        // Use the transactional client (tx) for the audit log creation
        const auditData = {
          userId,
          field: `privacySettings.${key}`,
          oldValue: String(oldVal),
          newValue: String(newVal),
          changedBy: changedById,
        };
        
        // This MUST be awaited or included in the promise list so that a failure rolls back the whole transaction
        auditPromises.push(tx.userAudit.create({ data: auditData }));
      }
    }

    // Await all audit logs. If any fail, the transaction will automatically rollback.
    await Promise.all(auditPromises);
    
    // 4. Dispatch notification (still non-blocking to the main transaction, but outside of the Promise.all)
    // NOTE: This runs outside the main audit loop but inside the $transaction.
    await dispatchNotification(userId, 'email', 'privacySettingsUpdated', { changedSettings: newSettings });

    return updated;
  }).catch(error => {
    // Log error and rethrow as ApiError
    logger.error('Transaction failed during privacy settings update and audit.', { userId, error: error.message });
    throw new ApiError('Failed to update privacy settings or record audit trail.', 500);
  });
}

/**
 * Anonymizes a user's sensitive PII data upon request (Right to Erasure).
 * This operation is irreversible and restricted to Super Admins.
 *
 * @param userId The ID of the user whose data must be anonymized.
 * @param actorId The ID of the user (Super Admin) performing the action.
 */
export async function anonymizeUserSensitiveData(userId: string, actorId: string): Promise<void> {
    const ANONYMIZED_STRING = 'ANONYMIZED';
    const ANONYMIZED_EMAIL = `${userId}@${ANONYMIZED_STRING}.co`;

    // CRITICAL: Use a transaction for atomic update and audit logging
    await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new ApiError('User not found for anonymization.', 404);
        }
        
        // Fields to be set to a placeholder or NULL
        const updates: Partial<User> = {
            // Replace PII with ANONYMIZED placeholders
            email: ANONYMIZED_EMAIL,
            phoneNumber: ANONYMIZED_STRING,
            name: `User ${userId.substring(0, 8)}`,
            
            // Critical: Clear wallet address linkage (if applicable)
            walletAddress: null, 
            
            // Clear other PII fields
            bio: null,
            avatarUrl: null,
            primaryWardId: null,
            secondaryWardId: null,
            countyLive: null,
            constituencyLive: null,
            countyOrigin: null,
            constituencyOrigin: null,
            
            // Disable account (soft-delete indicator)
            isActive: false, 
            isDeleted: true,
            
            // Clear all verification flags
            emailVerified: false,
            phoneVerified: false,
            communityVerified: false,
            locationVerified: false,
            expertVerified: false,
        };

        // 1. Perform the irreversible anonymization update
        await tx.user.update({
            where: { id: userId },
            data: updates,
        });

        // 2. Log the critical audit event
        await tx.userAudit.create({
            data: {
                userId: userId,
                field: 'dataAnonymization',
                oldValue: 'User PII present',
                newValue: 'User PII anonymized and account disabled',
                changedBy: actorId,
                timestamp: new Date(),
                metadata: { reason: 'Right to Erasure / Compliance' },
            },
        });

        // 3. Clear/delete the user's privacy settings record (optional but recommended)
        await tx.userPrivacySettings.delete({ where: { userId } }).catch(e => {
            // Log if settings didn't exist, but don't fail the transaction
            logger.warn('No privacy settings found to delete during anonymization', { userId });
        });
        
    });
}

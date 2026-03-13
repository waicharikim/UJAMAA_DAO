/**
 * @file tests/notifications/helpers.ts
 * @description Shared helpers for notifications module tests.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

export async function createNotificationUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Notification Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
    },
  });
}

export async function seedNotification(
  userId: string,
  title = 'Test notification',
  read = false
) {
  return prisma.notification.create({
    data: {
      userId,
      title,
      message: 'Test message',
      type: 'SYSTEM',
      read,
    },
  });
}

export function makeNotificationToken(
  userId: string,
  extra: Partial<JwtPayload> = {}
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: 'COMMUNITY_VERIFIED',
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 0,
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      type: 'permanent',
      ...extra,
    },
    '1h',
    0
  );
}

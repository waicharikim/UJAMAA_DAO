/**
 * @file tests/integration/helpers.ts
 * @description Seed helpers for integration (Baraza) module tests.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

// Fixed UUIDs to avoid collision with other test modules
const INT_COUNTY_ID = 'c3a10001-0000-4000-b000-000000000001';
const INT_CONST_ID  = 'c3a10002-0000-4000-b000-000000000002';
export const INT_WARD_ID = 'c3a10003-0000-4000-b000-000000000003';

export async function seedLocation(): Promise<void> {
  await prisma.county.upsert({
    where: { id: INT_COUNTY_ID },
    update: {},
    create: { id: INT_COUNTY_ID, name: 'Integration Test County', code: 'ITC-01' },
  });
  await prisma.constituency.upsert({
    where: { id: INT_CONST_ID },
    update: {},
    create: { id: INT_CONST_ID, name: 'Integration Test Const', countyId: INT_COUNTY_ID },
  });
  await prisma.ward.upsert({
    where: { id: INT_WARD_ID },
    update: {},
    create: {
      id: INT_WARD_ID,
      name: 'Integration Test Ward',
      constituencyId: INT_CONST_ID,
      countyId: INT_COUNTY_ID,
    },
  });
}

export async function seedGroup(wardId: string) {
  return prisma.group.create({
    data: {
      name: `Integration Group ${Date.now()}`,
      locationScope: 'WARD',
      wardId,
      isSystemGroup: false,
      status: 'ACTIVE',
    },
  });
}

export async function seedUser(email: string, wardId = INT_WARD_ID) {
  return prisma.user.create({
    data: {
      email,
      name: 'Integration Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: wardId,
    },
  });
}

export async function seedWardAdmin(email: string, wardId = INT_WARD_ID) {
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Ward Admin User',
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: true,
      primaryWardId: wardId,
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'location:ward_admin' },
    update: {},
    create: { name: 'location:ward_admin', description: 'Ward admin' },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, active: true },
  });

  return user;
}

export async function seedBarazaGroup(
  groupId: string,
  platform: 'TELEGRAM' | 'WHATSAPP' | 'DISCORD' = 'TELEGRAM',
  registeredBy: string
) {
  const ts = Date.now();
  return prisma.barazaGroup.create({
    data: {
      groupId,
      platform,
      externalId: `ext-${ts}`,
      name: `Test Baraza ${ts}`,
      inviteLink: `https://t.me/joinchat/test${ts}`,
      isActive: true,
      registeredBy,
    },
  });
}

export async function seedMessagingProfile(
  userId: string,
  platform: 'TELEGRAM' | 'WHATSAPP' | 'DISCORD',
  externalUserId: string
) {
  return prisma.userMessagingProfile.create({
    data: {
      userId,
      platform,
      externalUserId,
      handle: `@user${externalUserId}`,
    },
  });
}

export function makeIntegrationToken(
  userId: string,
  roles: string[] = []
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: 'COMMUNITY_VERIFIED',
      roles,
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 100,
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      type: 'permanent',
    } as Partial<JwtPayload> as JwtPayload,
    '1h',
    0
  );
}

export function makeWardAdminToken(userId: string): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: 'FULL_VERIFIED',
      roles: ['location:ward_admin'],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 100,
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      type: 'permanent',
    } as Partial<JwtPayload> as JwtPayload,
    '1h',
    0
  );
}

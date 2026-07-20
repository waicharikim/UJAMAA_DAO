/**
 * @file tests/emergency/helpers.ts
 * @description Shared seeders and helpers for emergency module tests.
 */

import { EmergencyType, EmergencySeverity } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

export async function createEmergencyUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Emergency Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
    },
  });
}

export async function seedWard(name = 'Test Ward') {
  const ts = Date.now();
  const county = await prisma.county.create({
    data: { name: `County ${ts}`, code: `C${ts}` },
  });
  const constituency = await prisma.constituency.create({
    data: { name: `Const ${ts}`, countyId: county.id },
  });
  return prisma.ward.create({
    data: {
      name,
      code: `W${ts}`,
      constituencyId: constituency.id,
      countyId: county.id,
    },
  });
}

export async function seedEmergencyAlert(
  reporterId: string,
  wardId: string,
  overrides: {
    type?: EmergencyType;
    severity?: EmergencySeverity;
    status?: string;
  } = {}
) {
  return prisma.emergencyAlert.create({
    data: {
      reporterId,
      emergencyType: overrides.type ?? EmergencyType.FIRE,
      severity: overrides.severity ?? EmergencySeverity.HIGH,
      title: 'Test Emergency',
      description: 'A test emergency alert for unit testing purposes',
      location: wardId,
      neededResources: {},
      availableResources: {},
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

export function makeEmergencyToken(
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
      participationRights: 100,
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

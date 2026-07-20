/**
 * @file tests/reputation/helpers.ts
 * @description Shared helpers for reputation module tests.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

export async function createReputationUser(email: string, globalImpactPoints = 0) {
  return prisma.user.create({
    data: {
      email,
      name: 'Reputation Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      globalImpactPoints,
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

export async function seedWardInConstituency(
  constituencyId: string,
  countyId: string,
  name = 'Extra Ward'
) {
  const ts = Date.now() + Math.floor(Math.random() * 100000);
  return prisma.ward.create({
    data: {
      name: `${name} ${ts}`,
      code: `W${ts}`,
      constituencyId,
      countyId,
    },
  });
}

export async function seedImpactPointLog(
  userId: string,
  amount: number,
  reason = 'EMAIL_VERIFIED',
  scope = 'GLOBAL'
) {
  return prisma.impactPointLog.create({
    data: { userId, amount, reason, scope },
  });
}

export async function seedLocationImpact(
  userId: string,
  wardId: string,
  points: number,
  tier = 'NONE'
) {
  return prisma.userLocationImpact.create({
    data: {
      userId,
      wardId,
      impactPoints: points,
      tier,
      type: 'LOCATION_BASED',
      lastActivity: new Date(),
    },
  });
}

export function makeReputationToken(
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
      participationRights: 50,
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

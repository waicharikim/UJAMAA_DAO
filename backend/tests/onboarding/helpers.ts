/**
 * @file tests/onboarding/helpers.ts
 * @description Shared helpers for onboarding module tests.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

export async function createOnboardingUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Onboarding Test User',
      verificationLevel: 'EMAIL_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: false,
      locationVerified: false,
    },
  });
}

export async function seedTutorial(
  key: string,
  overrides: { prReward?: number; ipReward?: number; requiredFor?: string | null } = {}
) {
  return prisma.onboardingTutorial.create({
    data: {
      key,
      title: `Tutorial: ${key}`,
      description: 'A test tutorial',
      content: { steps: [] },
      category: 'BASICS',
      order: 1,
      prReward: overrides.prReward ?? 0,
      ipReward: overrides.ipReward ?? 0,
      requiredFor: overrides.requiredFor ?? null,
      active: true,
    },
  });
}

export function makeOnboardingToken(
  userId: string,
  extra: Partial<JwtPayload> = {}
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: 'EMAIL_VERIFIED',
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 50,
      emailVerified: true,
      phoneVerified: false,
      communityVerified: false,
      type: 'permanent',
      ...extra,
    },
    '1h',
    0
  );
}

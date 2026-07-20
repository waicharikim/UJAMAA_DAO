/**
 * @file tests/community/helpers.ts
 * @description Shared seeders and helpers for community module tests.
 *
 * NOT a test file — imported by community test files.
 * Depends on seedLocation() from auth/helpers.ts — call that first.
 * Global TRUNCATE runs before each test (testSetup.ts), seed inside beforeEach.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';
import { participationRightsService } from '../../src/modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../src/modules/economy/types.js';
import type { VerificationLevel } from '../../src/core/types/Ujamaadao.types.js';

// Re-export location constants so community tests don't also import auth helpers directly
export {
  TEST_COUNTY_ID,
  TEST_CONST_ID,
  TEST_WARD_ID,
  TEST_WARD_ID_2,
  seedLocation,
  createTestUser,
} from '../auth/helpers.js';

// Second ward in the same constituency — used so primary ≠ secondary in enrollment tests
// (same ward for primary+secondary triggers a concurrent group-create race in enrollInSystemGroups)
export const TEST_WARD_ID_B = '42345678-9abc-4def-1234-56789abcdef0';

/**
 * Seed a second ward in the same constituency as TEST_WARD_ID.
 * Call after seedLocation().
 */
export async function seedSecondWard(): Promise<void> {
  const { TEST_CONST_ID, TEST_COUNTY_ID } = await import('../auth/helpers.js');
  await prisma.ward.upsert({
    where: { id: TEST_WARD_ID_B },
    update: {},
    create: {
      id: TEST_WARD_ID_B,
      name: 'Test Ward B',
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
    },
  });
}

// ─────────────────────────────────────────────
// Fixed UUIDs for community test data
// ─────────────────────────────────────────────

export const TEST_GROUP_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

// ─────────────────────────────────────────────
// Community-specific seeders
// ─────────────────────────────────────────────

/**
 * Create a COMMUNITY_VERIFIED user with a secondary ward.
 * Requires seedLocation() to have been called first.
 */
export async function createCommunityTestUser(
  email: string,
  verificationLevel: VerificationLevel = 'COMMUNITY_VERIFIED'
) {
  const { TEST_WARD_ID } = await import('../auth/helpers.js');
  return prisma.user.create({
    data: {
      email,
      name: 'Community Test User',
      verificationLevel,
      emailVerified: true,
      phoneVerified:
        verificationLevel === 'PHONE_VERIFIED' ||
        verificationLevel === 'COMMUNITY_VERIFIED' ||
        verificationLevel === 'FULL_VERIFIED',
      communityVerified:
        verificationLevel === 'COMMUNITY_VERIFIED' ||
        verificationLevel === 'FULL_VERIFIED',
      locationVerified: false,
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID,
    },
  });
}

/**
 * Award PR to a user so they can afford group creation (costs 100 PR).
 */
export async function awardPR(userId: string, amount: number = 200) {
  await participationRightsService.award(
    userId,
    amount,
    ParticipationRightsReason.EMAIL_VERIFIED
  );
}

/**
 * Create a voluntary group owned by userId. Seeds PR automatically.
 */
export async function seedVoluntaryGroup(
  userId: string,
  name: string = 'Test Group'
) {
  const group = await prisma.group.create({
    data: {
      name,
      description: 'A test voluntary group',
      isSystemGroup: false,
      locationScope: 'WARD',
      voluntaryType: 'BUSINESS_COLLECTIVE',
      status: 'ACTIVE',
    },
  });

  await prisma.groupMember.create({
    data: {
      userId,
      groupId: group.id,
      role: 'LEADER',
      autoEnrolled: false,
      canLeave: true,
      joinedAt: new Date(),
      active: true,
    },
  });

  return group;
}

// ─────────────────────────────────────────────
// JWT helper
// ─────────────────────────────────────────────

/**
 * Generate a valid access JWT for community tests.
 * notBefore=0 so the token is valid immediately.
 * Community routes only require authenticate (no verificationLevel gate).
 */
export function makeCommunityToken(
  userId: string,
  verificationLevel: VerificationLevel = 'COMMUNITY_VERIFIED',
  extra: Partial<JwtPayload> = {}
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel,
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 0,
      emailVerified: true,
      phoneVerified:
        verificationLevel === 'PHONE_VERIFIED' ||
        verificationLevel === 'COMMUNITY_VERIFIED' ||
        verificationLevel === 'FULL_VERIFIED',
      communityVerified:
        verificationLevel === 'COMMUNITY_VERIFIED' ||
        verificationLevel === 'FULL_VERIFIED',
      type: 'permanent',
      ...extra,
    },
    '1h',
    0
  );
}

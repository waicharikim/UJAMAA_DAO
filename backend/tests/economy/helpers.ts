/**
 * @file tests/economy/helpers.ts
 * @description Shared seeders and helpers for economy module tests.
 *
 * NOT a test file — imported by economy test files.
 * Depends on seedLocation() from auth/helpers.ts — call that first.
 * Global TRUNCATE runs before each test (testSetup.ts), seed inside beforeEach.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';
import type { VerificationLevel } from '../../src/core/types/Ujamaadao.types.js';

// Re-export location constants
export {
  TEST_COUNTY_ID,
  TEST_CONST_ID,
  TEST_WARD_ID,
  seedLocation,
} from '../auth/helpers.js';

// ─────────────────────────────────────────────
// User seeders
// ─────────────────────────────────────────────

/**
 * Create a user with the given verification level.
 * Requires seedLocation() to have been called first.
 */
export async function createEconomyTestUser(
  email: string,
  verificationLevel: VerificationLevel = 'COMMUNITY_VERIFIED'
) {
  const { TEST_WARD_ID } = await import('../auth/helpers.js');
  return prisma.user.create({
    data: {
      email,
      name: 'Economy Test User',
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
    },
  });
}

// ─────────────────────────────────────────────
// JWT helper
// ─────────────────────────────────────────────

/**
 * Generate a valid access JWT with no sessionId.
 * notBefore=0 so the token is valid immediately.
 */
export function makeEconomyToken(
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

/**
 * @file tests/user/helpers.ts
 * @description Shared seeders and helpers for user module tests.
 *
 * NOT a test file — imported by user test files.
 * Uses fixed UUIDs so tests can reference predictable IDs.
 *
 * Depends on seedLocation() from auth/helpers.ts — call that first.
 * Global TRUNCATE runs before each test (testSetup.ts), so seed inside
 * beforeEach, not beforeAll.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';
import type { VerificationLevel } from '../../src/core/types/Ujamaadao.types.js';

// Re-export location constants for convenience
export {
  TEST_COUNTY_ID,
  TEST_CONST_ID,
  TEST_WARD_ID,
  TEST_WARD_ID_2,
  seedLocation,
} from '../auth/helpers.js';

// ─────────────────────────────────────────────
// Fixed industry / goods-service UUIDs
// ─────────────────────────────────────────────

export const TEST_INDUSTRY_ID = 'aaaaaaaa-1111-4000-8000-000000000001';
export const TEST_INDUSTRY_ID_2 = 'aaaaaaaa-1111-4000-8000-000000000002';
export const TEST_GS_ID = 'bbbbbbbb-2222-4000-8000-000000000001';
export const TEST_GS_ID_2 = 'bbbbbbbb-2222-4000-8000-000000000002';

// ─────────────────────────────────────────────
// Reference data seeders
// ─────────────────────────────────────────────

/**
 * Seed two test industries.
 */
export async function seedIndustries(): Promise<void> {
  await prisma.industry.upsert({
    where: { id: TEST_INDUSTRY_ID },
    update: {},
    create: { id: TEST_INDUSTRY_ID, name: 'Agriculture' },
  });
  await prisma.industry.upsert({
    where: { id: TEST_INDUSTRY_ID_2 },
    update: {},
    create: { id: TEST_INDUSTRY_ID_2, name: 'Technology' },
  });
}

/**
 * Seed two test goods/services under TEST_INDUSTRY_ID.
 * Must call seedIndustries() first.
 */
export async function seedGoodsServices(): Promise<void> {
  await prisma.goodsService.upsert({
    where: { id: TEST_GS_ID },
    update: {},
    create: { id: TEST_GS_ID, name: 'Maize Supply', industryId: TEST_INDUSTRY_ID },
  });
  await prisma.goodsService.upsert({
    where: { id: TEST_GS_ID_2 },
    update: {},
    create: { id: TEST_GS_ID_2, name: 'Web Development', industryId: TEST_INDUSTRY_ID_2 },
  });
}

// ─────────────────────────────────────────────
// User seeders
// ─────────────────────────────────────────────

/**
 * Create a COMMUNITY_VERIFIED user (has email + phone + community but no wallet).
 */
export async function createCommunityVerifiedUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Community User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      primaryWardId: (await import('../auth/helpers.js')).TEST_WARD_ID,
    },
  });
}

/**
 * Create a FULL_VERIFIED user (all four flags + wallet address).
 */
export async function createFullyVerifiedUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Full Verified User',
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      walletAddress: `0x${email.replace(/[^a-z0-9]/gi, '').padEnd(40, '0').slice(0, 40)}`,
      primaryWardId: (await import('../auth/helpers.js')).TEST_WARD_ID,
    },
  });
}

// ─────────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────────

/**
 * Generate an access JWT for a user with the given verification level.
 * No sessionId — auth middleware skips session validation for permanent tokens.
 */
export function makeUserToken(
  userId: string,
  verificationLevel: VerificationLevel = 'EMAIL_VERIFIED',
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
      emailVerified: verificationLevel !== 'UNVERIFIED',
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

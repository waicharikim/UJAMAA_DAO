/**
 * @file tests/posts/helpers.ts
 * @description Shared seeders and helpers for posts module tests.
 *
 * NOT a test file — imported by posts test files.
 * Requires seedLocation() (auth/helpers) to be called first in beforeEach.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

export {
  TEST_COUNTY_ID,
  TEST_CONST_ID,
  TEST_WARD_ID,
  seedLocation,
} from '../auth/helpers.js';

// A second ward in the same constituency — needed to test dual-ward feed merging
export const TEST_WARD_ID_B = '52345678-9abc-4def-1234-56789abcdef0';

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
// User seeders
// ─────────────────────────────────────────────

export async function createPostUser(
  email: string,
  opts: {
    verificationLevel?: string;
    primaryWardId?: string;
    secondaryWardId?: string;
  } = {}
) {
  const { TEST_WARD_ID } = await import('../auth/helpers.js');
  const level = opts.verificationLevel ?? 'COMMUNITY_VERIFIED';
  return prisma.user.create({
    data: {
      email,
      name: 'Post Test User',
      verificationLevel: level,
      emailVerified: true,
      phoneVerified: level !== 'EMAIL_VERIFIED',
      communityVerified:
        level === 'COMMUNITY_VERIFIED' || level === 'FULL_VERIFIED',
      locationVerified: false,
      primaryWardId: opts.primaryWardId ?? TEST_WARD_ID,
      secondaryWardId: opts.secondaryWardId ?? null,
    },
  });
}

// ─────────────────────────────────────────────
// Post seeders
// ─────────────────────────────────────────────

export async function seedPost(
  authorId: string,
  wardId: string,
  opts: {
    content?: string;
    scope?: string;
    type?: string;
    createdAt?: Date;
  } = {}
) {
  return prisma.post.create({
    data: {
      content: opts.content ?? 'Test post content',
      scope: opts.scope ?? 'WARD',
      type: opts.type ?? 'NOTICE',
      authorId,
      wardId,
      createdAt: opts.createdAt,
    },
  });
}

// ─────────────────────────────────────────────
// JWT helper
// ─────────────────────────────────────────────

export function makePostToken(
  userId: string,
  verificationLevel: string = 'COMMUNITY_VERIFIED',
  extra: Partial<JwtPayload> = {}
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: verificationLevel as JwtPayload['verificationLevel'],
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 50,
      emailVerified: true,
      phoneVerified: verificationLevel !== 'EMAIL_VERIFIED',
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

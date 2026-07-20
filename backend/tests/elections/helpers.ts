/**
 * @file tests/elections/helpers.ts
 * Seed helpers for election tests.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

export {
  TEST_COUNTY_ID,
  TEST_CONST_ID,
  TEST_WARD_ID,
  seedLocation,
} from '../auth/helpers.js';

/** Create a COMMUNITY_VERIFIED user with enough PR to nominate */
export async function createElectionUser(
  email: string,
  overrides: { participationRights?: number; wardId?: string } = {}
) {
  const { TEST_WARD_ID } = await import('../auth/helpers.js');
  return prisma.user.create({
    data: {
      email,
      name: 'Election Test User',
      phoneNumber: `+2547${Math.floor(Math.random() * 90000000) + 10000000}`,
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: overrides.wardId ?? TEST_WARD_ID,
      participationRights: overrides.participationRights ?? 100,
    },
  });
}

/** Create a voluntary group and make all given users members */
export async function createGroupWithMembers(
  userIds: string[],
  wardId?: string
): Promise<string> {
  const { TEST_WARD_ID } = await import('../auth/helpers.js');
  const group = await prisma.group.create({
    data: {
      name: `Test Group ${Date.now()}`,
      voluntaryType: 'PROFESSIONAL_NETWORK',
      isSystemGroup: false,
      status: 'ACTIVE',
      wardId: wardId ?? TEST_WARD_ID,
      locationScope: 'WARD',
    },
  });

  await Promise.all(
    userIds.map((userId) =>
      prisma.groupMember.create({
        data: { userId, groupId: group.id, role: 'MEMBER', active: true },
      })
    )
  );

  return group.id;
}

/** Seed an election in a given status with date windows that allow the status */
export async function seedElection(
  groupId: string,
  status: 'PENDING' | 'NOMINATIONS_OPEN' | 'VOTING_OPEN' | 'CLOSED',
  overrides: { roleKey?: string; termMonths?: number } = {}
) {
  const now = new Date();
  const past = (days: number) => new Date(now.getTime() - days * 86400000);
  const future = (days: number) => new Date(now.getTime() + days * 86400000);

  // Set date windows so the election is naturally in the given status
  let nominationsOpenAt: Date;
  let nominationsCloseAt: Date;
  let votingOpenAt: Date;
  let votingCloseAt: Date;

  if (status === 'PENDING') {
    nominationsOpenAt = future(3);
    nominationsCloseAt = future(10);
    votingOpenAt = future(10);
    votingCloseAt = future(17);
  } else if (status === 'NOMINATIONS_OPEN') {
    nominationsOpenAt = past(1);
    nominationsCloseAt = future(6);
    votingOpenAt = future(6);
    votingCloseAt = future(13);
  } else if (status === 'VOTING_OPEN') {
    nominationsOpenAt = past(10);
    nominationsCloseAt = past(3);
    votingOpenAt = past(1);
    votingCloseAt = future(6);
  } else {
    // CLOSED
    nominationsOpenAt = past(17);
    nominationsCloseAt = past(10);
    votingOpenAt = past(10);
    votingCloseAt = past(3);
  }

  return prisma.election.create({
    data: {
      groupId,
      scope: 'GROUP',
      roleKey: overrides.roleKey ?? 'LEADER',
      status,
      nominationsOpenAt,
      nominationsCloseAt,
      votingOpenAt,
      votingCloseAt,
      termMonths: overrides.termMonths ?? 12,
    },
  });
}

export function makeElectionToken(
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

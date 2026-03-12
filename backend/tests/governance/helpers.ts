/**
 * @file tests/governance/helpers.ts
 * @description Shared seeders and helpers for governance module tests.
 *
 * NOT a test file — imported by governance test files.
 * No dependency on seedLocation() — governance users are created without ward IDs.
 * DB truncated before each test by testSetup.ts.
 */

import { ProposalStatus, ProposalType } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';
import { participationRightsService } from '../../src/modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../src/modules/economy/types.js';

// ─────────────────────────────────────────────
// Fixed UUIDs for governance test data
// ─────────────────────────────────────────────

export const TEST_PROPOSAL_ID = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';
export const TEST_GROUP_GOV_ID = 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f';

// ─────────────────────────────────────────────
// User helpers
// ─────────────────────────────────────────────

/**
 * Create a COMMUNITY_VERIFIED user without ward IDs (governance tests don't require wards).
 * Optionally set globalImpactPoints directly.
 */
export async function createGovernanceUser(
  email: string,
  globalImpactPoints = 0
) {
  return prisma.user.create({
    data: {
      email,
      name: 'Governance Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      globalImpactPoints,
    },
  });
}

/**
 * Award PR tokens to a user for testing.
 * Uses EMAIL_VERIFIED reason (any award reason works for test setup).
 */
export async function awardPR(userId: string, amount = 200) {
  await participationRightsService.award(
    userId,
    amount,
    ParticipationRightsReason.EMAIL_VERIFIED
  );
}

// ─────────────────────────────────────────────
// Group helpers
// ─────────────────────────────────────────────

/**
 * Create a WARD-scoped voluntary group with the creator as LEADER.
 *
 * IP percentile note: WARD scope requires top-90% IP. To pass the check:
 * - Sets the creator's globalImpactPoints to 1000
 * - Adds a second dummy member with IP=0
 * With 2 members and creator at rank 1: percentile = 1/2 = 0.5 < 0.9 → OK
 */
export async function seedGovernanceGroup(
  creatorId: string,
  name = `Governance Test Group ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
) {
  // Give creator high impact points to pass the 90th-percentile check
  await prisma.user.update({
    where: { id: creatorId },
    data: { globalImpactPoints: 1000 },
  });

  const group = await prisma.group.create({
    data: {
      name,
      description: 'A test group for governance unit tests',
      isSystemGroup: false,
      locationScope: 'WARD',
      voluntaryType: 'BUSINESS_COLLECTIVE',
    },
  });

  await prisma.groupMember.create({
    data: {
      userId: creatorId,
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

/**
 * Add a user as a MEMBER of an existing group.
 * Useful for populating the group so percentile checks are meaningful.
 */
export async function addGroupMember(
  userId: string,
  groupId: string,
  role: 'MEMBER' | 'ADMIN' | 'LEADER' = 'MEMBER'
) {
  return prisma.groupMember.create({
    data: {
      userId,
      groupId,
      role,
      autoEnrolled: false,
      canLeave: true,
      joinedAt: new Date(),
      active: true,
    },
  });
}

// ─────────────────────────────────────────────
// Proposal helpers
// ─────────────────────────────────────────────

/**
 * Seed a proposal directly in the DB (bypasses PR spend + IP percentile check).
 * Use this when you need a proposal at a specific status for voting/tally tests.
 */
export async function seedProposal(
  creatorId: string,
  groupId: string,
  status: ProposalStatus = ProposalStatus.DRAFT,
  title = 'Test Governance Proposal for Unit Testing'
) {
  const isVoting = status === ProposalStatus.VOTING;

  return prisma.proposal.create({
    data: {
      groupId,
      creatorId,
      title,
      description:
        'A detailed description of the test proposal used exclusively for governance testing purposes.',
      proposalType: ProposalType.COMMUNITY_INITIATIVE,
      status,
      votingStartsAt: isVoting ? new Date() : undefined,
      votingEndsAt: isVoting
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : undefined,
    },
  });
}

// ─────────────────────────────────────────────
// JWT helper
// ─────────────────────────────────────────────

/**
 * Generate a valid access JWT for governance tests.
 * notBefore=0 so the token is valid immediately.
 * Governance routes only require authenticate middleware.
 */
export function makeGovernanceToken(
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

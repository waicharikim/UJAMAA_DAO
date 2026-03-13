/**
 * @file tests/projects/helpers.ts
 * @description Shared seeders and helpers for projects module tests.
 *
 * NOT a test file — imported by project test files.
 * No dependency on seedLocation() — project tests don't require wards.
 * DB truncated before each test by testSetup.ts.
 */

import { ProposalStatus, ProposalType } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';
import { MilestoneStatus } from '../../src/modules/projects/types.js';

// ─────────────────────────────────────────────
// User helpers
// ─────────────────────────────────────────────

export async function createProjectUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Project Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
    },
  });
}

// ─────────────────────────────────────────────
// Group helpers
// ─────────────────────────────────────────────

export async function seedProjectGroup(ownerId: string) {
  const group = await prisma.group.create({
    data: {
      name: `Project Test Group ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: 'A test group for project unit tests',
      isSystemGroup: false,
      locationScope: 'WARD',
      voluntaryType: 'BUSINESS_COLLECTIVE',
    },
  });

  await prisma.groupMember.create({
    data: {
      userId: ownerId,
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
// Proposal helpers
// ─────────────────────────────────────────────

export async function seedApprovedProposal(creatorId: string, groupId: string) {
  return prisma.proposal.create({
    data: {
      groupId,
      creatorId,
      title: 'Test Approved Proposal',
      description: 'Description for project tests',
      proposalType: ProposalType.COMMUNITY_INITIATIVE,
      status: ProposalStatus.APPROVED,
    },
  });
}

// ─────────────────────────────────────────────
// Project helpers
// ─────────────────────────────────────────────

export async function seedProject(
  ownerUserId: string,
  ownerGroupId?: string,
  title = 'Test Project'
) {
  const project = await prisma.project.create({
    data: {
      title,
      description: 'A test project',
      ownerUserId,
      ownerGroupId: ownerGroupId ?? null,
      status: 'PLANNING',
    },
  });

  // Add owner as LEAD member
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: ownerUserId, role: 'LEAD' },
  });

  return project;
}

export async function seedMilestone(
  projectId: string,
  title = 'Test Milestone',
  status: string = MilestoneStatus.PENDING,
  orderIndex = 1
) {
  return prisma.milestone.create({
    data: {
      projectId,
      title,
      description: 'A test milestone',
      status,
      orderIndex,
    },
  });
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: 'LEAD' | 'MANAGER' | 'CONTRIBUTOR' | 'VIEWER' = 'CONTRIBUTOR'
) {
  return prisma.projectMember.create({
    data: { projectId, userId, role },
  });
}

// ─────────────────────────────────────────────
// JWT helper
// ─────────────────────────────────────────────

export function makeProjectToken(
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

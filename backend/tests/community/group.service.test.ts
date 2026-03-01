/**
 * @file tests/community/group.service.test.ts
 * @description Unit tests for GroupService — createVoluntaryGroup, joinGroup, leaveGroup.
 *
 * Uses real Prisma against postgres_test DB.
 * DB truncated before each test by testSetup.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { groupService } from '../../src/modules/community/services/group.service.js';
import { VOLUNTARY_GROUP_PR_COST } from '../../src/modules/community/types.js';
import {
  seedLocation,
  createCommunityTestUser,
  awardPR,
  seedVoluntaryGroup,
} from './helpers.js';

beforeEach(async () => {
  await seedLocation();
});

// ─────────────────────────────────────────────────────────────────────────────
// createVoluntaryGroup()
// ─────────────────────────────────────────────────────────────────────────────

describe('createVoluntaryGroup()', () => {
  it('creates the group and leader membership', async () => {
    const user = await createCommunityTestUser('creator@example.com');
    await awardPR(user.id, 200);

    const group = await groupService.createVoluntaryGroup(user.id, {
      name: 'Biz Collective',
      voluntaryType: 'BUSINESS_COLLECTIVE',
      description: 'A test group',
    });

    expect(group.name).toBe('Biz Collective');
    expect(group.isSystemGroup).toBe(false);
    expect(group.voluntaryType).toBe('BUSINESS_COLLECTIVE');

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('LEADER');
    expect(membership!.canLeave).toBe(true);
  });

  it('spends 100 PR on successful creation', async () => {
    const user = await createCommunityTestUser('spender@example.com');
    await awardPR(user.id, 200);

    await groupService.createVoluntaryGroup(user.id, {
      name: 'Savings Group',
      voluntaryType: 'SAVINGS_CREDIT',
    });

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { participationRights: true },
    });
    expect(updated!.participationRights).toBe(200 - VOLUNTARY_GROUP_PR_COST);
  });

  it('throws 400 for invalid voluntaryType', async () => {
    const user = await createCommunityTestUser('invalid-type@example.com');
    await awardPR(user.id, 200);

    await expect(
      groupService.createVoluntaryGroup(user.id, {
        name: 'Bad Group',
        voluntaryType: 'NOT_A_REAL_TYPE',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws if user has insufficient PR', async () => {
    const user = await createCommunityTestUser('broke@example.com');
    // Give less than 100 PR
    await awardPR(user.id, 50);

    await expect(
      groupService.createVoluntaryGroup(user.id, {
        name: 'Cannot Afford',
        voluntaryType: 'BUSINESS_COLLECTIVE',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws if user has zero PR', async () => {
    const user = await createCommunityTestUser('zero-pr@example.com');
    // No PR awarded

    await expect(
      groupService.createVoluntaryGroup(user.id, {
        name: 'No Money Group',
        voluntaryType: 'YOUTH_ORGANIZATION',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates group without optional description', async () => {
    const user = await createCommunityTestUser('nodesc@example.com');
    await awardPR(user.id, 200);

    const group = await groupService.createVoluntaryGroup(user.id, {
      name: 'No Desc Group',
      voluntaryType: 'PROJECT_EXECUTION',
    });

    expect(group.id).toBeDefined();
    expect(group.description).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// joinGroup()
// ─────────────────────────────────────────────────────────────────────────────

describe('joinGroup()', () => {
  it('creates a MEMBER membership for a voluntary group', async () => {
    const owner = await createCommunityTestUser('owner@example.com');
    const joiner = await createCommunityTestUser('joiner@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Open Group');

    const membership = await groupService.joinGroup(joiner.id, group.id);

    expect(membership.role).toBe('MEMBER');
    expect(membership.userId).toBe(joiner.id);
    expect(membership.groupId).toBe(group.id);
    expect(membership.canLeave).toBe(true);
  });

  it('throws 404 for non-existent group', async () => {
    const user = await createCommunityTestUser('nogroup@example.com');
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await expect(groupService.joinGroup(user.id, fakeId)).rejects.toMatchObject(
      { statusCode: 404 }
    );
  });

  it('throws 400 when trying to join a system group', async () => {
    const user = await createCommunityTestUser('sysgroup@example.com');

    // Create a system group manually
    const sysGroup = await prisma.group.create({
      data: {
        name: 'Ward Community',
        isSystemGroup: true,
        locationScope: 'WARD',
        status: 'ACTIVE',
      },
    });

    await expect(
      groupService.joinGroup(user.id, sysGroup.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 409 when user is already a member', async () => {
    const owner = await createCommunityTestUser('dup-owner@example.com');
    const joiner = await createCommunityTestUser('dup-joiner@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Dup Group');

    // Join once
    await groupService.joinGroup(joiner.id, group.id);

    // Try to join again
    await expect(
      groupService.joinGroup(joiner.id, group.id)
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// leaveGroup()
// ─────────────────────────────────────────────────────────────────────────────

describe('leaveGroup()', () => {
  it('removes the membership record', async () => {
    const owner = await createCommunityTestUser('leave-owner@example.com');
    const member = await createCommunityTestUser('leaver@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Leave Test Group');

    await groupService.joinGroup(member.id, group.id);
    const result = await groupService.leaveGroup(member.id, group.id);

    expect(result.success).toBe(true);

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: member.id, groupId: group.id } },
    });
    expect(membership).toBeNull();
  });

  it('throws 404 when user is not a member', async () => {
    const owner = await createCommunityTestUser('no-mem-owner@example.com');
    const nonMember = await createCommunityTestUser('not-member@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Some Group');

    await expect(
      groupService.leaveGroup(nonMember.id, group.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when canLeave is false', async () => {
    const user = await createCommunityTestUser('noleave@example.com');
    const group = await prisma.group.create({
      data: {
        name: 'Locked Group',
        isSystemGroup: true,
        locationScope: 'NATIONAL',
        status: 'ACTIVE',
      },
    });

    // Create a membership with canLeave=false (system groups have this)
    await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: group.id,
        role: 'MEMBER',
        autoEnrolled: true,
        canLeave: false,
        joinedAt: new Date(),
        active: true,
      },
    });

    await expect(
      groupService.leaveGroup(user.id, group.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

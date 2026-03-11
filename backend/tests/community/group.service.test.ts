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
import { groupMembershipService } from '../../src/modules/community/services/groupMembership.service.js';
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

// ─────────────────────────────────────────────────────────────────────────────
// memberCount correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('memberCount tracking', () => {
  it('createVoluntaryGroup sets memberCount to 1', async () => {
    const user = await createCommunityTestUser('mc-create@example.com');
    await awardPR(user.id, 200);

    const group = await groupService.createVoluntaryGroup(user.id, {
      name: 'MC Create Group',
      voluntaryType: 'BUSINESS_COLLECTIVE',
    });

    const updated = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });
    expect(updated!.memberCount).toBe(1);
  });

  it('joinGroup increments memberCount', async () => {
    const owner = await createCommunityTestUser('mc-owner@example.com');
    const joiner = await createCommunityTestUser('mc-joiner@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'MC Join Group');

    const before = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });
    await groupService.joinGroup(joiner.id, group.id);
    const after = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });

    expect(after!.memberCount).toBe(before!.memberCount + 1);
  });

  it('leaveGroup decrements memberCount', async () => {
    const owner = await createCommunityTestUser('mc-leave-owner@example.com');
    const member = await createCommunityTestUser('mc-leave-member@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'MC Leave Group');
    await groupService.joinGroup(member.id, group.id);

    const before = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });
    await groupService.leaveGroup(member.id, group.id);
    const after = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });

    expect(after!.memberCount).toBe(before!.memberCount - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateGroupSettings()
// ─────────────────────────────────────────────────────────────────────────────

describe('updateGroupSettings()', () => {
  it('updates name and description for LEADER', async () => {
    const leader = await createCommunityTestUser('us-leader@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Settings Test Group');

    const updated = await groupService.updateGroupSettings(leader.id, group.id, {
      name: 'Renamed Group',
      description: 'New description',
    });

    expect(updated.name).toBe('Renamed Group');
    expect(updated.description).toBe('New description');
  });

  it('throws 403 for MEMBER', async () => {
    const owner = await createCommunityTestUser('us-owner@example.com');
    const member = await createCommunityTestUser('us-member@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Member Cannot Change');
    await groupService.joinGroup(member.id, group.id);

    await expect(
      groupService.updateGroupSettings(member.id, group.id, { name: 'Hacked Name' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 for system group', async () => {
    const user = await createCommunityTestUser('us-sys@example.com');
    const sysGroup = await prisma.group.create({
      data: { name: 'Official Ward', isSystemGroup: true, locationScope: 'WARD', status: 'ACTIVE' },
    });
    await prisma.groupMember.create({
      data: { userId: user.id, groupId: sysGroup.id, role: 'LEADER', autoEnrolled: true, canLeave: false, joinedAt: new Date(), active: true },
    });

    await expect(
      groupService.updateGroupSettings(user.id, sysGroup.id, { name: 'Cannot Rename' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// changeMemberRole()
// ─────────────────────────────────────────────────────────────────────────────

describe('changeMemberRole()', () => {
  it('LEADER can promote a member to TREASURER', async () => {
    const leader = await createCommunityTestUser('cr-leader@example.com');
    const member = await createCommunityTestUser('cr-member@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Role Test Group');
    await groupService.joinGroup(member.id, group.id);

    const result = await groupService.changeMemberRole(leader.id, group.id, member.id, 'TREASURER');

    expect(result.role).toBe('TREASURER');
    expect(result.userId).toBe(member.id);
  });

  it('throws 403 when MEMBER tries to change role', async () => {
    const owner = await createCommunityTestUser('cr-owner@example.com');
    const member = await createCommunityTestUser('cr-actor@example.com');
    const target = await createCommunityTestUser('cr-target@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Role 403 Group');
    await groupService.joinGroup(member.id, group.id);
    await groupService.joinGroup(target.id, group.id);

    await expect(
      groupService.changeMemberRole(member.id, group.id, target.id, 'TREASURER')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when trying to change own role', async () => {
    const leader = await createCommunityTestUser('cr-self@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Self Role Group');

    await expect(
      groupService.changeMemberRole(leader.id, group.id, leader.id, 'MEMBER')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when target is not a member', async () => {
    const leader = await createCommunityTestUser('cr-404leader@example.com');
    const nonMember = await createCommunityTestUser('cr-nonmember@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Role 404 Group');

    await expect(
      groupService.changeMemberRole(leader.id, group.id, nonMember.id, 'TREASURER')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeMember()
// ─────────────────────────────────────────────────────────────────────────────

describe('removeMember()', () => {
  it('LEADER can remove a member', async () => {
    const leader = await createCommunityTestUser('rm-leader@example.com');
    const target = await createCommunityTestUser('rm-target@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Remove Test Group');
    await groupService.joinGroup(target.id, group.id);

    const result = await groupService.removeMember(leader.id, group.id, target.id);

    expect(result.success).toBe(true);

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: target.id, groupId: group.id } },
    });
    expect(membership).toBeNull();
  });

  it('decrements memberCount after removal', async () => {
    const leader = await createCommunityTestUser('rm-count@example.com');
    const target = await createCommunityTestUser('rm-count-target@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Remove Count Group');
    await groupService.joinGroup(target.id, group.id);

    const before = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });
    await groupService.removeMember(leader.id, group.id, target.id);
    const after = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });

    expect(after!.memberCount).toBe(before!.memberCount - 1);
  });

  it('throws 403 when MEMBER tries to remove another member', async () => {
    const owner = await createCommunityTestUser('rm-owner@example.com');
    const aggressor = await createCommunityTestUser('rm-aggressor@example.com');
    const victim = await createCommunityTestUser('rm-victim@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Remove 403 Group');
    await groupService.joinGroup(aggressor.id, group.id);
    await groupService.joinGroup(victim.id, group.id);

    await expect(
      groupService.removeMember(aggressor.id, group.id, victim.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when leader tries to remove themselves', async () => {
    const leader = await createCommunityTestUser('rm-self@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Remove Self Group');

    await expect(
      groupService.removeMember(leader.id, group.id, leader.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getGroups() — discovery with isMember flag
// ─────────────────────────────────────────────────────────────────────────────

describe('getGroups() — isMember flag', () => {
  it('sets isMember=true and myRole for groups the user has joined', async () => {
    const owner = await createCommunityTestUser('gm-owner@example.com');
    const viewer = await createCommunityTestUser('gm-viewer@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'GetGroups Test Group');
    await groupService.joinGroup(viewer.id, group.id);

    const result = await groupMembershipService.getGroups(viewer.id);

    const found = result.groups.find((g) => g.id === group.id);
    expect(found).toBeDefined();
    expect(found!.isMember).toBe(true);
    expect(found!.myRole).toBe('MEMBER');
  });

  it('sets isMember=false for groups the user has not joined', async () => {
    const owner = await createCommunityTestUser('gm-owner2@example.com');
    const other = await createCommunityTestUser('gm-other@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'GetGroups Other Group');

    const result = await groupMembershipService.getGroups(other.id);

    const found = result.groups.find((g) => g.id === group.id);
    expect(found).toBeDefined();
    expect(found!.isMember).toBe(false);
    expect(found!.myRole).toBeNull();
  });
});

/**
 * @file tests/community/groupMembership.service.test.ts
 * @description Unit tests for GroupMembershipService.
 *
 * Covers: enrollInSystemGroups, updateResidenceGroups, getUserGroups, getGroupMembers.
 *
 * Note: enrollInSystemGroups uses Promise.all concurrently inside a transaction.
 * Passing the same ward for primary AND secondary causes a concurrent group-create
 * race (unique constraint on Group.name). Use two distinct wards: TEST_WARD_ID (primary)
 * and TEST_WARD_ID_B (secondary, same constituency) to avoid the race.
 *
 * Both wards share the same constituency/county, so secondary constituency + county
 * groups are deduplicated and only primary ward + secondary ward + constituency + county
 * + national = 5 system groups are created.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { groupMembershipService } from '../../src/modules/community/services/groupMembership.service.js';
import {
  seedLocation,
  seedSecondWard,
  createCommunityTestUser,
  TEST_WARD_ID,
  TEST_WARD_ID_B,
  TEST_CONST_ID,
  TEST_COUNTY_ID,
} from './helpers.js';

beforeEach(async () => {
  await seedLocation();
  await seedSecondWard();
});

// ─────────────────────────────────────────────────────────────────────────────
// enrollInSystemGroups()
// ─────────────────────────────────────────────────────────────────────────────

describe('enrollInSystemGroups()', () => {
  it('creates system groups and enrolls user (distinct primary/secondary wards, same constituency)', async () => {
    const user = await createCommunityTestUser('enroll@example.com');

    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id, active: true },
      include: { group: { select: { isSystemGroup: true, locationScope: true } } },
    });

    // primary ward + secondary ward + constituency + county + national = 5
    expect(memberships.length).toBe(5);
    expect(memberships.every((m) => m.group.isSystemGroup)).toBe(true);
    expect(memberships.every((m) => m.autoEnrolled)).toBe(true);
  });

  it('enrolls in national group', async () => {
    const user = await createCommunityTestUser('national@example.com');

    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id, active: true },
      include: { group: { select: { locationScope: true } } },
    });

    const scopes = memberships.map((m) => m.group.locationScope);
    expect(scopes).toContain('NATIONAL');
    expect(scopes).toContain('WARD');
    expect(scopes).toContain('CONSTITUENCY');
    expect(scopes).toContain('COUNTY');
  });

  it('is idempotent — calling twice does not duplicate memberships', async () => {
    const user = await createCommunityTestUser('idempotent@example.com');

    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );
    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id, active: true },
    });

    expect(memberships.length).toBe(5);
  });

  it('increments memberCount on the system group', async () => {
    const user = await createCommunityTestUser('count@example.com');

    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const wardGroup = await prisma.group.findFirst({
      where: { isSystemGroup: true, locationScope: 'WARD', wardId: TEST_WARD_ID },
    });
    expect(wardGroup).not.toBeNull();
    expect(wardGroup!.memberCount).toBe(1);
  });

  it('does not increment memberCount on re-enrollment', async () => {
    const user = await createCommunityTestUser('recount@example.com');

    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );
    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const wardGroup = await prisma.group.findFirst({
      where: { isSystemGroup: true, locationScope: 'WARD', wardId: TEST_WARD_ID },
    });
    expect(wardGroup!.memberCount).toBe(1);
  });

  it('throws for non-existent ward', async () => {
    const user = await createCommunityTestUser('badward@example.com');
    const fakeWardId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    await expect(
      groupMembershipService.enrollInSystemGroups(user.id, fakeWardId, TEST_WARD_ID)
    ).rejects.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateResidenceGroups()
// ─────────────────────────────────────────────────────────────────────────────

describe('updateResidenceGroups()', () => {
  it('completes without error and user remains enrolled after re-enrollment', async () => {
    const user = await createCommunityTestUser('mover@example.com');

    // Initial enrollment
    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    // Update secondaryWardId so updateResidenceGroups can read it when called without explicit secondary
    await prisma.user.update({
      where: { id: user.id },
      data: { secondaryWardId: TEST_WARD_ID_B },
    });

    // Swap primary and secondary — same group pool, so upsert re-activates all memberships
    await groupMembershipService.updateResidenceGroups(
      user.id,
      TEST_WARD_ID_B,
      TEST_WARD_ID
    );

    // After re-enrollment, user should have active system group memberships
    const activeMemberships = await prisma.groupMember.findMany({
      where: { userId: user.id, autoEnrolled: true, active: true },
    });
    expect(activeMemberships.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getUserGroups()
// ─────────────────────────────────────────────────────────────────────────────

describe('getUserGroups()', () => {
  it('returns all active group memberships', async () => {
    const user = await createCommunityTestUser('mygroups@example.com');
    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const groups = await groupMembershipService.getUserGroups(user.id);

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveProperty('groupId');
    expect(groups[0]).toHaveProperty('groupName');
    expect(groups[0]).toHaveProperty('role');
    expect(groups[0]).toHaveProperty('joinedAt');
  });

  it('returns empty array for user with no memberships', async () => {
    const user = await createCommunityTestUser('nomember@example.com');

    const groups = await groupMembershipService.getUserGroups(user.id);

    expect(groups).toEqual([]);
  });

  it('filters by system only (includeVoluntary=false)', async () => {
    const user = await createCommunityTestUser('filter-sys@example.com');
    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const voluntaryGroup = await prisma.group.create({
      data: {
        name: 'Vol Group Filter Test',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'BUSINESS_COLLECTIVE',
      },
    });
    await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: voluntaryGroup.id,
        role: 'MEMBER',
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });

    const systemOnly = await groupMembershipService.getUserGroups(user.id, true, false);

    expect(systemOnly.every((g) => g.isSystem)).toBe(true);
    expect(systemOnly.some((g) => !g.isSystem)).toBe(false);
  });

  it('filters by voluntary only (includeSystem=false)', async () => {
    const user = await createCommunityTestUser('filter-vol@example.com');
    await groupMembershipService.enrollInSystemGroups(
      user.id,
      TEST_WARD_ID,
      TEST_WARD_ID_B
    );

    const voluntaryGroup = await prisma.group.create({
      data: {
        name: 'Only Vol Group',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'SAVINGS_CREDIT',
      },
    });
    await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: voluntaryGroup.id,
        role: 'MEMBER',
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });

    const volOnly = await groupMembershipService.getUserGroups(user.id, false, true);

    expect(volOnly.every((g) => !g.isSystem)).toBe(true);
    expect(volOnly.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getGroupMembers()
// ─────────────────────────────────────────────────────────────────────────────

describe('getGroupMembers()', () => {
  it('returns active members with user metadata', async () => {
    const owner = await createCommunityTestUser('gm-owner@example.com');
    const member = await createCommunityTestUser('gm-member@example.com');

    const group = await prisma.group.create({
      data: {
        name: 'Members Test Group',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'PROJECT_EXECUTION',
      },
    });
    await prisma.groupMember.createMany({
      data: [
        {
          userId: owner.id,
          groupId: group.id,
          role: 'LEADER',
          autoEnrolled: false,
          canLeave: true,
          joinedAt: new Date(),
          active: true,
        },
        {
          userId: member.id,
          groupId: group.id,
          role: 'MEMBER',
          autoEnrolled: false,
          canLeave: true,
          joinedAt: new Date(),
          active: true,
        },
      ],
    });

    const members = await groupMembershipService.getGroupMembers(group.id);

    expect(members.length).toBe(2);
    expect(members[0]).toHaveProperty('userId');
    expect(members[0]).toHaveProperty('userName');
    expect(members[0]).toHaveProperty('role');
    expect(members[0]).toHaveProperty('joinedAt');
  });

  it('does not return inactive members', async () => {
    const user = await createCommunityTestUser('inactive-mem@example.com');

    const group = await prisma.group.create({
      data: {
        name: 'Active Only Group',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'YOUTH_ORGANIZATION',
      },
    });
    await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: group.id,
        role: 'MEMBER',
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: false,
      },
    });

    const members = await groupMembershipService.getGroupMembers(group.id);

    expect(members.length).toBe(0);
  });

  it('returns empty array for group with no members', async () => {
    const group = await prisma.group.create({
      data: {
        name: 'Empty Group',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'TECHNOLOGY_HUB',
      },
    });

    const members = await groupMembershipService.getGroupMembers(group.id);

    expect(members).toEqual([]);
  });

  it('respects pagination (limit/offset)', async () => {
    const group = await prisma.group.create({
      data: {
        name: 'Paginate Group',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'BUSINESS_COLLECTIVE',
      },
    });

    for (let i = 0; i < 3; i++) {
      const u = await createCommunityTestUser(`page-user-${i}@example.com`);
      await prisma.groupMember.create({
        data: {
          userId: u.id,
          groupId: group.id,
          role: 'MEMBER',
          autoEnrolled: false,
          canLeave: true,
          joinedAt: new Date(),
          active: true,
        },
      });
    }

    const page1 = await groupMembershipService.getGroupMembers(group.id, 2, 0);
    const page2 = await groupMembershipService.getGroupMembers(group.id, 2, 2);

    expect(page1.length).toBe(2);
    expect(page2.length).toBe(1);
  });
});

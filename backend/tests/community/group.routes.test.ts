/**
 * @file tests/community/group.routes.test.ts
 * @description Supertest integration tests for community module routes.
 *
 * Routes under test:
 *   POST /community/voluntary/create
 *   POST /community/join
 *   POST /community/leave
 *
 * All routes require authenticate (valid JWT). No verificationLevel gate.
 * DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
    updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
    getUserGroups: vi.fn().mockResolvedValue([]),
    getGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupById: vi.fn().mockResolvedValue(null),
    getGroups: vi.fn().mockResolvedValue({ groups: [], total: 0, limit: 20, offset: 0 }),
  },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import { prisma } from '../../src/core/database/client.js';
import { ApiError } from '../../src/core/errors/ApiError.js';
import { participationRightsService } from '../../src/modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../src/modules/economy/types.js';
import {
  seedLocation,
  createCommunityTestUser,
  awardPR,
  seedVoluntaryGroup,
  makeCommunityToken,
} from './helpers.js';
import { groupService } from '../../src/modules/community/services/group.service.js';

const BASE = '/api/v1/community';

beforeAll(async () => {
  await servicesReady;
});

beforeEach(async () => {
  await seedLocation();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /community/voluntary/create
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /community/voluntary/create', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/voluntary/create`)
      .send({ name: 'My Group', voluntaryType: 'BUSINESS_COLLECTIVE' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing required fields', async () => {
    const user = await createCommunityTestUser('val-create@example.com');
    const token = makeCommunityToken(user.id);

    // Missing voluntaryType
    const res = await request(app)
      .post(`${BASE}/voluntary/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Group' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is too short (< 3 chars)', async () => {
    const user = await createCommunityTestUser('short-name@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/voluntary/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'AB', voluntaryType: 'BUSINESS_COLLECTIVE' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid voluntaryType', async () => {
    const user = await createCommunityTestUser('bad-type@example.com');
    await awardPR(user.id, 200);
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/voluntary/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Valid Name', voluntaryType: 'FAKE_TYPE_XYZ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when user has insufficient PR', async () => {
    const user = await createCommunityTestUser('broke-create@example.com');
    // Only 50 PR — not enough for 100 cost
    await participationRightsService.award(
      user.id,
      50,
      ParticipationRightsReason.EMAIL_VERIFIED
    );
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/voluntary/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Group', voluntaryType: 'BUSINESS_COLLECTIVE' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('creates group and returns 200 on success', async () => {
    const user = await createCommunityTestUser('success-create@example.com');
    await awardPR(user.id, 200);
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/voluntary/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Innovative Savings',
        voluntaryType: 'SAVINGS_CREDIT',
        description: 'A cooperative savings group',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Innovative Savings');
    expect(res.body.data.voluntaryType).toBe('SAVINGS_CREDIT');
    expect(res.body.data.isSystemGroup).toBe(false);
  });

  it('persists the group in the DB', async () => {
    const user = await createCommunityTestUser('persist@example.com');
    await awardPR(user.id, 200);
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/voluntary/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Persist Group', voluntaryType: 'YOUTH_ORGANIZATION' });

    expect(res.status).toBe(200);

    const group = await prisma.group.findUnique({ where: { id: res.body.data.id } });
    expect(group).not.toBeNull();
    expect(group!.name).toBe('Persist Group');

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: group!.id } },
    });
    expect(membership!.role).toBe('LEADER');
  });

  it('spends 100 PR from user balance', async () => {
    const user = await createCommunityTestUser('pr-spent@example.com');
    await awardPR(user.id, 200);
    const token = makeCommunityToken(user.id);

    await request(app)
      .post(`${BASE}/voluntary/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PR Cost Group', voluntaryType: 'TECHNOLOGY_HUB' });

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { participationRights: true },
    });
    expect(updated!.participationRights).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /community/join
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /community/join', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/join`)
      .send({ groupId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid UUID groupId', async () => {
    const user = await createCommunityTestUser('val-join@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing groupId', async () => {
    const user = await createCommunityTestUser('missing-gid@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for non-existent group', async () => {
    const user = await createCommunityTestUser('notfound-join@example.com');
    const token = makeCommunityToken(user.id);
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: fakeId });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when trying to join a system group', async () => {
    const user = await createCommunityTestUser('sys-join@example.com');
    const token = makeCommunityToken(user.id);

    const sysGroup = await prisma.group.create({
      data: {
        name: 'System Group',
        isSystemGroup: true,
        locationScope: 'NATIONAL',
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: sysGroup.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when already a member', async () => {
    const owner = await createCommunityTestUser('dup-owner-route@example.com');
    const joiner = await createCommunityTestUser('dup-joiner-route@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Dup Join Route Group');
    const token = makeCommunityToken(joiner.id);

    // First join
    await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: group.id });

    // Second join
    const res = await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: group.id });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 and creates MEMBER membership on success', async () => {
    const owner = await createCommunityTestUser('owner-join-route@example.com');
    const joiner = await createCommunityTestUser('joiner-route@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Join Route Group');
    const token = makeCommunityToken(joiner.id);

    const res = await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: group.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('MEMBER');
    expect(res.body.data.userId).toBe(joiner.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /community/leave
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /community/leave', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/leave`)
      .send({ groupId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid UUID groupId', async () => {
    const user = await createCommunityTestUser('val-leave@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/leave`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing groupId', async () => {
    const user = await createCommunityTestUser('missing-leave@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .post(`${BASE}/leave`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when user is not a member', async () => {
    const owner = await createCommunityTestUser('not-member-owner@example.com');
    const nonMember = await createCommunityTestUser('not-member-leave@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Leave 404 Group');
    const token = makeCommunityToken(nonMember.id);

    const res = await request(app)
      .post(`${BASE}/leave`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: group.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when canLeave is false', async () => {
    const user = await createCommunityTestUser('noleave-route@example.com');
    const token = makeCommunityToken(user.id);

    const group = await prisma.group.create({
      data: {
        name: 'Locked System Group',
        isSystemGroup: true,
        locationScope: 'NATIONAL',
        status: 'ACTIVE',
      },
    });
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

    const res = await request(app)
      .post(`${BASE}/leave`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: group.id });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 and removes membership on success', async () => {
    const owner = await createCommunityTestUser('leave-owner-route@example.com');
    const member = await createCommunityTestUser('leave-member-route@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Leave Route Group');
    const memberToken = makeCommunityToken(member.id);

    // Join first
    await request(app)
      .post(`${BASE}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ groupId: group.id });

    // Leave
    const res = await request(app)
      .post(`${BASE}/leave`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ groupId: group.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify DB
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: member.id, groupId: group.id } },
    });
    expect(membership).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /community  (group discovery)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /community', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it('returns 200 with paginated groups list', async () => {
    const owner = await createCommunityTestUser('disc-owner@example.com');
    await awardPR(owner.id, 200);
    await seedVoluntaryGroup(owner.id, 'Discovery Group A');
    await seedVoluntaryGroup(owner.id, 'Discovery Group B');
    const token = makeCommunityToken(owner.id);

    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.groups)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
  });

  it('accepts isSystem=false filter', async () => {
    const user = await createCommunityTestUser('disc-filter@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .get(`${BASE}?isSystem=false`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts search query param', async () => {
    const user = await createCommunityTestUser('disc-search@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .get(`${BASE}?search=savings`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('passes isMember and myRole from service to response', async () => {
    const { groupMembershipService } = await import('../../src/modules/community/services/groupMembership.service.js');
    const user = await createCommunityTestUser('ismem-route@example.com');
    const token = makeCommunityToken(user.id);
    const fakeGroupId = 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff';

    vi.mocked(groupMembershipService.getGroups).mockResolvedValueOnce({
      groups: [{ id: fakeGroupId, name: 'Test', isMember: true, myRole: 'MEMBER' } as any],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const found = res.body.data.groups.find((g: any) => g.id === fakeGroupId);
    expect(found).toBeDefined();
    expect(found.isMember).toBe(true);
    expect(found.myRole).toBe('MEMBER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /community/:groupId/settings
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /community/:groupId/settings', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/settings`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and updates name for LEADER', async () => {
    const leader = await createCommunityTestUser('settings-leader@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Original Name');
    const token = makeCommunityToken(leader.id);

    const res = await request(app)
      .patch(`${BASE}/${group.id}/settings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('returns 403 for MEMBER trying to update settings', async () => {
    const owner = await createCommunityTestUser('settings-owner@example.com');
    const member = await createCommunityTestUser('settings-member@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Members Cannot Edit');
    await groupService.joinGroup(member.id, group.id);
    const token = makeCommunityToken(member.id);

    const res = await request(app)
      .patch(`${BASE}/${group.id}/settings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is too short', async () => {
    const leader = await createCommunityTestUser('settings-short@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Short Name Test');
    const token = makeCommunityToken(leader.id);

    const res = await request(app)
      .patch(`${BASE}/${group.id}/settings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'AB' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /community/:groupId/members/:userId/role
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /community/:groupId/members/:userId/role', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/members/bbbbbbbb-cccc-dddd-eeee-ffffffffffff/role`)
      .send({ role: 'TREASURER' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and updates role for LEADER', async () => {
    const leader = await createCommunityTestUser('role-leader@example.com');
    const member = await createCommunityTestUser('role-member@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Role Change Group');
    await groupService.joinGroup(member.id, group.id);
    const token = makeCommunityToken(leader.id);

    const res = await request(app)
      .patch(`${BASE}/${group.id}/members/${member.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'TREASURER' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('TREASURER');
  });

  it('returns 403 when non-LEADER tries to change role', async () => {
    const owner = await createCommunityTestUser('role-owner@example.com');
    const member = await createCommunityTestUser('role-nonleader@example.com');
    const target = await createCommunityTestUser('role-target@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Role 403 Group');
    await groupService.joinGroup(member.id, group.id);
    await groupService.joinGroup(target.id, group.id);
    const token = makeCommunityToken(member.id);

    const res = await request(app)
      .patch(`${BASE}/${group.id}/members/${target.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'TREASURER' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid role value', async () => {
    const leader = await createCommunityTestUser('role-badval@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Role Bad Val Group');
    const token = makeCommunityToken(leader.id);

    const res = await request(app)
      .patch(`${BASE}/${group.id}/members/${leader.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SUPERUSER' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /community/:groupId/members/:userId
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /community/:groupId/members/:userId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .delete(`${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/members/bbbbbbbb-cccc-dddd-eeee-ffffffffffff`);
    expect(res.status).toBe(401);
  });

  it('returns 200 and removes the member for LEADER', async () => {
    const leader = await createCommunityTestUser('kick-leader@example.com');
    const target = await createCommunityTestUser('kick-target@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Kick Test Group');
    await groupService.joinGroup(target.id, group.id);
    const token = makeCommunityToken(leader.id);

    const res = await request(app)
      .delete(`${BASE}/${group.id}/members/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: target.id, groupId: group.id } },
    });
    expect(membership).toBeNull();
  });

  it('returns 403 when MEMBER tries to remove another member', async () => {
    const owner = await createCommunityTestUser('kick-owner@example.com');
    const aggressor = await createCommunityTestUser('kick-aggressor@example.com');
    const victim = await createCommunityTestUser('kick-victim@example.com');
    await awardPR(owner.id, 200);
    const group = await seedVoluntaryGroup(owner.id, 'Kick 403 Group');
    await groupService.joinGroup(aggressor.id, group.id);
    await groupService.joinGroup(victim.id, group.id);
    const token = makeCommunityToken(aggressor.id);

    const res = await request(app)
      .delete(`${BASE}/${group.id}/members/${victim.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('decrements memberCount after removal', async () => {
    const leader = await createCommunityTestUser('kick-count-leader@example.com');
    const target = await createCommunityTestUser('kick-count-target@example.com');
    await awardPR(leader.id, 200);
    const group = await seedVoluntaryGroup(leader.id, 'Kick Count Group');
    await groupService.joinGroup(target.id, group.id);
    const token = makeCommunityToken(leader.id);

    const before = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });

    await request(app)
      .delete(`${BASE}/${group.id}/members/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    const after = await prisma.group.findUnique({ where: { id: group.id }, select: { memberCount: true } });
    expect(after!.memberCount).toBe(before!.memberCount - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /community/my-groups
// NOTE: groupMembershipService is mocked at module level — getUserGroups returns []
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /community/my-groups', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`${BASE}/my-groups`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty array (default mock)', async () => {
    const user = await createCommunityTestUser('mygroups-user@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .get(`${BASE}/my-groups`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns membership entries when mock provides them', async () => {
    const { groupMembershipService } = await import('../../src/modules/community/services/groupMembership.service.js');
    const user = await createCommunityTestUser('mygroups-mock@example.com');
    const token = makeCommunityToken(user.id);
    const fakeGroupId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

    vi.mocked(groupMembershipService.getUserGroups).mockResolvedValueOnce([
      {
        groupId: fakeGroupId,
        groupName: 'Mock Savings Group',
        systemType: null,
        voluntaryType: 'SAVINGS_CREDIT',
        isSystem: false,
        locationScope: 'WARD',
        role: 'LEADER',
        joinedAt: new Date().toISOString(),
        memberCount: 1,
        ward: null,
        constituency: null,
        county: null,
      } as any,
    ]);

    const res = await request(app)
      .get(`${BASE}/my-groups`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((g: any) => g.groupId === fakeGroupId);
    expect(found).toBeDefined();
    expect(found.role).toBe('LEADER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /community/:groupId
// NOTE: groupMembershipService.getGroupById is mocked — override per test
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /community/:groupId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(
      `${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when service throws not-found', async () => {
    const { groupMembershipService } = await import('../../src/modules/community/services/groupMembership.service.js');
    const user = await createCommunityTestUser('getgroup-404@example.com');
    const token = makeCommunityToken(user.id);

    vi.mocked(groupMembershipService.getGroupById).mockRejectedValueOnce(
      ApiError.notFound('Group not found')
    );

    const res = await request(app)
      .get(`${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with group detail shape', async () => {
    const { groupMembershipService } = await import('../../src/modules/community/services/groupMembership.service.js');
    const user = await createCommunityTestUser('getgroup-200@example.com');
    const token = makeCommunityToken(user.id);
    const fakeGroupId = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa';

    vi.mocked(groupMembershipService.getGroupById).mockResolvedValueOnce({
      groupId: fakeGroupId,
      groupName: 'GetGroup Detail Test',
      description: null,
      isSystem: false,
      systemType: null,
      voluntaryType: 'BUSINESS_COLLECTIVE',
      locationScope: 'WARD',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      ward: null,
      constituency: null,
      county: null,
      userRole: 'LEADER',
      userJoinedAt: new Date().toISOString(),
    } as any);

    const res = await request(app)
      .get(`${BASE}/${fakeGroupId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.groupId).toBe(fakeGroupId);
    expect(res.body.data.groupName).toBe('GetGroup Detail Test');
    expect(res.body.data.userRole).toBe('LEADER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /community/:groupId/members
// NOTE: groupMembershipService.getGroupMembers is mocked — returns [] by default
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /community/:groupId/members', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(
      `${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/members`
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with an array (default mock)', async () => {
    const user = await createCommunityTestUser('members-basic@example.com');
    const token = makeCommunityToken(user.id);

    const res = await request(app)
      .get(`${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/members`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns members when mock provides them', async () => {
    const { groupMembershipService } = await import('../../src/modules/community/services/groupMembership.service.js');
    const user = await createCommunityTestUser('members-mock@example.com');
    const token = makeCommunityToken(user.id);

    vi.mocked(groupMembershipService.getGroupMembers).mockResolvedValueOnce([
      { userId: 'u1', userName: 'Alice', avatarUrl: null, verificationLevel: 'COMMUNITY_VERIFIED', participationRights: 100, role: 'LEADER', joinedAt: new Date().toISOString() },
      { userId: 'u2', userName: 'Bob',   avatarUrl: null, verificationLevel: 'COMMUNITY_VERIFIED', participationRights: 50,  role: 'MEMBER', joinedAt: new Date().toISOString() },
    ] as any);

    const res = await request(app)
      .get(`${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/members`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].userName).toBe('Alice');
  });
});

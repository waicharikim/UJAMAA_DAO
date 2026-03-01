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
import { participationRightsService } from '../../src/modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../src/modules/economy/types.js';
import {
  seedLocation,
  createCommunityTestUser,
  awardPR,
  seedVoluntaryGroup,
  makeCommunityToken,
} from './helpers.js';

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

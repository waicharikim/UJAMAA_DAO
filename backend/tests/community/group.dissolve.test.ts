/**
 * @file tests/community/group.dissolve.test.ts
 * Service unit tests + route integration tests for group dissolution and
 * ward declarations — features added in session 47.
 *
 * Covers: generateDeclaration(), getDeclaration(), dissolveGroup()
 * auditService mocked throughout.
 */

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

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
import { groupService } from '../../src/modules/community/services/group.service.js';
import {
  seedLocation,
  createCommunityTestUser,
  makeCommunityToken,
  seedVoluntaryGroup,
} from './helpers.js';

const BASE = '/api/v1/community';

// ─────────────────────────────────────────────────────────────────────────────
// Service unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('GroupService — generateDeclaration()', () => {
  let groupId: string;

  beforeEach(async () => {
    await seedLocation();
    const user = await createCommunityTestUser(`gd-gen-${Date.now()}@test.com`);
    const group = await seedVoluntaryGroup(user.id);
    groupId = group.id;
  });

  it('creates a ward declaration with the ward name and group ID', async () => {
    await groupService.generateDeclaration(groupId, 'Westlands Ward', new Date());
    const declaration = await prisma.wardDeclaration.findUnique({
      where: { groupId },
    });
    expect(declaration).not.toBeNull();
    expect(declaration!.wardName).toBe('Westlands Ward');
    expect(declaration!.groupId).toBe(groupId);
    expect(declaration!.declarationText).toContain('Westlands Ward');
  });

  it('declaration text contains the Ujamaa manifesto content', async () => {
    await groupService.generateDeclaration(groupId, 'Kibra Ward', new Date());
    const declaration = await prisma.wardDeclaration.findUnique({
      where: { groupId },
    });
    expect(declaration!.declarationText).toContain(
      'You have always been the government'
    );
    expect(declaration!.declarationText).toContain('Ujamaa');
  });

  it('is idempotent — calling twice does not throw', async () => {
    await groupService.generateDeclaration(groupId, 'Test Ward', new Date());
    await expect(
      groupService.generateDeclaration(groupId, 'Test Ward', new Date())
    ).resolves.not.toThrow();
  });
});

describe('GroupService — getDeclaration()', () => {
  let groupId: string;

  beforeEach(async () => {
    await seedLocation();
    const user = await createCommunityTestUser(`gd-get-${Date.now()}@test.com`);
    const group = await seedVoluntaryGroup(user.id);
    groupId = group.id;
  });

  it('returns the declaration for a group that has one', async () => {
    await groupService.generateDeclaration(groupId, 'Ruiru Ward', new Date());
    const declaration = await groupService.getDeclaration(groupId);
    expect(declaration.groupId).toBe(groupId);
    expect(declaration.wardName).toBe('Ruiru Ward');
  });

  it('throws 404 when no declaration exists for the group', async () => {
    await expect(
      groupService.getDeclaration(groupId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('GroupService — dissolveGroup()', () => {
  let userId: string;
  let groupId: string;

  beforeEach(async () => {
    await seedLocation();
    const user = await createCommunityTestUser(`gd-dis-${Date.now()}@test.com`);
    userId = user.id;
    const group = await seedVoluntaryGroup(userId);
    groupId = group.id;
  });

  it('marks the group DISSOLVED and deactivates all memberships', async () => {
    const result = await groupService.dissolveGroup(
      userId,
      groupId,
      'Testing dissolution flow'
    );
    expect(result.status).toBe('DISSOLVED');

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    expect(group!.status).toBe('DISSOLVED');

    const activeMembers = await prisma.groupMember.findMany({
      where: { groupId, active: true },
    });
    expect(activeMembers).toHaveLength(0);
  });

  it('throws 403 when the caller is not the group leader', async () => {
    const other = await createCommunityTestUser(
      `gd-non-${Date.now()}@test.com`
    );
    await expect(
      groupService.dissolveGroup(other.id, groupId, 'Unauthorized attempt')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 for a system group', async () => {
    const sysGroup = await prisma.group.create({
      data: {
        name: `System ${Date.now()}`,
        isSystemGroup: true,
        systemType: 'NATIONAL',
        locationScope: 'NATIONAL',
        status: 'ACTIVE',
      },
    });
    await prisma.groupMember.create({
      data: {
        userId,
        groupId: sysGroup.id,
        role: 'LEADER',
        autoEnrolled: false,
        canLeave: false,
        joinedAt: new Date(),
        active: true,
      },
    });
    await expect(
      groupService.dissolveGroup(userId, sysGroup.id, 'Cannot dissolve system')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 409 when the group is already dissolved', async () => {
    await groupService.dissolveGroup(userId, groupId, 'First dissolution');
    await expect(
      groupService.dissolveGroup(userId, groupId, 'Second dissolution attempt')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 400 when the group treasury balance is greater than zero', async () => {
    await prisma.group.update({
      where: { id: groupId },
      data: { treasuryBalance: 500 },
    });
    await expect(
      groupService.dissolveGroup(userId, groupId, 'Has treasury funds')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Group Declaration & Dissolve Routes', () => {
  let userId: string;
  let groupId: string;
  let token: string;

  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    await seedLocation();
    const user = await createCommunityTestUser(`gdr-u-${Date.now()}@test.com`);
    userId = user.id;
    const group = await seedVoluntaryGroup(userId);
    groupId = group.id;
    token = makeCommunityToken(userId);
  });

  // ── GET /community/:groupId/declaration ───────────────────────────────────

  describe('GET /community/:groupId/declaration', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).get(`${BASE}/${groupId}/declaration`);
      expect(res.status).toBe(401);
    });

    it('returns 404 when no declaration exists for the group', async () => {
      const res = await request(app)
        .get(`${BASE}/${groupId}/declaration`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 200 with declaration data when one exists', async () => {
      await groupService.generateDeclaration(groupId, 'Dagoretti North', new Date());
      const res = await request(app)
        .get(`${BASE}/${groupId}/declaration`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.wardName).toBe('Dagoretti North');
      expect(res.body.data.declarationText).toBeDefined();
    });
  });

  // ── DELETE /community/:groupId/dissolve ───────────────────────────────────

  describe('DELETE /community/:groupId/dissolve', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).delete(`${BASE}/${groupId}/dissolve`);
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller is not the group leader', async () => {
      const other = await createCommunityTestUser(
        `gdr-non-${Date.now()}@test.com`
      );
      const otherToken = makeCommunityToken(other.id);
      const res = await request(app)
        .delete(`${BASE}/${groupId}/dissolve`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ reason: 'Unauthorized dissolution attempt here' });
      expect(res.status).toBe(403);
    });

    it('dissolves the group and returns 200 with DISSOLVED status', async () => {
      const res = await request(app)
        .delete(`${BASE}/${groupId}/dissolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Testing HTTP dissolution route end to end' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISSOLVED');
    });
  });
});

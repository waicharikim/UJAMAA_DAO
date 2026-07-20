/**
 * @file tests/admin/admin.routes.test.ts
 * Route integration tests for admin role assignment and report endpoints
 */

// Hoist mocks before imports
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
  },
}));

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    award: vi.fn().mockResolvedValue(undefined),
    spend: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/notifications/services/notification.service.js', () => ({
  notificationService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import { makeAccessToken, seedLocation, TEST_WARD_ID } from '../auth/helpers.js';
import { prisma } from '../../src/core/database/client.js';

async function seedAdminAndToken() {
  await seedLocation();

  const admin = await prisma.user.create({
    data: {
      email: 'admin-routes-test@ujamaa.test',
      name: 'Admin Routes Test',
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'system:super_admin' },
    update: {},
    create: { name: 'system:super_admin', description: 'Super admin' },
  });

  await prisma.userRole.create({
    data: { userId: admin.id, roleId: role.id, active: true },
  });

  const token = makeAccessToken(admin.id, 'FULL_VERIFIED', {
    roles: ['system:super_admin'],
  });

  return { admin, token };
}

async function seedTargetUser() {
  return prisma.user.create({
    data: {
      email: `target-${Date.now()}@ujamaa.test`,
      name: 'Target User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

describe('Admin Role Assignment Routes', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    // testSetup.ts already truncates tables; seed fresh admin
  });

  it('POST /admin/users/:userId/roles — assigns role (200)', async () => {
    const { admin, token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    const res = await request(app)
      .post(`/api/v1/admin/users/${target.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'location:ward_admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const roles = await prisma.userRole.findMany({
      where: { userId: target.id, active: true },
      include: { role: true },
    });
    expect(roles.some((r) => r.role.name === 'location:ward_admin')).toBe(true);
  });

  it('POST /admin/users/:userId/roles — 400 for invalid role', async () => {
    const { token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    const res = await request(app)
      .post(`/api/v1/admin/users/${target.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'not:a:valid:role' });

    expect(res.status).toBe(400);
  });

  it('DELETE /admin/users/:userId/roles/:role — revokes role (200)', async () => {
    const { admin, token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    // First assign
    await request(app)
      .post(`/api/v1/admin/users/${target.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'location:ward_admin' });

    // Then revoke
    const res = await request(app)
      .delete(
        `/api/v1/admin/users/${target.id}/roles/${encodeURIComponent('location:ward_admin')}`
      )
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const roles = await prisma.userRole.findMany({
      where: { userId: target.id, active: true },
      include: { role: true },
    });
    expect(roles.some((r) => r.role.name === 'location:ward_admin')).toBe(false);
  });

  it('GET /admin/users/:userId/roles — lists roles (200)', async () => {
    const { admin, token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    await request(app)
      .post(`/api/v1/admin/users/${target.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'location:ward_admin' });

    const res = await request(app)
      .get(`/api/v1/admin/users/${target.id}/roles`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((r: any) => r.role === 'location:ward_admin')).toBe(true);
  });

  it('returns 401 with no token', async () => {
    await seedLocation();
    const target = await seedTargetUser();
    const res = await request(app)
      .post(`/api/v1/admin/users/${target.id}/roles`)
      .send({ role: 'location:ward_admin' });
    expect(res.status).toBe(401);
  });
});

describe('Admin Report Routes', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('GET /admin/reports/users — returns report (200)', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/reports/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('User Activity Report');
    expect(Array.isArray(res.body.data.rows)).toBe(true);
  });

  it('GET /admin/reports/governance — returns report (200)', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/reports/governance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Governance Report');
  });

  it('GET /admin/reports/economy — returns report (200)', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/reports/economy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Economy Report');
  });

  it('GET /admin/reports/invalid — returns 400', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/reports/invalid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('GET /admin/reports/users?format=csv — returns CSV', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/reports/users?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
  });
});

describe('Admin Stats / Users / Config Routes', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('GET /admin/stats — returns stats shape (200)', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.users.total).toBe('number');
    expect(typeof res.body.data.users.active).toBe('number');
    expect(res.body.data.governance).toBeDefined();
    expect(res.body.data.economy).toBeDefined();
  });

  it('GET /admin/stats — 401 without token', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.status).toBe(401);
  });

  it('GET /admin/users — returns user list with pagination (200)', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
    expect(typeof res.body.data.limit).toBe('number');
  });

  it('GET /admin/users?search= — filters results', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/users?search=admin-routes-test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users.some((u: any) => u.email.includes('admin-routes-test'))).toBe(true);
  });

  it('GET /admin/config — returns config array (200)', async () => {
    const { token } = await seedAdminAndToken();

    const res = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Admin PR Adjust and Suspend Routes', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('POST /admin/pr/adjust — adds PR to user (200)', async () => {
    const { token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    const before = await prisma.user.findUnique({ where: { id: target.id } });

    const res = await request(app)
      .post('/api/v1/admin/pr/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target.id, amount: 10, type: 'ADD', reason: 'test bonus' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.new).toBe(before!.participationRights + 10);
  });

  it('POST /admin/pr/adjust — 400 for zero amount (service guard)', async () => {
    const { token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    const res = await request(app)
      .post('/api/v1/admin/pr/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target.id, amount: 0, type: 'ADD', reason: 'no-op' });

    expect(res.status).toBe(400);
  });

  it('POST /admin/pr/adjust — 401 without token', async () => {
    await seedLocation();
    const target = await seedTargetUser();

    const res = await request(app)
      .post('/api/v1/admin/pr/adjust')
      .send({ userId: target.id, amount: 10, type: 'ADD', reason: 'ghost' });

    expect(res.status).toBe(401);
  });

  it('POST /admin/users/:userId/suspend — suspends user (200)', async () => {
    const { token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    const res = await request(app)
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target.id, banned: true, reason: 'ToS violation', durationDays: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.suspended).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    expect(updated!.status).toBe('SUSPENDED');
  });

  it('POST /admin/users/:userId/suspend — 400 for missing reason', async () => {
    const { token } = await seedAdminAndToken();
    const target = await seedTargetUser();

    const res = await request(app)
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target.id, banned: true });

    expect(res.status).toBe(400);
  });

  it('POST /admin/users/:userId/suspend — 401 without token', async () => {
    await seedLocation();
    const target = await seedTargetUser();

    const res = await request(app)
      .post(`/api/v1/admin/users/${target.id}/suspend`)
      .send({ userId: target.id, banned: true, reason: 'ghost' });

    expect(res.status).toBe(401);
  });
});

// ─── Education module seeding helpers ─────────────────────────────────────────

async function seedModuleCreatorUser() {
  return prisma.user.create({
    data: {
      email: `mod-creator-${Date.now()}@ujamaa.test`,
      name: 'Module Creator',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

async function seedSubmittedModuleForAdmin(creatorId: string, title = 'Submitted Module') {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title,
      description: 'A submitted module awaiting admin review.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: false,
      completionIP: 10,
      submittedAt: new Date(),
      rejectionReason: null,
    },
  });
}

async function seedDraftModuleForAdmin(creatorId: string) {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title: 'Draft Module',
      description: 'Unsubmitted draft.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: false,
      completionIP: 5,
    },
  });
}

async function seedNonAdminToken() {
  const user = await prisma.user.create({
    data: {
      email: `non-admin-${Date.now()}@ujamaa.test`,
      name: 'Non Admin',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
  return makeAccessToken(user.id, 'COMMUNITY_VERIFIED', { roles: [] });
}

const VALID_ADMIN_MODULE = {
  title: 'Ward Budget Fundamentals',
  description: 'Learn how ward development funds are allocated and tracked by county governments.',
  content:
    'Ward development funds are allocated annually by county governments. This module explains the allocation formula, how to access expenditure reports, and how community members can participate in budget review meetings.',
  duration: 25,
  difficulty: 'BEGINNER',
  category: 'governance',
  completionIP: 15,
};

// ─────────────────────────────────────────────
// GET /admin/education/pending
// ─────────────────────────────────────────────

describe('GET /admin/education/pending', () => {
  it('401 without token', async () => {
    await seedLocation();
    const res = await request(app).get('/api/v1/admin/education/pending');
    expect(res.status).toBe(401);
  });

  it('403 for non-admin user', async () => {
    await seedLocation();
    const token = await seedNonAdminToken();
    const res = await request(app)
      .get('/api/v1/admin/education/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 returns pending modules with creator info', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const creator = await seedModuleCreatorUser();
    await seedSubmittedModuleForAdmin(creator.id, 'Awaiting Review');

    const res = await request(app)
      .get('/api/v1/admin/education/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(1);
    expect(res.body.data.modules[0].title).toBe('Awaiting Review');
    expect(res.body.data.modules[0].creator).toBeDefined();
    expect(res.body.data.total).toBe(1);
  });

  it('200 returns empty list when no modules are pending', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const res = await request(app)
      .get('/api/v1/admin/education/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// POST /admin/education  (admin create)
// ─────────────────────────────────────────────

describe('POST /admin/education', () => {
  it('401 without token', async () => {
    await seedLocation();
    const res = await request(app).post('/api/v1/admin/education').send(VALID_ADMIN_MODULE);
    expect(res.status).toBe(401);
  });

  it('403 for non-admin user', async () => {
    await seedLocation();
    const token = await seedNonAdminToken();
    const res = await request(app)
      .post('/api/v1/admin/education')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ADMIN_MODULE);
    expect(res.status).toBe(403);
  });

  it('400 for invalid body (title too short)', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const res = await request(app)
      .post('/api/v1/admin/education')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_ADMIN_MODULE, title: 'Hi' });
    expect(res.status).toBe(400);
  });

  it('400 for content under 100 chars', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const res = await request(app)
      .post('/api/v1/admin/education')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_ADMIN_MODULE, content: 'Too short.' });
    expect(res.status).toBe(400);
  });

  it('200 creates auto-approved module', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const res = await request(app)
      .post('/api/v1/admin/education')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ADMIN_MODULE);
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.expertApproved).toBe(true);
    expect(res.body.data.title).toBe(VALID_ADMIN_MODULE.title);
  });
});

// ─────────────────────────────────────────────
// POST /admin/education/:moduleId/approve
// ─────────────────────────────────────────────

describe('POST /admin/education/:moduleId/approve', () => {
  it('401 without token', async () => {
    await seedLocation();
    const res = await request(app).post(
      '/api/v1/admin/education/00000000-0000-0000-0000-000000000001/approve'
    );
    expect(res.status).toBe(401);
  });

  it('403 for non-admin user', async () => {
    await seedLocation();
    const token = await seedNonAdminToken();
    const res = await request(app)
      .post('/api/v1/admin/education/00000000-0000-0000-0000-000000000001/approve')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('400 for a draft module (not submitted)', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const creator = await seedModuleCreatorUser();
    const draft = await seedDraftModuleForAdmin(creator.id);

    const res = await request(app)
      .post(`/api/v1/admin/education/${draft.id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('200 approves a submitted module', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const creator = await seedModuleCreatorUser();
    const mod = await seedSubmittedModuleForAdmin(creator.id);

    const res = await request(app)
      .post(`/api/v1/admin/education/${mod.id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);
  });
});

// ─────────────────────────────────────────────
// POST /admin/education/:moduleId/reject
// ─────────────────────────────────────────────

describe('POST /admin/education/:moduleId/reject', () => {
  it('401 without token', async () => {
    await seedLocation();
    const res = await request(app)
      .post('/api/v1/admin/education/00000000-0000-0000-0000-000000000001/reject')
      .send({ reason: 'This module needs more depth and detail.' });
    expect(res.status).toBe(401);
  });

  it('403 for non-admin user', async () => {
    await seedLocation();
    const token = await seedNonAdminToken();
    const res = await request(app)
      .post('/api/v1/admin/education/00000000-0000-0000-0000-000000000001/reject')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'This module needs more depth and detail.' });
    expect(res.status).toBe(403);
  });

  it('400 for reason under 10 chars', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const creator = await seedModuleCreatorUser();
    const mod = await seedSubmittedModuleForAdmin(creator.id);
    const res = await request(app)
      .post(`/api/v1/admin/education/${mod.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Short' });
    expect(res.status).toBe(400);
  });

  it('400 for a draft module (not submitted)', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const creator = await seedModuleCreatorUser();
    const draft = await seedDraftModuleForAdmin(creator.id);
    const res = await request(app)
      .post(`/api/v1/admin/education/${draft.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'This module needs more depth and detail.' });
    expect(res.status).toBe(400);
  });

  it('200 rejects a submitted module and sets rejectionReason', async () => {
    await seedLocation();
    const { token } = await seedAdminAndToken();
    const creator = await seedModuleCreatorUser();
    const mod = await seedSubmittedModuleForAdmin(creator.id);

    const res = await request(app)
      .post(`/api/v1/admin/education/${mod.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Content is too brief and lacks references.' });
    expect(res.status).toBe(200);
    expect(res.body.data.rejectionReason).toBe('Content is too brief and lacks references.');
    expect(res.body.data.verified).toBe(false);
  });
});

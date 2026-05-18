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

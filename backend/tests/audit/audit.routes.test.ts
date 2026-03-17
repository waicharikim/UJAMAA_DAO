/**
 * @file tests/audit/audit.routes.test.ts
 * Route integration tests for GET /audit/search
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
import { auditService } from '../../src/modules/audit/services/audit.service.js';
import { AuditAction } from '../../src/modules/audit/types.js';

async function seedAdminUser(email: string, role: string) {
  await seedLocation();

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Audit Route Admin',
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });

  const roleRecord = await prisma.role.upsert({
    where: { name: role },
    update: {},
    create: { name: role, description: role },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: roleRecord.id, active: true },
  });

  const token = makeAccessToken(user.id, 'FULL_VERIFIED', { roles: [role] });

  return { user, token };
}

async function seedRegularUser() {
  return prisma.user.create({
    data: {
      email: `regular-${Date.now()}@ujamaa.test`,
      name: 'Regular User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

describe('GET /audit/search — authentication and authorisation', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/audit/search');
    expect(res.status).toBe(401);
  });

  it('returns 403 for COMMUNITY_VERIFIED user without admin role', async () => {
    await seedLocation();
    const user = await seedRegularUser();
    const token = makeAccessToken(user.id, 'COMMUNITY_VERIFIED', { roles: [] });

    const res = await request(app)
      .get('/api/v1/audit/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 for SUPER_ADMIN', async () => {
    const { token } = await seedAdminUser(
      `super-admin-audit@ujamaa.test`,
      'system:super_admin'
    );

    const res = await request(app)
      .get('/api/v1/audit/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.logs)).toBe(true);
  });

  it('returns 200 for WARD_ADMIN', async () => {
    const { token } = await seedAdminUser(
      `ward-admin-audit@ujamaa.test`,
      'location:ward_admin'
    );

    const res = await request(app)
      .get('/api/v1/audit/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /audit/search — filtering and pagination', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  it('returns logs filtered by userId', async () => {
    const { user, token } = await seedAdminUser(
      `audit-userid-filter@ujamaa.test`,
      'system:super_admin'
    );
    const target = await seedRegularUser();

    await auditService.log(target.id, AuditAction.PROFILE_UPDATED, 'User', target.id);

    const res = await request(app)
      .get(`/api/v1/audit/search?userId=${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const logs = res.body.data.logs;
    expect(logs.every((l: any) => l.userId === target.id)).toBe(true);
  });

  it('returns logs filtered by action', async () => {
    const { token } = await seedAdminUser(
      `audit-action-filter@ujamaa.test`,
      'system:super_admin'
    );
    const target = await seedRegularUser();

    await auditService.log(target.id, AuditAction.GROUP_JOINED, 'Group');

    const res = await request(app)
      .get(`/api/v1/audit/search?action=${AuditAction.GROUP_JOINED}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const logs = res.body.data.logs;
    expect(logs.some((l: any) => l.action === AuditAction.GROUP_JOINED)).toBe(true);
  });

  it('returns logs filtered by entityType', async () => {
    const { token } = await seedAdminUser(
      `audit-entitytype-filter@ujamaa.test`,
      'system:super_admin'
    );
    const target = await seedRegularUser();

    await auditService.log(target.id, AuditAction.PROPOSAL_CREATED, 'Proposal');

    const res = await request(app)
      .get('/api/v1/audit/search?entityType=Proposal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const logs = res.body.data.logs;
    expect(logs.every((l: any) => l.entityType === 'Proposal')).toBe(true);
  });

  it('returns pagination metadata', async () => {
    const { token } = await seedAdminUser(
      `audit-pagination-meta@ujamaa.test`,
      'system:super_admin'
    );

    const res = await request(app)
      .get('/api/v1/audit/search?limit=5&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { pagination } = res.body.data;
    expect(pagination).toMatchObject({ page: 1, limit: 5 });
    expect(typeof pagination.total).toBe('number');
    expect(typeof pagination.totalPages).toBe('number');
  });

  it('returns empty logs when fromDate is in the future', async () => {
    const { token } = await seedAdminUser(
      `audit-future-date@ujamaa.test`,
      'system:super_admin'
    );

    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/v1/audit/search?fromDate=${encodeURIComponent(future)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBe(0);
  });

  it('respects sortOrder=asc', async () => {
    const { user, token } = await seedAdminUser(
      `audit-sort-route@ujamaa.test`,
      'system:super_admin'
    );

    await auditService.log(user.id, AuditAction.PROFILE_UPDATED, 'User');
    await auditService.log(user.id, AuditAction.GROUP_JOINED, 'Group');

    const res = await request(app)
      .get(`/api/v1/audit/search?userId=${user.id}&sortOrder=asc`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const logs = res.body.data.logs;
    const dates = logs.map((l: any) => new Date(l.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });
});

/**
 * @file tests/integration/integration.routes.test.ts
 * @description Route integration tests for /integration endpoints.
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
  },
}));

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    spend: vi.fn().mockResolvedValue(undefined),
    award: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/notifications/services/notification.service.js', () => ({
  notificationService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import { prisma } from '../../src/core/database/client.js';
import {
  seedLocation,
  seedGroup,
  seedUser,
  seedWardAdmin,
  seedBarazaGroup,
  seedMessagingProfile,
  makeIntegrationToken,
  makeWardAdminToken,
  INT_WARD_ID,
} from './helpers.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────
// POST /integration/baraza-groups
// ─────────────────────────────────────────────

describe('POST /integration/baraza-groups', () => {
  it('401 no token', async () => {
    await seedLocation();
    const group = await seedGroup(INT_WARD_ID);

    const res = await request(app)
      .post('/api/v1/integration/baraza-groups')
      .send({
        groupId: group.id,
        platform: 'TELEGRAM',
        externalId: 'test-ext',
        name: 'Test Baraza',
      });

    expect(res.status).toBe(401);
  });

  it('403 for COMMUNITY_VERIFIED user (no admin role)', async () => {
    await seedLocation();
    const user = await seedUser(`bgr-403-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const token = makeIntegrationToken(user.id, []);

    const res = await request(app)
      .post('/api/v1/integration/baraza-groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        groupId: group.id,
        platform: 'TELEGRAM',
        externalId: `ext-403-${Date.now()}`,
        name: 'Forbidden Baraza',
      });

    expect(res.status).toBe(403);
  });

  it('400 invalid body (missing platform)', async () => {
    await seedLocation();
    const admin = await seedWardAdmin(`bgr-400-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const token = makeWardAdminToken(admin.id);

    const res = await request(app)
      .post('/api/v1/integration/baraza-groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        groupId: group.id,
        externalId: 'ext-bad',
        name: 'No Platform Baraza',
      });

    expect(res.status).toBe(400);
  });

  it('201 creates baraza group (WARD_ADMIN)', async () => {
    await seedLocation();
    const admin = await seedWardAdmin(`bgr-201-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const token = makeWardAdminToken(admin.id);

    const res = await request(app)
      .post('/api/v1/integration/baraza-groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        groupId: group.id,
        platform: 'TELEGRAM',
        externalId: `ext-201-${Date.now()}`,
        name: 'New Baraza Group',
        inviteLink: 'https://t.me/joinchat/testlink',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.groupId).toBe(group.id);
    expect(res.body.data.platform).toBe('TELEGRAM');
  });
});

// ─────────────────────────────────────────────
// GET /integration/baraza-groups
// ─────────────────────────────────────────────

describe('GET /integration/baraza-groups', () => {
  it('401 no token', async () => {
    const res = await request(app).get('/api/v1/integration/baraza-groups');
    expect(res.status).toBe(401);
  });

  it('200 returns user baraza groups (may be empty)', async () => {
    await seedLocation();
    const user = await seedUser(`bgget-route-${Date.now()}@test.com`);
    const token = makeIntegrationToken(user.id);

    const res = await request(app)
      .get('/api/v1/integration/baraza-groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('200 returns baraza group when user has membership + profile', async () => {
    await seedLocation();
    const admin = await seedWardAdmin(`bgget-admin-route-${Date.now()}@test.com`);
    const user = await seedUser(`bgget-user-route-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER', active: true },
    });

    await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    await seedMessagingProfile(user.id, 'TELEGRAM', `tg-route-${Date.now()}`);

    const token = makeIntegrationToken(user.id);

    const res = await request(app)
      .get('/api/v1/integration/baraza-groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// POST /integration/baraza-groups/:id/attendance
// ─────────────────────────────────────────────

describe('POST /integration/baraza-groups/:id/attendance', () => {
  it('401 no token', async () => {
    await seedLocation();
    const admin = await seedUser(`bgatt-notoken-admin-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);

    const res = await request(app)
      .post(`/api/v1/integration/baraza-groups/${baraza.id}/attendance`)
      .send({
        sessionDate: '2026-03-17',
        attendeeExternalIds: ['user123'],
      });

    expect(res.status).toBe(401);
  });

  it('403 for regular user without admin role', async () => {
    await seedLocation();
    const admin = await seedUser(`bgatt-403-admin-${Date.now()}@test.com`);
    const user = await seedUser(`bgatt-403-user-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    const token = makeIntegrationToken(user.id, []);

    const res = await request(app)
      .post(`/api/v1/integration/baraza-groups/${baraza.id}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionDate: '2026-03-17',
        attendeeExternalIds: ['user123'],
      });

    expect(res.status).toBe(403);
  });

  it('200 records attendance for ward admin', async () => {
    await seedLocation();
    const admin = await seedWardAdmin(`bgatt-200-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    const token = makeWardAdminToken(admin.id);

    const res = await request(app)
      .post(`/api/v1/integration/baraza-groups/${baraza.id}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionDate: '2026-03-17',
        attendeeExternalIds: ['ext-user-xyz'],
        reportedBy: 'ward_admin',
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// POST /integration/baraza-groups/:id/deactivate
// ─────────────────────────────────────────────

describe('POST /integration/baraza-groups/:id/deactivate', () => {
  it('401 no token', async () => {
    await seedLocation();
    const admin = await seedUser(`bgdeact-notoken-admin-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);

    const res = await request(app)
      .post(`/api/v1/integration/baraza-groups/${baraza.id}/deactivate`);

    expect(res.status).toBe(401);
  });

  it('403 for non-admin user', async () => {
    await seedLocation();
    const admin = await seedUser(`bgdeact-403-admin-${Date.now()}@test.com`);
    const user = await seedUser(`bgdeact-403-user-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    const token = makeIntegrationToken(user.id, []);

    const res = await request(app)
      .post(`/api/v1/integration/baraza-groups/${baraza.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('200 deactivates baraza group', async () => {
    await seedLocation();
    const admin = await seedWardAdmin(`bgdeact-200-${Date.now()}@test.com`);
    const group = await seedGroup(INT_WARD_ID);
    const baraza = await seedBarazaGroup(group.id, 'TELEGRAM', admin.id);
    const token = makeWardAdminToken(admin.id);

    const res = await request(app)
      .post(`/api/v1/integration/baraza-groups/${baraza.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('404 for unknown baraza group id', async () => {
    await seedLocation();
    const admin = await seedWardAdmin(`bgdeact-404-${Date.now()}@test.com`);
    const token = makeWardAdminToken(admin.id);

    const res = await request(app)
      .post('/api/v1/integration/baraza-groups/00000000-0000-4000-b000-000000000099/deactivate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

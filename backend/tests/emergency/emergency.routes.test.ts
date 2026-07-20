/**
 * @file tests/emergency/emergency.routes.test.ts
 * @description Supertest integration tests for emergency routes.
 *
 * Routes under test:
 *   GET    /emergency
 *   GET    /emergency/:alertId
 *   POST   /emergency/report
 *   POST   /emergency/:alertId/respond
 *
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

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
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
  notificationService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  createEmergencyUser,
  seedWard,
  seedEmergencyAlert,
  makeEmergencyToken,
} from './helpers.js';
import { EmergencyType } from '@prisma/client';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────
// GET /emergency
// ─────────────────────────────────────────────

describe('GET /emergency', () => {
  it('200 with empty list when no alerts exist', async () => {
    const res = await request(app).get('/api/v1/emergency');
    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(0);
  });

  it('200 returns existing alerts', async () => {
    const user = await createEmergencyUser('list1@test.com');
    const ward = await seedWard();
    await seedEmergencyAlert(user.id, ward.id);

    const res = await request(app).get('/api/v1/emergency');
    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(1);
  });

  it('200 filters by wardId', async () => {
    const user = await createEmergencyUser('wardfilter@test.com');
    const wardA = await seedWard('Ward A');
    const wardB = await seedWard('Ward B');
    await seedEmergencyAlert(user.id, wardA.id);
    await seedEmergencyAlert(user.id, wardB.id);

    const res = await request(app).get(`/api/v1/emergency?wardId=${wardA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(1);
  });

  it('400 for invalid wardId format', async () => {
    const res = await request(app).get('/api/v1/emergency?wardId=not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('200 filters by type', async () => {
    const user = await createEmergencyUser('typefilter@test.com');
    const ward = await seedWard();
    await seedEmergencyAlert(user.id, ward.id, { type: EmergencyType.FIRE });
    await seedEmergencyAlert(user.id, ward.id, { type: EmergencyType.FLOOD });

    const res = await request(app).get('/api/v1/emergency?type=FIRE');
    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(1);
    expect(res.body.data.alerts[0].emergencyType).toBe('FIRE');
  });
});

// ─────────────────────────────────────────────
// GET /emergency/:alertId
// ─────────────────────────────────────────────

describe('GET /emergency/:alertId', () => {
  it('200 returns alert with reporter info', async () => {
    const user = await createEmergencyUser('getone@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id);

    const res = await request(app).get(`/api/v1/emergency/${alert.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(alert.id);
    expect(res.body.data.reporter).toBeDefined();
  });

  it('404 for unknown alert id', async () => {
    const res = await request(app).get(
      '/api/v1/emergency/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
  });

  it('400 for non-UUID alert id', async () => {
    const res = await request(app).get('/api/v1/emergency/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /emergency/report
// ─────────────────────────────────────────────

describe('POST /emergency/report', () => {
  it('401 without token', async () => {
    const ward = await seedWard();
    const res = await request(app)
      .post('/api/v1/emergency/report')
      .send({
        type: 'FIRE',
        description: 'Fire at the market area spreading fast',
        locationWardId: ward.id,
      });
    expect(res.status).toBe(401);
  });

  it('201 creates alert for authenticated user', async () => {
    const user = await createEmergencyUser('creator@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();

    const res = await request(app)
      .post('/api/v1/emergency/report')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'MEDICAL',
        description: 'Person collapsed and needs urgent medical attention',
        locationWardId: ward.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.emergencyType).toBe('MEDICAL');
    expect(res.body.data.reporterId).toBe(user.id);
  });

  it('400 when description is too short', async () => {
    const user = await createEmergencyUser('shortdesc@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();

    const res = await request(app)
      .post('/api/v1/emergency/report')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'FIRE',
        description: 'Fire',
        locationWardId: ward.id,
      });

    expect(res.status).toBe(400);
  });

  it('400 when type is invalid', async () => {
    const user = await createEmergencyUser('badtype@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();

    const res = await request(app)
      .post('/api/v1/emergency/report')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'EARTHQUAKE',
        description: 'Ground shaking badly near the school area',
        locationWardId: ward.id,
      });

    expect(res.status).toBe(400);
  });

  it('400 when locationWardId is missing', async () => {
    const user = await createEmergencyUser('noward@test.com');
    const token = makeEmergencyToken(user.id);

    const res = await request(app)
      .post('/api/v1/emergency/report')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'FIRE',
        description: 'Fire at the market area spreading fast',
      });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /emergency/:alertId/respond
// ─────────────────────────────────────────────

describe('POST /emergency/:alertId/respond', () => {
  it('401 without token', async () => {
    const user = await createEmergencyUser('resp401@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id);

    const res = await request(app)
      .post(`/api/v1/emergency/${alert.id}/respond`)
      .send({ message: 'Dispatching support team now' });

    expect(res.status).toBe(401);
  });

  it('403 for regular user without ward admin role', async () => {
    const reporter = await createEmergencyUser('reporter3@test.com');
    const responder = await createEmergencyUser('regular@test.com');
    const token = makeEmergencyToken(responder.id);
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(reporter.id, ward.id);

    const res = await request(app)
      .post(`/api/v1/emergency/${alert.id}/respond`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Dispatching support team now' });

    expect(res.status).toBe(403);
  });

  it('400 when message is too short', async () => {
    const user = await createEmergencyUser('shortmsg@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id);

    const res = await request(app)
      .post(`/api/v1/emergency/${alert.id}/respond`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi' });

    expect(res.status).toBe(400);
  });

  it('400 for non-UUID alertId', async () => {
    const user = await createEmergencyUser('baduuid@test.com');
    const token = makeEmergencyToken(user.id);

    const res = await request(app)
      .post('/api/v1/emergency/not-a-uuid/respond')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Dispatching support team now' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// PATCH /emergency/:alertId/status
// ─────────────────────────────────────────────

describe('PATCH /emergency/:alertId/status', () => {
  it('401 without token', async () => {
    const user = await createEmergencyUser('patch401@test.com');
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id);

    const res = await request(app)
      .patch(`/api/v1/emergency/${alert.id}/status`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(401);
  });

  it('400 for invalid status value', async () => {
    const user = await createEmergencyUser('patchbadstatus@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id);

    const res = await request(app)
      .patch(`/api/v1/emergency/${alert.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(400);
  });

  it('400 for already closed alert', async () => {
    const user = await createEmergencyUser('patchclosed@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id, { status: 'RESOLVED' });

    const res = await request(app)
      .patch(`/api/v1/emergency/${alert.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(400);
  });

  it('200 transitions to IN_PROGRESS', async () => {
    const user = await createEmergencyUser('patchprogress@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id, { status: 'ACTIVE' });

    const res = await request(app)
      .patch(`/api/v1/emergency/${alert.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('200 transitions to RESOLVED and sets resolvedAt', async () => {
    const user = await createEmergencyUser('patchresolved@test.com');
    const token = makeEmergencyToken(user.id);
    const ward = await seedWard();
    const alert = await seedEmergencyAlert(user.id, ward.id, { status: 'IN_PROGRESS' });

    const res = await request(app)
      .patch(`/api/v1/emergency/${alert.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'RESOLVED', statusNote: 'All clear' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.resolvedAt).not.toBeNull();
  });

  it('404 for unknown alertId', async () => {
    const user = await createEmergencyUser('patch404@test.com');
    const token = makeEmergencyToken(user.id);

    const res = await request(app)
      .patch('/api/v1/emergency/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(404);
  });
});

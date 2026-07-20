/**
 * @file tests/reputation/reputation.routes.test.ts
 * @description Supertest integration tests for reputation routes.
 *
 * Routes under test:
 *   GET /reputation/me
 *   GET /reputation/me/history
 *   GET /reputation/:userId
 */

// ─────────────────────────────────────────────
// Mocks
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

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  createReputationUser,
  seedWard,
  seedImpactPointLog,
  seedLocationImpact,
  makeReputationToken,
} from './helpers.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────
// GET /reputation/me
// ─────────────────────────────────────────────

describe('GET /reputation/me', () => {
  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/reputation/me');
    expect(res.status).toBe(401);
  });

  it('200 returns global IP and empty breakdown for new user', async () => {
    const user = await createReputationUser('myrep@test.com', 100);
    const token = makeReputationToken(user.id);

    const res = await request(app)
      .get('/api/v1/reputation/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.globalImpactPoints).toBe(100);
    expect(res.body.data.breakdown).toEqual([]);
  });

  it('200 includes location breakdown when ward impact exists', async () => {
    const user = await createReputationUser('repwithward@test.com', 500);
    const token = makeReputationToken(user.id);
    const ward = await seedWard();
    await seedLocationImpact(user.id, ward.id, 200, 'BRONZE');

    const res = await request(app)
      .get('/api/v1/reputation/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.breakdown).toHaveLength(1);
    expect(res.body.data.breakdown[0].points).toBe(200);
  });
});

// ─────────────────────────────────────────────
// GET /reputation/me/history
// ─────────────────────────────────────────────

describe('GET /reputation/me/history', () => {
  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/reputation/me/history');
    expect(res.status).toBe(401);
  });

  it('200 returns empty history for new user', async () => {
    const user = await createReputationUser('nohistroute@test.com');
    const token = makeReputationToken(user.id);

    const res = await request(app)
      .get('/api/v1/reputation/me/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.logs).toHaveLength(0);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it('200 returns IP logs when they exist', async () => {
    const user = await createReputationUser('withlogsroute@test.com');
    const token = makeReputationToken(user.id);
    await seedImpactPointLog(user.id, 50, 'EMAIL_VERIFIED');
    await seedImpactPointLog(user.id, 25, 'PHONE_VERIFIED');

    const res = await request(app)
      .get('/api/v1/reputation/me/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.logs).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('400 for invalid limit param', async () => {
    const user = await createReputationUser('badlimit@test.com');
    const token = makeReputationToken(user.id);

    const res = await request(app)
      .get('/api/v1/reputation/me/history?limit=abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// GET /reputation/:userId
// ─────────────────────────────────────────────

describe('GET /reputation/:userId', () => {
  it('200 returns public reputation for a user', async () => {
    const user = await createReputationUser('publicrep@test.com', 750);

    const res = await request(app).get(`/api/v1/reputation/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user.id);
    expect(res.body.data.globalImpactPoints).toBe(750);
  });

  it('404 for unknown user id', async () => {
    const res = await request(app).get(
      '/api/v1/reputation/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
  });

  it('400 for non-UUID userId', async () => {
    const res = await request(app).get('/api/v1/reputation/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('200 no auth required for public view', async () => {
    const user = await createReputationUser('publicnoauth@test.com', 200);

    const res = await request(app).get(`/api/v1/reputation/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.globalImpactPoints).toBe(200);
  });
});

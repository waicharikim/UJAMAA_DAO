/**
 * @file tests/economy/economy.routes.test.ts
 * @description Supertest integration tests for economy module routes.
 *
 * Routes under test:
 *   GET /economy/pr
 *   GET /economy/dues/history
 *   GET /economy/commitments
 *   POST /economy/commitments/dues
 *
 * All routes require COMMUNITY_VERIFIED.
 * DB is truncated before each test by testSetup.ts.
 */

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
import { participationRightsService } from '../../src/modules/economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../src/modules/economy/types.js';
import { seedLocation, createEconomyTestUser, makeEconomyToken } from './helpers.js';

const BASE = '/api/v1/economy';

beforeAll(async () => {
  await servicesReady;
});

beforeEach(async () => {
  await seedLocation();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /economy/pr
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /economy/pr', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`${BASE}/pr`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for EMAIL_VERIFIED user (requires COMMUNITY_VERIFIED)', async () => {
    const user = await createEconomyTestUser('email-only@example.com', 'EMAIL_VERIFIED');
    const token = makeEconomyToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .get(`${BASE}/pr`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with balance=0 and empty history for new community verified user', async () => {
    const user = await createEconomyTestUser('comm@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    const res = await request(app)
      .get(`${BASE}/pr`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      balance: 0,
      history: [],
    });
  });

  it('returns correct balance and history after awards', async () => {
    const user = await createEconomyTestUser('has-pr@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    // Award some PR directly via service
    await participationRightsService.award(
      user.id, 50, ParticipationRightsReason.EMAIL_VERIFIED
    );
    await participationRightsService.award(
      user.id, 25, ParticipationRightsReason.WALLET_CONNECTED
    );

    const res = await request(app)
      .get(`${BASE}/pr`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(75);
    expect(res.body.data.history).toHaveLength(2);
    // History is ordered desc — most recent first
    expect(res.body.data.history[0].reason).toBe(ParticipationRightsReason.WALLET_CONNECTED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /economy/dues/history
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /economy/dues/history', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`${BASE}/dues/history`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for EMAIL_VERIFIED user', async () => {
    const user = await createEconomyTestUser('dues-email@example.com', 'EMAIL_VERIFIED');
    const token = makeEconomyToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .get(`${BASE}/dues/history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with empty array for user with no dues history', async () => {
    const user = await createEconomyTestUser('no-dues@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    const res = await request(app)
      .get(`${BASE}/dues/history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /economy/commitments
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /economy/commitments', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`${BASE}/commitments`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for EMAIL_VERIFIED user', async () => {
    const user = await createEconomyTestUser('comm-email@example.com', 'EMAIL_VERIFIED');
    const token = makeEconomyToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .get(`${BASE}/commitments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with empty array for user with no commitments', async () => {
    const user = await createEconomyTestUser('no-commit@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    const res = await request(app)
      .get(`${BASE}/commitments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns existing commitments for user', async () => {
    const user = await createEconomyTestUser('with-commit@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    // Seed a commitment directly
    await prisma.commitment.create({
      data: {
        userId: user.id,
        type: 'DUES',
        amountKes: 60,
        frequency: 'MONTHLY',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .get(`${BASE}/commitments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      type: 'DUES',
      status: 'ACTIVE',
      amountKes: 60,
      frequency: 'MONTHLY',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /economy/commitments/dues
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /economy/commitments/dues', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/commitments/dues`)
      .send({ type: 'DUES' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for EMAIL_VERIFIED user', async () => {
    const user = await createEconomyTestUser('dues-post-email@example.com', 'EMAIL_VERIFIED');
    const token = makeEconomyToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .post(`${BASE}/commitments/dues`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'DUES' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for empty body (missing tier)', async () => {
    const user = await createEconomyTestUser('dues-empty@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    const res = await request(app)
      .post(`${BASE}/commitments/dues`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid tier value', async () => {
    const user = await createEconomyTestUser('dues-badtier@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    const res = await request(app)
      .post(`${BASE}/commitments/dues`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tier: 'GOLD' }); // Invalid — not a DuesTier

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 for valid ORDINARY dues opt-in', async () => {
    const user = await createEconomyTestUser('dues-valid@example.com', 'COMMUNITY_VERIFIED');
    const token = makeEconomyToken(user.id, 'COMMUNITY_VERIFIED');

    const res = await request(app)
      .post(`${BASE}/commitments/dues`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tier: 'ORDINARY',
        startPeriod: '2026-03',
        durationMonths: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Confirm commitment exists in DB
    const commit = await prisma.commitment.findFirst({
      where: { userId: user.id, type: 'DUES' },
    });
    expect(commit).toBeDefined();
    expect(commit?.status).toBe('ACTIVE');
  });
});

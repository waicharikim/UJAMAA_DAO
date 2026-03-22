/**
 * @file tests/economy/utWithdrawal.routes.test.ts
 * @description Supertest integration tests for UT withdrawal endpoints.
 *
 * Routes under test:
 *   POST /economy/ut/withdraw
 *   GET  /economy/ut/withdrawals
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
import { seedLocation, createEconomyTestUser, makeEconomyToken } from './helpers.js';

const BASE = '/api/v1/economy';

describe('UT Withdrawal endpoints', () => {
  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    await seedLocation();
  });

  // ─────────────────────────────────────────────
  // POST /economy/ut/withdraw
  // ─────────────────────────────────────────────

  describe('POST /economy/ut/withdraw', () => {
    it('should return 401 with no auth token', async () => {
      const res = await request(app)
        .post(`${BASE}/ut/withdraw`)
        .send({ amountKes: 100, mpesaPhone: '+254712345678' });
      expect(res.status).toBe(401);
    });

    it('should return 402 when user has insufficient fiatBackedUtBalance', async () => {
      const user = await createEconomyTestUser('nobalance@test.com');
      const token = makeEconomyToken(user.id);

      const res = await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountKes: 100, mpesaPhone: '+254712345678' });

      expect(res.status).toBe(402);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for amount below minimum (10 KES)', async () => {
      const user = await createEconomyTestUser('mincheck@test.com');
      await prisma.user.update({
        where: { id: user.id },
        data: { fiatBackedUtBalance: 500 },
      });
      const token = makeEconomyToken(user.id);

      const res = await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountKes: 5, mpesaPhone: '+254712345678' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for amount above maximum (10,000 KES)', async () => {
      const user = await createEconomyTestUser('maxcheck@test.com');
      await prisma.user.update({
        where: { id: user.id },
        data: { fiatBackedUtBalance: 50000 },
      });
      const token = makeEconomyToken(user.id);

      const res = await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountKes: 15000, mpesaPhone: '+254712345678' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid phone number', async () => {
      const user = await createEconomyTestUser('badphone@test.com');
      await prisma.user.update({
        where: { id: user.id },
        data: { fiatBackedUtBalance: 500 },
      });
      const token = makeEconomyToken(user.id);

      const res = await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountKes: 100, mpesaPhone: 'not-a-phone' });

      expect(res.status).toBe(400);
    });

    it('should successfully initiate a withdrawal and deduct fiatBackedUtBalance', async () => {
      const user = await createEconomyTestUser('withdraw@test.com');
      await prisma.user.update({
        where: { id: user.id },
        data: { fiatBackedUtBalance: 1000 },
      });
      const token = makeEconomyToken(user.id);

      const res = await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountKes: 200, mpesaPhone: '+254712345678' });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountKes).toBe(200);
      expect(res.body.data.newFiatBalance).toBe(800);
      expect(res.body.data.status).toBe('PENDING_PAYOUT');
      expect(res.body.data.transactionRef).toBeDefined();

      // Verify balance was deducted in DB
      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.fiatBackedUtBalance).toBe(800);

      // Verify withdrawal record was created
      const withdrawal = await prisma.utWithdrawal.findFirst({
        where: { userId: user.id },
      });
      expect(withdrawal).toBeTruthy();
      expect(withdrawal!.amountKes).toBe(200);
      expect(withdrawal!.status).toBe('PENDING');
      expect(withdrawal!.mpesaPhone).toBe('+254712345678');
    });

    it('should not touch earnedUtBalance when withdrawing', async () => {
      const user = await createEconomyTestUser('earnedcheck@test.com');
      await prisma.user.update({
        where: { id: user.id },
        data: { fiatBackedUtBalance: 500, earnedUtBalance: 300 },
      });
      const token = makeEconomyToken(user.id);

      await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountKes: 100, mpesaPhone: '+254712345678' });

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.fiatBackedUtBalance).toBe(400);
      expect(updated!.earnedUtBalance).toBe(300); // untouched
    });

    it('should return 400 for missing amountKes', async () => {
      const user = await createEconomyTestUser('missingamt@test.com');
      const token = makeEconomyToken(user.id);

      const res = await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mpesaPhone: '+254712345678' });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /economy/ut/withdrawals
  // ─────────────────────────────────────────────

  describe('GET /economy/ut/withdrawals', () => {
    it('should return 401 with no auth token', async () => {
      const res = await request(app).get(`${BASE}/ut/withdrawals`);
      expect(res.status).toBe(401);
    });

    it('should return empty history with balances for new user', async () => {
      const user = await createEconomyTestUser('history@test.com');
      const token = makeEconomyToken(user.id);

      const res = await request(app)
        .get(`${BASE}/ut/withdrawals`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.withdrawals).toEqual([]);
      expect(res.body.data.fiatBackedUtBalance).toBe(0);
      expect(res.body.data.earnedUtBalance).toBe(0);
    });

    it('should return withdrawal history after a successful withdrawal', async () => {
      const user = await createEconomyTestUser('histfull@test.com');
      await prisma.user.update({
        where: { id: user.id },
        data: { fiatBackedUtBalance: 500 },
      });
      const token = makeEconomyToken(user.id);

      // Create a withdrawal
      await request(app)
        .post(`${BASE}/ut/withdraw`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountKes: 150, mpesaPhone: '+254712345678' });

      const res = await request(app)
        .get(`${BASE}/ut/withdrawals`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.withdrawals).toHaveLength(1);
      expect(res.body.data.withdrawals[0].amountKes).toBe(150);
      expect(res.body.data.withdrawals[0].status).toBe('PENDING');
      expect(res.body.data.fiatBackedUtBalance).toBe(350);
    });
  });
});

/**
 * @file tests/payments/payment.routes.test.ts
 * Integration tests for payment module routes.
 *
 * POST /api/v1/payments/initiate
 * POST /api/v1/payments/webhook
 * GET  /api/v1/payments/status/:txRef
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
import { seedLocation, createPaymentTestUser, makePaymentToken, seedPaymentRecord } from './helpers.js';

const BASE = '/api/v1/payments';

describe('Payment Routes', () => {
  let userId: string;
  let token: string;

  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    await seedLocation();
    const user = await createPaymentTestUser(`payment-routes-${Date.now()}@test.com`);
    userId = user.id;
    token = makePaymentToken(userId);
  });

  // ─────────────────────────────────────────────
  // POST /initiate
  // ─────────────────────────────────────────────

  describe('POST /initiate', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .send({ method: 'MPESA', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing method field', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid method value', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'BITCOIN', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing purpose field', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purposeMeta: {} });
      expect(res.status).toBe(400);
    });

    it('initiates MPESA DUES payment successfully (200)', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.txRef).toMatch(/^UJ-/);
      expect(res.body.data.paymentLink).toBeUndefined();
    });

    it('initiates CARD DUES payment and returns paymentLink (200)', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'CARD', purpose: 'DUES', purposeMeta: { tier: 'SUPPORTER', period: '2026-03' } });

      expect(res.status).toBe(200);
      expect(res.body.data.txRef).toBeDefined();
      expect(res.body.data.paymentLink).toBeDefined();
    });

    it('initiates VERIFICATION payment (200)', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'VERIFICATION' });

      expect(res.status).toBe(200);
      expect(res.body.data.txRef).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // POST /webhook
  // ─────────────────────────────────────────────

  describe('POST /webhook', () => {
    it('returns 400 for invalid webhook body', async () => {
      const res = await request(app)
        .post(`${BASE}/webhook`)
        .send({ event: 'charge.completed' }); // missing required data fields
      expect(res.status).toBe(400);
    });

    it('processes a successful DUES webhook (200)', async () => {
      // Create a pending payment
      const initRes = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      const { txRef } = initRes.body.data;

      // Seed onboarding progress (required by duesService.recordPayment → participationRightsService.award)
      await prisma.onboardingProgress.create({ data: { userId } });

      const res = await request(app)
        .post(`${BASE}/webhook`)
        .send({
          event: 'charge.completed',
          data: {
            id: 100,
            tx_ref: txRef,
            flw_ref: 'FLW-WEBHOOK-100',
            amount: 60,
            currency: 'KES',
            charged_amount: 60,
            status: 'successful',
            payment_type: 'mpesa',
            customer: { id: 1, name: 'Test', email: 'test@test.com' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');

      // Payment record should be COMPLETED
      const record = await prisma.paymentRecord.findUnique({ where: { txRef } });
      expect(record!.status).toBe('COMPLETED');
    });

    it('returns 200 for failed charge (graceful handling)', async () => {
      const initRes = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      const { txRef } = initRes.body.data;

      const res = await request(app)
        .post(`${BASE}/webhook`)
        .send({
          event: 'charge.completed',
          data: {
            id: 101,
            tx_ref: txRef,
            flw_ref: 'FLW-WEBHOOK-101',
            amount: 60,
            currency: 'KES',
            charged_amount: 0,
            status: 'failed',
            payment_type: 'mpesa',
            customer: { id: 1, name: 'Test', email: 'test@test.com' },
          },
        });

      expect(res.status).toBe(200);
      const record = await prisma.paymentRecord.findUnique({ where: { txRef } });
      expect(record!.status).toBe('FAILED');
    });
  });

  // ─────────────────────────────────────────────
  // POST /webhook/buni
  // ─────────────────────────────────────────────

  describe('POST /webhook/buni', () => {
    it('returns 400 for invalid body (missing Body field)', async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({ event: 'stk_push' });
      expect(res.status).toBe(400);
    });

    it('processes a successful Buni STK callback and returns KCB ack (200)', async () => {
      const checkoutRequestId = `CRI-ROUTE-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-ROUTE-${Date.now()}`,
        flwRef: checkoutRequestId,
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      await prisma.onboardingProgress.create({ data: { userId } });

      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MR-ROUTE-001',
              CheckoutRequestID: checkoutRequestId,
              ResultCode: 0,
              ResultDesc: 'The service request is processed successfully.',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: 60 },
                  { Name: 'MpesaReceiptNumber', Value: 'NLJ7ROUTE1' },
                  { Name: 'TransactionDate', Value: 20260317145000 },
                  { Name: 'PhoneNumber', Value: 254712345678 },
                ],
              },
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe('0');

      const updated = await prisma.paymentRecord.findUnique({ where: { id: record.id } });
      expect(updated!.status).toBe('COMPLETED');
    });

    it('returns 200 for failed STK result (graceful — marks FAILED)', async () => {
      const checkoutRequestId = `CRI-CANCEL-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-CANCEL-${Date.now()}`,
        flwRef: checkoutRequestId,
      });

      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MR-CANCEL-001',
              CheckoutRequestID: checkoutRequestId,
              ResultCode: 1032,
              ResultDesc: 'Request cancelled by user.',
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe('0');

      const updated = await prisma.paymentRecord.findUnique({ where: { id: record.id } });
      expect(updated!.status).toBe('FAILED');
    });
  });

  // ─────────────────────────────────────────────
  // GET /status/:txRef
  // ─────────────────────────────────────────────

  describe('GET /status/:txRef', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get(`${BASE}/status/UJ-SOME-REF`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent txRef', async () => {
      const res = await request(app)
        .get(`${BASE}/status/UJ-NONEXISTENT`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns payment record for owner (200)', async () => {
      const record = await seedPaymentRecord(userId, { txRef: `UJ-STATUS-${Date.now()}` });

      const res = await request(app)
        .get(`${BASE}/status/${record.txRef}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.txRef).toBe(record.txRef);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('returns 403 when accessing another user\'s record', async () => {
      // Create second user
      const other = await createPaymentTestUser(`other-${Date.now()}@test.com`);
      const otherRecord = await seedPaymentRecord(other.id, { txRef: `UJ-OTHER-${Date.now()}` });

      const res = await request(app)
        .get(`${BASE}/status/${otherRecord.txRef}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});

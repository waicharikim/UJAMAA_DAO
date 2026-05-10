/**
 * @file tests/payments/payment.routes.test.ts
 * Integration tests for payment module routes.
 *
 * POST /api/v1/payments/initiate         — auth required
 * POST /api/v1/payments/webhook/buni     — no auth; Buni STK callback
 * GET  /api/v1/payments/status/:txRef    — auth required
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
import {
  seedLocation,
  createPaymentTestUser,
  makePaymentToken,
  seedPaymentRecord,
} from './helpers.js';

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
    it('returns 401 with no auth token', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .send({ method: 'MPESA', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      expect(res.status).toBe(401);
    });

    it('returns 400 when method is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid method value (not MPESA)', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'BITCOIN', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });
      expect(res.status).toBe(400);
    });

    it('returns 400 when purpose is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid purpose value', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'BRIBE' });
      expect(res.status).toBe(400);
    });

    it('initiates an MPESA DUES ORDINARY payment and returns txRef (200)', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'DUES', purposeMeta: { tier: 'ORDINARY', period: '2026-03' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.txRef).toMatch(/^UJ-/);

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: res.body.data.txRef } });
      expect(record!.status).toBe('PENDING');
      expect(Number(record!.amount)).toBe(60);
    });

    it('initiates a VERIFICATION payment (100 KES)', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'VERIFICATION' });

      expect(res.status).toBe(200);
      expect(res.body.data.txRef).toMatch(/^UJ-/);

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: res.body.data.txRef } });
      expect(Number(record!.amount)).toBe(100);
    });

    it('initiates a TREASURY_DEPOSIT payment', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'TREASURY_DEPOSIT', purposeMeta: { groupId: 'some-group', amount: 250 } });

      expect(res.status).toBe(200);
      expect(res.body.data.txRef).toMatch(/^UJ-/);
    });

    it('returns 400 when DUES tier is unknown (unknown tier in meta)', async () => {
      const res = await request(app)
        .post(`${BASE}/initiate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'MPESA', purpose: 'DUES', purposeMeta: { tier: 'PLATINUM', period: '2026-03' } });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  // POST /webhook/buni
  // ─────────────────────────────────────────────

  describe('POST /webhook/buni', () => {
    it('returns 400 when Body is missing entirely', async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({ event: 'stk_push' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when stkCallback is missing from Body', async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({ Body: {} });
      expect(res.status).toBe(400);
    });

    it('returns 400 when required stkCallback fields are missing', async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({ Body: { stkCallback: { MerchantRequestID: 'X' } } });
      expect(res.status).toBe(400);
    });

    it('processes a successful Buni STK callback (ResultCode 0) and returns KCB ack', async () => {
      const checkoutRequestId = `CRI-ROUTE-OK-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-ROUTE-OK-${Date.now()}`,
        flwRef: checkoutRequestId,
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
        amount: 60,
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

    it('processes a failed STK callback (ResultCode 1032) and marks record FAILED', async () => {
      const checkoutRequestId = `CRI-ROUTE-CANCEL-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-ROUTE-CANCEL-${Date.now()}`,
        flwRef: checkoutRequestId,
      });

      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MR-ROUTE-002',
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

    it('returns 200 ack even for an unknown CheckoutRequestID (graceful)', async () => {
      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MR-UNKNOWN',
              CheckoutRequestID: 'CRI-NEVER-EXISTED',
              ResultCode: 0,
              ResultDesc: 'Success',
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe('0');
    });

    it('does not require auth (no token → still 200 for valid body)', async () => {
      const checkoutRequestId = `CRI-NOAUTH-${Date.now()}`;
      await seedPaymentRecord(userId, {
        txRef: `UJ-NOAUTH-${Date.now()}`,
        flwRef: checkoutRequestId,
      });

      const res = await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MR-NOAUTH',
              CheckoutRequestID: checkoutRequestId,
              ResultCode: 1037,
              ResultDesc: 'Timeout',
            },
          },
        });

      expect(res.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────
  // GET /status/:txRef
  // ─────────────────────────────────────────────

  describe('GET /status/:txRef', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).get(`${BASE}/status/UJ-SOME-REF`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent txRef', async () => {
      const res = await request(app)
        .get(`${BASE}/status/UJ-NONEXISTENT-99999`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns the payment record for the owner (200)', async () => {
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-STATUS-${Date.now()}`,
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
        amount: 60,
      });

      const res = await request(app)
        .get(`${BASE}/status/${record.txRef}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.txRef).toBe(record.txRef);
      expect(res.body.data.status).toBe('PENDING');
      expect(Number(res.body.data.amount)).toBe(60);
    });

    it('returns 403 when a different user requests the record', async () => {
      const other = await createPaymentTestUser(`other-route-${Date.now()}@test.com`);
      const otherRecord = await seedPaymentRecord(other.id, {
        txRef: `UJ-OTHER-${Date.now()}`,
      });

      const res = await request(app)
        .get(`${BASE}/status/${otherRecord.txRef}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns COMPLETED status after a webhook completes the payment', async () => {
      const checkoutRequestId = `CRI-STATUS-RT-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-STATUS-RT-${Date.now()}`,
        flwRef: checkoutRequestId,
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
        amount: 60,
      });

      await prisma.onboardingProgress.create({ data: { userId } });

      // Simulate webhook arriving
      await request(app)
        .post(`${BASE}/webhook/buni`)
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MR-STATUS-RT',
              CheckoutRequestID: checkoutRequestId,
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [{ Name: 'Amount', Value: 60 }],
              },
            },
          },
        });

      const statusRes = await request(app)
        .get(`${BASE}/status/${record.txRef}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe('COMPLETED');
    });
  });
});

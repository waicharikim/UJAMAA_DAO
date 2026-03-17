/**
 * @file tests/payments/payment.service.test.ts
 * Unit tests for PaymentService
 *
 * All Flutterwave calls are skipped in NODE_ENV=test (stub path in service).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { paymentService } from '../../src/modules/payments/services/payment.service.js';
import { seedLocation, createPaymentTestUser, seedPaymentRecord } from './helpers.js';

describe('PaymentService', () => {
  let userId: string;

  beforeEach(async () => {
    await seedLocation();
    const user = await createPaymentTestUser(`payment-service-${Date.now()}@test.com`);
    userId = user.id;
  });

  // ─────────────────────────────────────────────
  // initiatePayment
  // ─────────────────────────────────────────────

  describe('initiatePayment — MPESA DUES', () => {
    it('creates a PENDING PaymentRecord and returns txRef', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      expect(result.txRef).toBeDefined();
      expect(result.txRef).toMatch(/^UJ-/);
      expect(result.paymentLink).toBeUndefined();

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(record).not.toBeNull();
      expect(record!.status).toBe('PENDING');
      expect(record!.method).toBe('MPESA');
      expect(record!.purpose).toBe('DUES');
      expect(Number(record!.amount)).toBe(60); // ORDINARY tier
    });

    it('creates PaymentRecord for SUPPORTER tier (200 KES)', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'SUPPORTER', period: '2026-03' },
      });

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(Number(record!.amount)).toBe(200);
    });

    it('throws 400 for unknown dues tier', async () => {
      await expect(
        paymentService.initiatePayment(userId, {
          method: 'MPESA',
          purpose: 'DUES',
          purposeMeta: { tier: 'GOLD', period: '2026-03' },
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('initiatePayment — CARD DUES', () => {
    it('returns a card payment link stub in test mode', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'CARD',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      expect(result.txRef).toBeDefined();
      expect(result.paymentLink).toMatch(/flutterwave/);

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(record!.method).toBe('CARD');
    });
  });

  describe('initiatePayment — VERIFICATION', () => {
    it('creates a 100 KES VERIFICATION payment record', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'VERIFICATION',
      });

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(record!.purpose).toBe('VERIFICATION');
      expect(Number(record!.amount)).toBe(100);
    });
  });

  describe('initiatePayment — TREASURY_DEPOSIT', () => {
    it('creates a treasury deposit record with amount from meta', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'TREASURY_DEPOSIT',
        purposeMeta: { groupId: 'some-group-id', amount: 500 },
      });

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(record!.purpose).toBe('TREASURY_DEPOSIT');
      expect(Number(record!.amount)).toBe(500);
    });
  });

  // ─────────────────────────────────────────────
  // handleWebhook
  // ─────────────────────────────────────────────

  describe('handleWebhook', () => {
    it('marks a PENDING record COMPLETED on successful charge', async () => {
      const { txRef } = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      // Seed onboarding and PR balance needed by duesService.recordPayment
      await prisma.onboardingProgress.create({ data: { userId } });

      await paymentService.handleWebhook(
        {
          event: 'charge.completed',
          data: {
            id: 1,
            tx_ref: txRef,
            flw_ref: 'FLW-REF-001',
            amount: 60,
            currency: 'KES',
            charged_amount: 60,
            status: 'successful',
            payment_type: 'mpesa',
            customer: { id: 1, name: 'Test User', email: 'test@test.com' },
          },
        },
        'test-signature'
      );

      const record = await prisma.paymentRecord.findUnique({ where: { txRef } });
      expect(record!.status).toBe('COMPLETED');
      expect(record!.flwRef).toBe('FLW-REF-001');
      expect(record!.completedAt).not.toBeNull();
    });

    it('marks FAILED on non-successful charge status', async () => {
      const { txRef } = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      await paymentService.handleWebhook(
        {
          event: 'charge.completed',
          data: {
            id: 2,
            tx_ref: txRef,
            flw_ref: 'FLW-REF-002',
            amount: 60,
            currency: 'KES',
            charged_amount: 0,
            status: 'failed',
            payment_type: 'mpesa',
            customer: { id: 1, name: 'Test User', email: 'test@test.com' },
          },
        },
        'test-signature'
      );

      const record = await prisma.paymentRecord.findUnique({ where: { txRef } });
      expect(record!.status).toBe('FAILED');
    });

    it('skips non-charge events gracefully', async () => {
      await expect(
        paymentService.handleWebhook(
          {
            event: 'transfer.completed',
            data: {
              id: 3, tx_ref: 'X', flw_ref: 'Y', amount: 0, currency: 'KES',
              charged_amount: 0, status: 'successful', payment_type: 'bank',
              customer: { id: 1, name: 'T', email: 't@t.com' },
            },
          },
          ''
        )
      ).resolves.toBeUndefined();
    });

    it('is idempotent — ignores already-processed records', async () => {
      const { txRef } = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      await prisma.onboardingProgress.create({ data: { userId } });

      const webhookPayload = {
        event: 'charge.completed' as const,
        data: {
          id: 4,
          tx_ref: txRef,
          flw_ref: 'FLW-REF-003',
          amount: 60,
          currency: 'KES',
          charged_amount: 60,
          status: 'successful',
          payment_type: 'mpesa',
          customer: { id: 1, name: 'Test', email: 't@t.com' },
        },
      };

      await paymentService.handleWebhook(webhookPayload, '');
      // Second call should not throw
      await expect(paymentService.handleWebhook(webhookPayload, '')).resolves.toBeUndefined();
    });

    it('ignores webhook for unknown txRef', async () => {
      await expect(
        paymentService.handleWebhook(
          {
            event: 'charge.completed',
            data: {
              id: 5, tx_ref: 'UNKNOWN-REF', flw_ref: 'FLW-X', amount: 60, currency: 'KES',
              charged_amount: 60, status: 'successful', payment_type: 'mpesa',
              customer: { id: 1, name: 'T', email: 't@t.com' },
            },
          },
          ''
        )
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // handleBuniWebhook
  // ─────────────────────────────────────────────

  describe('handleBuniWebhook', () => {
    it('marks COMPLETED on ResultCode 0 and routes dues downstream', async () => {
      const checkoutRequestId = `CRI-TEST-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-${Date.now()}`,
        flwRef: checkoutRequestId,
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      await prisma.onboardingProgress.create({ data: { userId } });

      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-001',
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 60 },
                { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
                { Name: 'TransactionDate', Value: 20260317145000 },
                { Name: 'PhoneNumber', Value: 254712345678 },
              ],
            },
          },
        },
      });

      expect(ack.statusCode).toBe('0');

      const updated = await prisma.paymentRecord.findUnique({ where: { id: record.id } });
      expect(updated!.status).toBe('COMPLETED');
      expect(updated!.completedAt).not.toBeNull();

      // DuesPayment should have been created
      const dues = await prisma.duesPayment.findFirst({ where: { userId } });
      expect(dues).not.toBeNull();
    });

    it('marks FAILED on non-zero ResultCode', async () => {
      const checkoutRequestId = `CRI-FAIL-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-FAIL-${Date.now()}`,
        flwRef: checkoutRequestId,
      });

      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-002',
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user.',
          },
        },
      });

      expect(ack.statusCode).toBe('0');

      const updated = await prisma.paymentRecord.findUnique({ where: { id: record.id } });
      expect(updated!.status).toBe('FAILED');
    });

    it('is idempotent — second call on COMPLETED record is a no-op', async () => {
      const checkoutRequestId = `CRI-IDEM-${Date.now()}`;
      await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-IDEM-${Date.now()}`,
        flwRef: checkoutRequestId,
        status: 'COMPLETED',
      });

      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-003',
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'Success',
          },
        },
      });

      expect(ack.statusCode).toBe('0');
      expect(ack.statusMessage).toMatch(/Already processed/);
    });

    it('acknowledges gracefully for unknown CheckoutRequestID', async () => {
      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-999',
            CheckoutRequestID: 'CRI-UNKNOWN-99999',
            ResultCode: 0,
            ResultDesc: 'Success',
          },
        },
      });

      expect(ack.statusCode).toBe('0');
    });
  });

  // ─────────────────────────────────────────────
  // getPaymentStatus
  // ─────────────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('returns record for owner', async () => {
      const { txRef } = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      const record = await paymentService.getPaymentStatus(txRef, userId);
      expect(record.txRef).toBe(txRef);
      expect(record.status).toBe('PENDING');
    });

    it('throws 404 for unknown txRef', async () => {
      await expect(
        paymentService.getPaymentStatus('NO-SUCH-REF', userId)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when userId does not match', async () => {
      const { txRef } = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      await expect(
        paymentService.getPaymentStatus(txRef, '00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});

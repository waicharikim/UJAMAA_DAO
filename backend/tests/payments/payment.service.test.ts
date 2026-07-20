/**
 * @file tests/payments/payment.service.test.ts
 * Unit tests for PaymentService — Buni/M-Pesa only (Flutterwave removed).
 *
 * NODE_ENV=test causes initiatePayment to skip the actual Buni HTTP call
 * and return a stub immediately after creating the PaymentRecord.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { paymentService } from '../../src/modules/payments/services/payment.service.js';
import {
  seedLocation,
  createPaymentTestUser,
  seedPaymentRecord,
  seedWithdrawal,
} from './helpers.js';

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

  describe('initiatePayment', () => {
    it('creates a PENDING PaymentRecord and returns txRef for DUES ORDINARY (60 KES)', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      expect(result.txRef).toBeDefined();
      expect(result.txRef).toMatch(/^UJ-/);

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(record).not.toBeNull();
      expect(record!.status).toBe('PENDING');
      expect(record!.method).toBe('MPESA');
      expect(record!.purpose).toBe('DUES');
      expect(Number(record!.amount)).toBe(60);
      expect(record!.userId).toBe(userId);
    });

    it('creates a PENDING record for DUES SUPPORTER (200 KES)', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'SUPPORTER', period: '2026-03' },
      });

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(Number(record!.amount)).toBe(200);
    });

    it('creates a PENDING record for DUES SPONSOR (1000 KES)', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'SPONSOR', period: '2026-04' },
      });

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(Number(record!.amount)).toBe(1000);
    });

    it('throws 400 for an unknown dues tier', async () => {
      await expect(
        paymentService.initiatePayment(userId, {
          method: 'MPESA',
          purpose: 'DUES',
          purposeMeta: { tier: 'GOLD', period: '2026-03' },
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('creates a PENDING record for VERIFICATION (100 KES)', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'VERIFICATION',
      });

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(record!.purpose).toBe('VERIFICATION');
      expect(Number(record!.amount)).toBe(100);
      expect(record!.status).toBe('PENDING');
    });

    it('creates a PENDING record for TREASURY_DEPOSIT with amount from meta', async () => {
      const result = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'TREASURY_DEPOSIT',
        purposeMeta: { groupId: 'test-group-id', amount: 500 },
      });

      const record = await prisma.paymentRecord.findUnique({ where: { txRef: result.txRef } });
      expect(record!.purpose).toBe('TREASURY_DEPOSIT');
      expect(Number(record!.amount)).toBe(500);
    });

    it('throws 404 for an unknown userId', async () => {
      await expect(
        paymentService.initiatePayment('00000000-0000-0000-0000-000000000000', {
          method: 'MPESA',
          purpose: 'DUES',
          purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('each call generates a unique txRef', async () => {
      const r1 = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });
      const r2 = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-04' },
      });
      expect(r1.txRef).not.toBe(r2.txRef);
    });
  });

  // ─────────────────────────────────────────────
  // handleBuniWebhook
  // ─────────────────────────────────────────────

  describe('handleBuniWebhook', () => {
    it('marks a PENDING DUES record COMPLETED on ResultCode 0 and creates a DuesPayment', async () => {
      const checkoutRequestId = `CRI-SVC-OK-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-OK-${Date.now()}`,
        flwRef: checkoutRequestId,
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
        amount: 60,
      });

      await prisma.onboardingProgress.create({ data: { userId } });

      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-SVC-001',
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

      const dues = await prisma.duesPayment.findFirst({ where: { userId } });
      expect(dues).not.toBeNull();
      expect(dues!.tier).toBe('ORDINARY');
    });

    it('marks FAILED on non-zero ResultCode (user cancelled — 1032)', async () => {
      const checkoutRequestId = `CRI-SVC-CANCEL-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-CANCEL-${Date.now()}`,
        flwRef: checkoutRequestId,
      });

      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-SVC-002',
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

    it('marks FAILED on ResultCode 1037 (STK push timeout)', async () => {
      const checkoutRequestId = `CRI-SVC-TIMEOUT-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-TIMEOUT-${Date.now()}`,
        flwRef: checkoutRequestId,
      });

      await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-SVC-003',
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 1037,
            ResultDesc: 'DS timeout user cannot be reached',
          },
        },
      });

      const updated = await prisma.paymentRecord.findUnique({ where: { id: record.id } });
      expect(updated!.status).toBe('FAILED');
    });

    it('is idempotent — returns "Already processed" for a non-PENDING record', async () => {
      const checkoutRequestId = `CRI-SVC-IDEM-${Date.now()}`;
      await seedPaymentRecord(userId, {
        txRef: `UJ-BUNI-IDEM-${Date.now()}`,
        flwRef: checkoutRequestId,
        status: 'COMPLETED',
      });

      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-SVC-004',
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [{ Name: 'Amount', Value: 60 }],
            },
          },
        },
      });

      expect(ack.statusCode).toBe('0');
      expect(ack.statusMessage).toMatch(/Already processed/);
    });

    it('acknowledges gracefully for an unknown CheckoutRequestID', async () => {
      const ack = await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-SVC-999',
            CheckoutRequestID: 'CRI-UNKNOWN-NEVER-EXISTS',
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
    it('returns the record for its owner', async () => {
      const { txRef } = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      const record = await paymentService.getPaymentStatus(txRef, userId);
      expect(record.txRef).toBe(txRef);
      expect(record.status).toBe('PENDING');
      expect(record.userId).toBe(userId);
    });

    it('throws 404 for an unknown txRef', async () => {
      await expect(
        paymentService.getPaymentStatus('UJ-DOES-NOT-EXIST', userId)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when the requesting userId does not match the record owner', async () => {
      const { txRef } = await paymentService.initiatePayment(userId, {
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
      });

      await expect(
        paymentService.getPaymentStatus(txRef, '00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('reflects FAILED status after an unsuccessful webhook', async () => {
      const checkoutRequestId = `CRI-STATUS-FAIL-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-STATUS-FAIL-${Date.now()}`,
        flwRef: checkoutRequestId,
      });

      await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-STATUS-002',
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user.',
          },
        },
      });

      const status = await paymentService.getPaymentStatus(record.txRef, userId);
      expect(status.status).toBe('FAILED');
    });

    it('reflects COMPLETED status after a successful webhook', async () => {
      const checkoutRequestId = `CRI-STATUS-DONE-${Date.now()}`;
      const record = await seedPaymentRecord(userId, {
        txRef: `UJ-STATUS-DONE-${Date.now()}`,
        flwRef: checkoutRequestId,
        method: 'MPESA',
        purpose: 'DUES',
        purposeMeta: { tier: 'ORDINARY', period: '2026-03' },
        amount: 60,
      });

      await prisma.onboardingProgress.create({ data: { userId } });

      await paymentService.handleBuniWebhook({
        Body: {
          stkCallback: {
            MerchantRequestID: 'MR-STATUS-001',
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [{ Name: 'Amount', Value: 60 }],
            },
          },
        },
      });

      const status = await paymentService.getPaymentStatus(record.txRef, userId);
      expect(status.status).toBe('COMPLETED');
      expect(status.completedAt).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // handleBuniB2cWebhook
  // ─────────────────────────────────────────────

  describe('handleBuniB2cWebhook', () => {
    const b2cPayload = (
      resultCode: number,
      withdrawalId: string | null,
      desc = 'desc'
    ) => ({
      Result: {
        ResultType: 0,
        ResultCode: resultCode,
        ResultDesc: desc,
        OriginatorConversationID: `OCI-${Date.now()}`,
        ConversationID: `CI-${Date.now()}`,
        TransactionID: `TXN-${Date.now()}`,
        ...(withdrawalId !== null
          ? { ReferenceData: { ReferenceItem: { Key: 'Occasion', Value: withdrawalId } } }
          : {}),
      },
    });

    it('returns success=true and correct withdrawalId on ResultCode 0', async () => {
      const withdrawal = await seedWithdrawal(userId);

      const result = await paymentService.handleBuniB2cWebhook(b2cPayload(0, withdrawal.id));

      expect(result.success).toBe(true);
      expect(result.withdrawalId).toBe(withdrawal.id);
    });

    it('returns success=false and withdrawalId on non-zero ResultCode', async () => {
      const withdrawal = await seedWithdrawal(userId);

      const result = await paymentService.handleBuniB2cWebhook(
        b2cPayload(2001, withdrawal.id, 'The initiator information is invalid.')
      );

      expect(result.success).toBe(false);
      expect(result.withdrawalId).toBe(withdrawal.id);
      expect(result.desc).toBe('The initiator information is invalid.');
    });

    it('returns withdrawalId=null when ReferenceData is absent', async () => {
      const result = await paymentService.handleBuniB2cWebhook(b2cPayload(0, null));

      expect(result.withdrawalId).toBeNull();
      expect(result.success).toBe(true);
    });

    it('returns withdrawalId=null when ReferenceItem Key is not Occasion', async () => {
      const result = await paymentService.handleBuniB2cWebhook({
        Result: {
          ResultType: 0,
          ResultCode: 0,
          ResultDesc: 'Success',
          OriginatorConversationID: 'OCI-KEY',
          ConversationID: 'CI-KEY',
          TransactionID: 'TXN-KEY',
          ReferenceData: { ReferenceItem: { Key: 'QueueTimeoutURL', Value: 'https://example.com' } },
        },
      });

      expect(result.withdrawalId).toBeNull();
    });
  });
});

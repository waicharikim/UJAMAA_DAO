/**
 * @file tests/economy/utWithdrawal.service.test.ts
 * Unit tests for UtWithdrawalService.completePayout() and refundPayout().
 *
 * These methods are called by the B2C webhook handler and the BullMQ
 * failedJobHandler, so they must be idempotent and never corrupt balances.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { utWithdrawalService } from '../../src/modules/economy/services/utWithdrawal.service.js';
import { seedLocation, createEconomyTestUser } from './helpers.js';

describe('UtWithdrawalService', () => {
  let userId: string;

  beforeEach(async () => {
    await seedLocation();
    const user = await createEconomyTestUser(`ut-service-${Date.now()}@test.com`);
    userId = user.id;
    await prisma.user.update({
      where: { id: userId },
      data: { fiatBackedUtBalance: 1000, earnedUtBalance: 200 },
    });
  });

  const seedPendingWithdrawal = (amountKes = 300) =>
    prisma.utWithdrawal.create({
      data: {
        userId,
        amountKes,
        mpesaPhone: '+254712345678',
        status: 'PENDING',
      },
    });

  // ─────────────────────────────────────────────
  // completePayout
  // ─────────────────────────────────────────────

  describe('completePayout', () => {
    it('marks a PENDING withdrawal as COMPLETED', async () => {
      const withdrawal = await seedPendingWithdrawal();

      await utWithdrawalService.completePayout(withdrawal.id);

      const updated = await prisma.utWithdrawal.findUnique({ where: { id: withdrawal.id } });
      expect(updated!.status).toBe('COMPLETED');
      expect(updated!.completedAt).not.toBeNull();
    });

    it('does NOT restore fiatBackedUtBalance on completion', async () => {
      const withdrawal = await seedPendingWithdrawal(300);

      await utWithdrawalService.completePayout(withdrawal.id);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user!.fiatBackedUtBalance).toBe(1000); // unchanged — already deducted at withdraw time
    });

    it('never touches earnedUtBalance', async () => {
      const withdrawal = await seedPendingWithdrawal();

      await utWithdrawalService.completePayout(withdrawal.id);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user!.earnedUtBalance).toBe(200);
    });

    it('is idempotent — calling twice on COMPLETED withdrawal leaves status COMPLETED', async () => {
      const withdrawal = await seedPendingWithdrawal();

      await utWithdrawalService.completePayout(withdrawal.id);
      await utWithdrawalService.completePayout(withdrawal.id); // second call

      const updated = await prisma.utWithdrawal.findUnique({ where: { id: withdrawal.id } });
      expect(updated!.status).toBe('COMPLETED');
    });

    it('is idempotent — calling on a FAILED withdrawal leaves status FAILED (does not re-complete)', async () => {
      const withdrawal = await prisma.utWithdrawal.create({
        data: { userId, amountKes: 100, mpesaPhone: '+254712345678', status: 'FAILED' },
      });

      await utWithdrawalService.completePayout(withdrawal.id);

      const updated = await prisma.utWithdrawal.findUnique({ where: { id: withdrawal.id } });
      expect(updated!.status).toBe('FAILED');
    });

    it('returns gracefully when withdrawalId does not exist', async () => {
      await expect(
        utWithdrawalService.completePayout('00000000-0000-0000-0000-000000000000')
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // refundPayout
  // ─────────────────────────────────────────────

  describe('refundPayout', () => {
    it('marks a PENDING withdrawal as FAILED', async () => {
      const withdrawal = await seedPendingWithdrawal();

      await utWithdrawalService.refundPayout(withdrawal.id, 'B2C timeout');

      const updated = await prisma.utWithdrawal.findUnique({ where: { id: withdrawal.id } });
      expect(updated!.status).toBe('FAILED');
    });

    it('restores fiatBackedUtBalance to the user', async () => {
      const withdrawal = await seedPendingWithdrawal(300);

      await utWithdrawalService.refundPayout(withdrawal.id, 'B2C error');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user!.fiatBackedUtBalance).toBe(1300); // 1000 + 300 refunded
    });

    it('never touches earnedUtBalance', async () => {
      const withdrawal = await seedPendingWithdrawal();

      await utWithdrawalService.refundPayout(withdrawal.id, 'test reason');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user!.earnedUtBalance).toBe(200);
    });

    it('is idempotent — calling twice does not double-refund the balance', async () => {
      const withdrawal = await seedPendingWithdrawal(300);

      await utWithdrawalService.refundPayout(withdrawal.id, 'reason');
      await utWithdrawalService.refundPayout(withdrawal.id, 'reason'); // second call

      const user = await prisma.user.findUnique({ where: { id: userId } });
      // Balance was 1000; only one refund of 300 should have occurred
      expect(user!.fiatBackedUtBalance).toBe(1300);

      const updated = await prisma.utWithdrawal.findUnique({ where: { id: withdrawal.id } });
      expect(updated!.status).toBe('FAILED');
    });

    it('is idempotent — calling on a COMPLETED withdrawal leaves status COMPLETED (no refund)', async () => {
      const withdrawal = await prisma.utWithdrawal.create({
        data: {
          userId,
          amountKes: 300,
          mpesaPhone: '+254712345678',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await utWithdrawalService.refundPayout(withdrawal.id, 'late failure');

      const updated = await prisma.utWithdrawal.findUnique({ where: { id: withdrawal.id } });
      expect(updated!.status).toBe('COMPLETED'); // should not be downgraded

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user!.fiatBackedUtBalance).toBe(1000); // not credited — payout already completed
    });

    it('returns gracefully when withdrawalId does not exist', async () => {
      await expect(
        utWithdrawalService.refundPayout('00000000-0000-0000-0000-000000000000', 'missing')
      ).resolves.toBeUndefined();
    });
  });
});

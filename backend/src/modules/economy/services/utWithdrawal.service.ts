/**
 * @file src/modules/economy/services/utWithdrawal.service.ts
 * @description
 * UT Withdrawal Service — fiatBackedUtBalance → M-Pesa
 *
 * Rule 4: Only fiatBackedUtBalance is cashable. earnedUtBalance has no cash-out path.
 * Rule 2: Real money flows through M-Pesa to platform-controlled accounts — never P2P.
 *
 * Flow:
 *   1. Validate user has sufficient fiatBackedUtBalance
 *   2. Deduct atomically (debit + log in one transaction)
 *   3. Initiate M-Pesa B2C payout via payments module (stubbed — requires Flutterwave keys)
 *   4. Write audit record
 *
 * Version: 1.0 — March 2026
 */

import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { getUtContract } from '../../../core/blockchain/client.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { economyQueue } from '../../../core/queue/index.js';
import {
  MPESA_PAYOUT_JOB,
  MpesaPayoutJobData,
} from '../jobs/ut-payout.jobs.js';

const MIN_WITHDRAWAL = 10;
const MAX_WITHDRAWAL = 10_000;
const DAILY_LIMIT_KES = 50_000;

export interface WithdrawUtDto {
  amountKes: number; // 1 UT = 1 KES
  mpesaPhone: string; // E.164 format e.g. +254712345678
}

export interface WithdrawUtResult {
  transactionRef: string; // internal reference
  amountKes: number;
  newFiatBalance: number;
  status: 'PENDING_PAYOUT'; // payout is async — webhook confirms
}

export class UtWithdrawalService {
  async withdraw(
    userId: string,
    dto: WithdrawUtDto
  ): Promise<WithdrawUtResult> {
    const { amountKes, mpesaPhone } = dto;

    if (amountKes < MIN_WITHDRAWAL) {
      throw new ApiError(`Minimum withdrawal is ${MIN_WITHDRAWAL} KES`, 400);
    }
    if (amountKes > MAX_WITHDRAWAL) {
      throw new ApiError(
        `Maximum withdrawal per request is ${MAX_WITHDRAWAL} KES`,
        400
      );
    }

    // Daily limit check — sum of completed + pending withdrawals today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayWithdrawals = await prisma.utWithdrawal.aggregate({
      where: {
        userId,
        status: { in: ['PENDING', 'COMPLETED'] },
        createdAt: { gte: startOfDay },
      },
      _sum: { amountKes: true },
    });
    const todayTotal = (todayWithdrawals._sum.amountKes ?? 0) + amountKes;
    if (todayTotal > DAILY_LIMIT_KES) {
      throw new ApiError(
        `Daily withdrawal limit is ${DAILY_LIMIT_KES} KES. Already withdrawn today: ${todayTotal - amountKes} KES`,
        400
      );
    }

    // Fetch current balances
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fiatBackedUtBalance: true, earnedUtBalance: true },
    });

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    if (user.fiatBackedUtBalance < amountKes) {
      throw new ApiError(
        `Insufficient cashable UT balance. Available: ${user.fiatBackedUtBalance} KES, requested: ${amountKes} KES`,
        402
      );
    }

    const newFiatBalance = user.fiatBackedUtBalance - amountKes;

    // Deduct atomically and create withdrawal record
    const withdrawal = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { fiatBackedUtBalance: { decrement: amountKes } },
      });

      return tx.utWithdrawal.create({
        data: {
          userId,
          amountKes,
          mpesaPhone,
          status: 'PENDING',
        },
      });
    });

    // Audit trail
    await auditService.log(
      userId,
      AuditAction.UT_WITHDRAWAL_REQUESTED,
      'UtWithdrawal',
      withdrawal.id,
      {
        amountKes,
        mpesaPhone: mpesaPhone.slice(0, -4) + '****',
        newFiatBalance,
      }
    );

    logger.info(
      { userId, amountKes, withdrawalId: withdrawal.id },
      '[UT] Withdrawal requested — payout pending'
    );

    // On-chain UT burn — mirrors DB fiatBackedUt deduction
    if (process.env.NODE_ENV !== 'test') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });
      if (user?.walletAddress) {
        const utContract = getUtContract();
        if (utContract) {
          try {
            const amountWei = BigInt(amountKes) * BigInt(10 ** 18);
            await utContract.burn(user.walletAddress, amountWei);
            logger.info(
              { userId, amountKes },
              '[UT] On-chain burn succeeded (withdrawal)'
            );
          } catch (err) {
            logger.warn(
              { userId, err },
              '[UT] On-chain burn failed — off-chain record intact'
            );
          }
        }
      }
    }

    // Enqueue B2C payout job — idempotent via jobId = withdrawalId; skipped in test
    if (process.env.NODE_ENV !== 'test') {
      const jobData: MpesaPayoutJobData = {
        withdrawalId: withdrawal.id,
        amountKes,
        mpesaPhone,
      };
      await economyQueue.add(MPESA_PAYOUT_JOB, jobData, {
        jobId: withdrawal.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      });
    }

    return {
      transactionRef: withdrawal.id,
      amountKes,
      newFiatBalance,
      status: 'PENDING_PAYOUT',
    };
  }

  async completePayout(withdrawalId: string): Promise<void> {
    const withdrawal = await prisma.utWithdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) {
      logger.warn(
        { withdrawalId },
        '[UT] completePayout: withdrawal not found'
      );
      return;
    }
    if (withdrawal.status !== 'PENDING') {
      logger.info(
        { withdrawalId, status: withdrawal.status },
        '[UT] completePayout: already settled — idempotent skip'
      );
      return;
    }

    await prisma.utWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await auditService.log(
      withdrawal.userId,
      AuditAction.UT_WITHDRAWAL_COMPLETED,
      'UtWithdrawal',
      withdrawalId,
      { amountKes: withdrawal.amountKes }
    );

    logger.info(
      { withdrawalId, amountKes: withdrawal.amountKes },
      '[UT] Payout completed'
    );
  }

  async refundPayout(withdrawalId: string, reason: string): Promise<void> {
    const withdrawal = await prisma.utWithdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) {
      logger.warn({ withdrawalId }, '[UT] refundPayout: withdrawal not found');
      return;
    }
    if (withdrawal.status !== 'PENDING') {
      logger.info(
        { withdrawalId, status: withdrawal.status },
        '[UT] refundPayout: already settled — idempotent skip'
      );
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: withdrawal.userId },
        data: { fiatBackedUtBalance: { increment: withdrawal.amountKes } },
      }),
      prisma.utWithdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'FAILED' },
      }),
    ]);

    await auditService.log(
      withdrawal.userId,
      AuditAction.UT_WITHDRAWAL_FAILED,
      'UtWithdrawal',
      withdrawalId,
      { amountKes: withdrawal.amountKes, reason }
    );

    logger.warn(
      { withdrawalId, amountKes: withdrawal.amountKes, reason },
      '[UT] Payout failed — balance refunded'
    );
  }

  async getWithdrawals(userId: string): Promise<{
    withdrawals: Array<{
      id: string;
      amountKes: number;
      status: string;
      createdAt: string;
    }>;
    fiatBackedUtBalance: number;
    earnedUtBalance: number;
  }> {
    const [user, withdrawals] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { fiatBackedUtBalance: true, earnedUtBalance: true },
      }),
      prisma.utWithdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, amountKes: true, status: true, createdAt: true },
      }),
    ]);

    if (!user) throw new ApiError('User not found', 404);

    return {
      fiatBackedUtBalance: user.fiatBackedUtBalance,
      earnedUtBalance: user.earnedUtBalance,
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amountKes: w.amountKes,
        status: w.status,
        createdAt: w.createdAt.toISOString(),
      })),
    };
  }
}

export const utWithdrawalService = new UtWithdrawalService();

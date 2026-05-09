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
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';

const MIN_WITHDRAWAL = 10; // minimum 10 KES / 10 UT
const MAX_WITHDRAWAL = 10000; // cap per request

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

    // TODO: Trigger M-Pesa B2C payout via Buni when credentials are available

    return {
      transactionRef: withdrawal.id,
      amountKes,
      newFiatBalance,
      status: 'PENDING_PAYOUT',
    };
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

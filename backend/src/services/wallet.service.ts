/**
 * @file wallet.service.ts
 * @description Wallet service: atomic balance updates and transaction logging.
 *
 * - Uses Prisma $transaction for atomic operations.
 * - Uses Decimal for money arithmetic (Prisma Decimal).
 * - Exposes getWalletBalance, updateWalletBalance, getWalletTransactions.
 */

import { Prisma } from '@prisma/client';
import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { logUserAudit } from './userAudit.service.js'; // Assuming a User Audit Service exists

type HolderType = 'USER' | 'GROUP';
type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type TxType = 'DEPOSIT' | 'WITHDRAWAL' | 'SPEND' | 'REFUND' | 'ADJUSTMENT';

/**
 * Retrieves the wallet balance for a holder, creating it if it doesn't exist.
 */
export async function getWalletBalance(holderType: HolderType, holderId: string) {
  const where = holderType === 'USER'
    ? { holderType_userId_wallet: { holderType, userId: holderId } }
    : { holderType_groupId_wallet: { holderType, groupId: holderId } };

  let wallet = await prisma.walletBalance.findUnique({ where });
  if (!wallet) {
    // Create wallet record on demand
    wallet = await prisma.walletBalance.create({
      data: {
        holderType,
        ...(holderType === 'USER' ? { userId: holderId } : { groupId: holderId }),
        balance: new Prisma.Decimal(0),
        currency: 'KES',
      },
    });
  }
  return wallet;
}

/**
 * Atomically updates a wallet balance and records a transaction.
 *
 * @param holderType 'USER' or 'GROUP'
 * @param holderId ID of the user or group
 * @param type Type of transaction (DEPOSIT, WITHDRAWAL, etc.)
 * @param amount The amount to change the balance by (positive for deposit, negative for withdrawal)
 * @param memo Transaction description
 * @param actorId The user ID initiating the change (for audit)
 * @returns The updated wallet and the created transaction record
 */
export async function updateWalletBalance(
  holderType: HolderType,
  holderId: string,
  type: TxType,
  amount: number,
  memo: string,
  actorId?: string
) {
  const decimalAmount = new Prisma.Decimal(amount);

  if (decimalAmount.isZero()) {
    logger.warn('Wallet update skipped: zero amount transaction.', {
      operationType: 'ECONOMIC',
      // CRITICAL FIX: Moving ad-hoc data to metadata
      metadata: {
        holderId,
        type,
        memo,
      }
    });
    // Return early if amount is zero
    return;
  }

  return prisma.$transaction(async (tx) => {
    // 1. Get the current wallet balance (or create it)
    const wallet = await getWalletBalance(holderType, holderId);
    const currentBalance = new Prisma.Decimal(wallet.balance as any);
    const newBalanceCheck = currentBalance.plus(decimalAmount);

    // 2. Check for overdraft protection (basic check)
    if (newBalanceCheck.lessThan(0)) {
      logger.error('Wallet update failed: Overdraft attempt', {
        operationType: 'ECONOMIC',
        securityEvent: {
          type: 'ECONOMIC_FRAUD',
          severity: 'HIGH',
          details: 'Overdraft attempt detected during wallet update.'
        },
        // CRITICAL FIX: Moving ad-hoc data to metadata
        metadata: {
          holderId,
          type,
          amount: decimalAmount.toString(),
          currentBalance: currentBalance.toString(),
        }
      });
      throw new ApiError('Insufficient funds for this transaction.', 400, { code: 'INSUFFICIENT_FUNDS' });
    }

    // 3. Update the wallet balance
    await tx.walletBalance.update({
      where: { id: wallet.id },
      data: {
        balance: newBalanceCheck,
      },
    });

    // 4. Record the transaction
    const txRecord = await tx.walletTransaction.create({
      data: {
        walletBalanceId: wallet.id,
        type,
        amount: decimalAmount,
        memo,
        status: 'COMPLETED',
        // Denormalize holder for easier queries
        userId: holderType === 'USER' ? holderId : undefined,
        groupId: holderType === 'GROUP' ? holderId : undefined,
      },
    });

    // 5. Audit the change (Audit must be ATOMIC with transaction)
    const updatedWallet = await tx.walletBalance.findUnique({ where: { id: wallet.id } });
    const newBalance = new Prisma.Decimal(updatedWallet?.balance as any);

    if (actorId) {
      // NOTE: Removed try/catch. If audit fails, the whole transaction must fail.
      await tx.userAudit.create({
        data: {
          userId: holderType === 'USER' ? holderId : undefined,
          field: 'walletBalance',
          oldValue: currentBalance.toString(),
          newValue: newBalance.toString(),
          changedBy: actorId,
          timestamp: new Date(),
          metadata: { transactionId: txRecord.id }
        },
      });
    }

    logger.info('Wallet balance updated successfully', {
        operationType: 'ECONOMIC',
        // CRITICAL FIX: Moving ad-hoc data to metadata
        metadata: {
          holderId,
          type,
          amount: decimalAmount.toString(),
          newBalance: newBalance.toString(),
          actor: actorId
        }
    });

    // 6. Return fresh wallet and tx
    return {
      wallet: updatedWallet,
      transaction: txRecord,
      newBalance: newBalance.toString(),
    };
  });
}

/**
 * Retrieves paginated transaction history for a wallet.
 */
export async function getWalletTransactions(holderType: HolderType, holderId: string, limit = 50, offset = 0) {
  const wallet = await getWalletBalance(holderType, holderId);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletBalanceId: wallet.id },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit
  });
  return transactions;
}

export const walletService = {
  getWalletBalance,
  updateWalletBalance,
  getWalletTransactions
};

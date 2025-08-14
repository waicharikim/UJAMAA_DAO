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

type HolderType = 'USER' | 'GROUP';
type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type TxType = 'DEPOSIT' | 'WITHDRAWAL' | 'SPEND' | 'REFUND' | 'ADJUSTMENT';

export async function getWalletBalance(holderType: HolderType, holderId: string) {
  const where = holderType === 'USER'
    ? { holderType_userId_wallet: { holderType, userId: holderId } }
    : { holderType_groupId_wallet: { holderType, groupId: holderId } };

  let wallet = await prisma.walletBalance.findUnique({ where });
  if (!wallet) {
    // Optionally create wallet record on demand
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
 * updateWalletBalance
 * Atomically credit or debit a wallet and create a transaction record.
 *
 * params.amount should be a string or number representing the decimal value (e.g., "100.50" or 100.5)
 *
 * Returns { wallet, transaction, newBalance }
 */
export async function updateWalletBalance(params: {
  holderType: HolderType;
  holderId: string;
  amount: string | number;
  mpesaReceipt?: string;
  description?: string;
  status?: TxStatus;
  type?: TxType;
  actorId?: string; // for audit
}) {
  const {
    holderType, holderId, amount, mpesaReceipt, description,
    status = 'COMPLETED', type = (Number(amount) >= 0 ? 'DEPOSIT' : 'WITHDRAWAL'), actorId,
  } = params;

  // Normalize amount to Decimal
  const decimalAmount = new Prisma.Decimal(amount.toString());

  return await prisma.$transaction(async (tx) => {
    // find or create wallet (lock row via select for update not directly available, but tx ensures atomicity)
    const where = holderType === 'USER'
      ? { holderType_userId_wallet: { holderType, userId: holderId } }
      : { holderType_groupId_wallet: { holderType, groupId: holderId } };

    let wallet = await tx.walletBalance.findUnique({ where });

    if (!wallet) {
      wallet = await tx.walletBalance.create({
        data: {
          holderType,
          ...(holderType === 'USER' ? { userId: holderId } : { groupId: holderId }),
          balance: new Prisma.Decimal(0),
          currency: 'KES',
        },
      });
    }

    // compute new balance
    const currentBalance = new Prisma.Decimal(wallet.balance as any);
    const newBalance = currentBalance.plus(decimalAmount);

    // Prevent negative balance (overdraft)
    if (newBalance.isNegative()) {
      throw new ApiError('Insufficient funds', 400);
    }

    // Update balance
    await tx.walletBalance.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    // Create transaction record
    const txRecord = await tx.walletTransaction.create({
      data: {
        walletBalanceId: wallet.id,
        type,
        amount: decimalAmount,
        mpesaReceipt,
        description,
        status,
      },
    });

    // Optionally log audit (non-blocking)
    try {
      // Implement your audit logging as needed; example:
      if (actorId) {
        await tx.userAudit.create({
          data: {
            userId: holderType === 'USER' ? holderId : undefined,
            field: 'walletBalance',
            oldValue: currentBalance.toString(),
            newValue: newBalance.toString(),
            changedBy: actorId,
            timestamp: new Date(),
          },
        });
      }
    } catch (err) {
      logger.error('Failed to write wallet audit entry', { err });
      // do not fail the main tx; audits recorded in same tx above to be consistent; optionally handle differently
    }

    // Return fresh wallet and tx
    const updatedWallet = await tx.walletBalance.findUnique({ where: { id: wallet.id } });
    return {
      wallet: updatedWallet,
      transaction: txRecord,
      newBalance: newBalance.toString(),
    };
  });
}

export async function getWalletTransactions(holderType: HolderType, holderId: string, limit = 50, offset = 0) {
  const wallet = await getWalletBalance(holderType, holderId);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletBalanceId: wallet.id },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });
  return transactions;
}
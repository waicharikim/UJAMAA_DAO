/**
 * @file src/modules/treasury/services/treasury.service.ts
 * @description
 * Treasury Service — GroupTreasury CRUD + WalletTransaction ledger + dues allocation
 *
 * Phase 1 scope:
 *  - get/create treasury per group
 *  - deposit / withdraw (admin-initiated; M-Pesa flows come later)
 *  - paginated transaction history
 *  - allocateDues: splits a confirmed DuesPayment into a WalletTransaction on the
 *    user's ward system group treasury
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { DepositDto, WithdrawDto, TransactionQueryDto } from '../types.js';

class TreasuryService {
  // ────────────────────────────────────────────────────────────
  // GET / CREATE
  // ────────────────────────────────────────────────────────────

  /**
   * Return the treasury for a group, creating one if it does not exist.
   */
  async getOrCreateTreasury(groupId: string) {
    // Verify group exists
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw ApiError.notFound('Group not found');

    const existing = await prisma.groupTreasury.findUnique({
      where: { groupId },
    });
    if (existing) return existing;

    return prisma.groupTreasury.create({
      data: { groupId, balance: 0, tokenBalance: 0 },
    });
  }

  /**
   * Return treasury DTO with group name for API responses.
   */
  async getGroupTreasury(groupId: string) {
    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId },
      include: { group: { select: { id: true, name: true } } },
    });
    if (!treasury) throw ApiError.notFound('Treasury not found for this group');

    return {
      id: treasury.id,
      groupId: treasury.groupId,
      groupName: treasury.group.name,
      balance: Number(treasury.balance),
      tokenBalance: treasury.tokenBalance ?? 0,
      createdAt: treasury.createdAt,
      updatedAt: treasury.updatedAt,
    };
  }

  // ────────────────────────────────────────────────────────────
  // DEPOSIT / WITHDRAW
  // ────────────────────────────────────────────────────────────

  /**
   * Credit a group treasury.
   * Creates a WalletTransaction and increments GroupTreasury.balance atomically.
   */
  async deposit(groupId: string, dto: DepositDto, initiatedById: string) {
    const treasury = await this.getOrCreateTreasury(groupId);

    const tx = await prisma.$transaction(
      async (t: Prisma.TransactionClient) => {
        const transaction = await t.walletTransaction.create({
          data: {
            treasuryId: treasury.id,
            amount: dto.amount,
            currency: 'KES',
            transactionType: 'CREDIT',
            description: dto.description ?? null,
            referenceType: dto.referenceType ?? 'MANUAL',
            proposalId: dto.proposalId ?? null,
            projectId: dto.projectId ?? null,
            initiatedById,
            metadata: undefined,
          },
        });

        await t.groupTreasury.update({
          where: { id: treasury.id },
          data: { balance: { increment: dto.amount } },
        });

        return transaction;
      }
    );

    logger.info(
      { groupId, amount: dto.amount, transactionId: tx.id },
      '[TREASURY] Deposit credited'
    );

    return tx;
  }

  /**
   * Debit a group treasury.
   * Throws if balance is insufficient.
   */
  async withdraw(groupId: string, dto: WithdrawDto, initiatedById: string) {
    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId },
    });
    if (!treasury) throw ApiError.notFound('Treasury not found for this group');

    if (Number(treasury.balance) < dto.amount) {
      throw ApiError.badRequest('Insufficient treasury balance');
    }

    const tx = await prisma.$transaction(
      async (t: Prisma.TransactionClient) => {
        const transaction = await t.walletTransaction.create({
          data: {
            treasuryId: treasury.id,
            amount: dto.amount,
            currency: 'KES',
            transactionType: 'DEBIT',
            description: dto.description ?? null,
            referenceType: dto.referenceType ?? 'MANUAL',
            proposalId: dto.proposalId ?? null,
            projectId: dto.projectId ?? null,
            initiatedById,
            metadata: undefined,
          },
        });

        await t.groupTreasury.update({
          where: { id: treasury.id },
          data: { balance: { decrement: dto.amount } },
        });

        return transaction;
      }
    );

    logger.info(
      { groupId, amount: dto.amount, transactionId: tx.id },
      '[TREASURY] Withdrawal debited'
    );

    return tx;
  }

  // ────────────────────────────────────────────────────────────
  // TRANSACTION HISTORY
  // ────────────────────────────────────────────────────────────

  async getTransactions(groupId: string, dto: TransactionQueryDto) {
    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId },
    });
    if (!treasury) throw ApiError.notFound('Treasury not found for this group');

    const limit = dto.limit ?? 20;
    const page = dto.page ?? 1;
    const skip = (page - 1) * limit;

    const where: Prisma.WalletTransactionWhereInput = {
      treasuryId: treasury.id,
    };

    if (dto.transactionType) where.transactionType = dto.transactionType;
    if (dto.referenceType) where.referenceType = dto.referenceType;
    if (dto.fromDate || dto.toDate) {
      where.createdAt = {};
      if (dto.fromDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dto.fromDate);
      if (dto.toDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(dto.toDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ────────────────────────────────────────────────────────────
  // DUES ALLOCATION
  // ────────────────────────────────────────────────────────────

  /**
   * Allocate a confirmed DuesPayment to the user's ward group treasury.
   *
   * Phase 1 split: 100% → user's primary ward system group.
   * Called by duesService.recordPayment() after the Prisma transaction completes.
   */
  async allocateDues(duesPaymentId: string, userId: string): Promise<void> {
    const payment = await prisma.duesPayment.findUnique({
      where: { id: duesPaymentId },
    });
    if (!payment) {
      logger.warn(
        { duesPaymentId },
        '[TREASURY] allocateDues: DuesPayment not found — skipping'
      );
      return;
    }

    // Find the user's primary ward
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { primaryWardId: true },
    });
    if (!user?.primaryWardId) {
      logger.warn(
        { userId },
        '[TREASURY] allocateDues: user has no primaryWardId — skipping'
      );
      return;
    }

    // Find the WARD system group for that ward
    const wardGroup = await prisma.group.findFirst({
      where: {
        isSystemGroup: true,
        systemType: 'WARD',
        wardId: user.primaryWardId,
      },
    });
    if (!wardGroup) {
      logger.warn(
        { wardId: user.primaryWardId },
        '[TREASURY] allocateDues: ward system group not found — skipping'
      );
      return;
    }

    const treasury = await this.getOrCreateTreasury(wardGroup.id);
    const amount = Number(payment.totalAmount);

    await prisma.$transaction(async (t: Prisma.TransactionClient) => {
      // Create the allocation record
      await t.duesAllocation.create({
        data: {
          duesPaymentId,
          groupId: wardGroup.id,
          treasuryId: treasury.id,
          amount,
          percentage: 100,
        },
      });

      // Credit the treasury
      await t.walletTransaction.create({
        data: {
          treasuryId: treasury.id,
          amount,
          currency: 'KES',
          transactionType: 'CREDIT',
          description: `Dues payment — ${payment.tier} tier (${payment.period})`,
          referenceType: 'DUES',
          initiatedById: userId,
          metadata: {
            duesPaymentId,
            tier: payment.tier,
            period: payment.period,
          },
        },
      });

      await t.groupTreasury.update({
        where: { id: treasury.id },
        data: { balance: { increment: amount } },
      });
    });

    logger.info(
      { duesPaymentId, groupId: wardGroup.id, amount },
      '[TREASURY] Dues allocated to ward group treasury'
    );
  }
}

export const treasuryService = new TreasuryService();

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
import {
  DepositDto,
  WithdrawDto,
  TransactionQueryDto,
  AllocationSplit,
} from '../types.js';

const DEFAULT_SPLIT: AllocationSplit = {
  WARD: 70,
  CONSTITUENCY: 15,
  COUNTY: 10,
  NATIONAL: 5,
};

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
  // MY-GROUPS SUMMARY
  // ────────────────────────────────────────────────────────────

  /**
   * Return treasury balance + recent credit/debit totals for all groups
   * where the user is an active member and a treasury exists.
   */
  async getMyGroupsSummary(userId: string) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, active: true },
      select: { groupId: true },
    });

    const groupIds = memberships.map((m) => m.groupId);
    if (!groupIds.length) return [];

    const treasuries = await prisma.groupTreasury.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            isSystemGroup: true,
            systemType: true,
          },
        },
      },
    });

    return treasuries.map((t) => ({
      groupId: t.groupId,
      groupName: t.group.name,
      isSystem: t.group.isSystemGroup,
      systemType: t.group.systemType,
      balance: Number(t.balance),
      tokenBalance: t.tokenBalance ?? 0,
      updatedAt: t.updatedAt,
    }));
  }

  // ────────────────────────────────────────────────────────────
  // DUES ALLOCATION
  // ────────────────────────────────────────────────────────────

  /**
   * Allocate a confirmed DuesPayment across the geographic hierarchy:
   * Ward → Constituency → County → National.
   *
   * Percentages are read from PlatformConfig key `dues_allocation_split`
   * (JSON: { WARD, CONSTITUENCY, COUNTY, NATIONAL }). Falls back to
   * DEFAULT_SPLIT (70/15/10/5) when the config key is absent.
   *
   * Levels with percentage = 0 are skipped. A non-zero level whose system
   * group is missing throws — these groups are seeded at launch and their
   * absence indicates a data integrity problem.
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

    const ward = await prisma.ward.findUnique({
      where: { id: user.primaryWardId },
      select: { id: true, constituencyId: true, countyId: true },
    });
    if (!ward) {
      logger.warn(
        { wardId: user.primaryWardId },
        '[TREASURY] allocateDues: ward record not found — skipping'
      );
      return;
    }

    const split = await this.getAllocationSplit();
    const totalAmount = Number(payment.totalAmount);

    // Resolve system groups for each geographic level in parallel
    const [wardGroup, constituencyGroup, countyGroup, nationalGroup] =
      await Promise.all([
        split.WARD > 0
          ? prisma.group.findFirst({
              where: {
                isSystemGroup: true,
                systemType: 'WARD',
                wardId: ward.id,
              },
            })
          : null,
        split.CONSTITUENCY > 0 && ward.constituencyId
          ? prisma.group.findFirst({
              where: {
                isSystemGroup: true,
                systemType: 'CONSTITUENCY',
                constituencyId: ward.constituencyId,
              },
            })
          : null,
        split.COUNTY > 0 && ward.countyId
          ? prisma.group.findFirst({
              where: {
                isSystemGroup: true,
                systemType: 'COUNTY',
                countyId: ward.countyId,
              },
            })
          : null,
        split.NATIONAL > 0
          ? prisma.group.findFirst({
              where: { isSystemGroup: true, systemType: 'NATIONAL' },
            })
          : null,
      ]);

    // Validate: every non-zero level must have a matching system group.
    // These groups are seeded at launch — absence = data integrity failure.
    const levelMap = [
      { key: 'WARD' as const, group: wardGroup, percentage: split.WARD },
      {
        key: 'CONSTITUENCY' as const,
        group: constituencyGroup,
        percentage: split.CONSTITUENCY,
      },
      { key: 'COUNTY' as const, group: countyGroup, percentage: split.COUNTY },
      {
        key: 'NATIONAL' as const,
        group: nationalGroup,
        percentage: split.NATIONAL,
      },
    ];

    for (const level of levelMap) {
      if (level.percentage > 0 && level.group === null) {
        throw ApiError.systemError(
          `[TREASURY] allocateDues: ${level.key} system group missing for ward ${ward.id} — re-run seed to fix`
        );
      }
    }

    const entries = levelMap
      .filter(
        (
          e
        ): e is {
          key: (typeof e)['key'];
          group: NonNullable<(typeof e)['group']>;
          percentage: number;
        } => e.percentage > 0 && e.group !== null
      )
      .map((e) => ({
        group: e.group,
        percentage: e.percentage,
        amount: Math.round(totalAmount * e.percentage) / 100,
      }));

    // Get or create treasuries for all target groups (outside transaction to avoid deadlocks)
    const treasuries = await Promise.all(
      entries.map((e) => this.getOrCreateTreasury(e.group.id))
    );

    await prisma.$transaction(async (t: Prisma.TransactionClient) => {
      for (let i = 0; i < entries.length; i++) {
        const { group, percentage, amount } = entries[i];
        const treasury = treasuries[i];

        await t.duesAllocation.create({
          data: {
            duesPaymentId,
            groupId: group.id,
            treasuryId: treasury.id,
            amount,
            percentage,
          },
        });

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
              splitLevel: group.systemType,
              splitPercentage: percentage,
            },
          },
        });

        await t.groupTreasury.update({
          where: { id: treasury.id },
          data: { balance: { increment: amount } },
        });
      }
    });

    logger.info(
      {
        duesPaymentId,
        userId,
        totalAmount,
        allocations: entries.map((e) => ({
          groupId: e.group.id,
          systemType: e.group.systemType,
          amount: e.amount,
          percentage: e.percentage,
        })),
      },
      '[TREASURY] Dues allocated across geographic hierarchy'
    );
  }

  // ────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ────────────────────────────────────────────────────────────

  private async getAllocationSplit(): Promise<AllocationSplit> {
    try {
      const config = await prisma.platformConfig.findUnique({
        where: { key: 'dues_allocation_split' },
      });
      if (config?.value) {
        const parsed = JSON.parse(config.value) as Partial<AllocationSplit>;
        return {
          WARD: parsed.WARD ?? DEFAULT_SPLIT.WARD,
          CONSTITUENCY: parsed.CONSTITUENCY ?? DEFAULT_SPLIT.CONSTITUENCY,
          COUNTY: parsed.COUNTY ?? DEFAULT_SPLIT.COUNTY,
          NATIONAL: parsed.NATIONAL ?? DEFAULT_SPLIT.NATIONAL,
        };
      }
    } catch {
      // fall through to defaults
    }
    return { ...DEFAULT_SPLIT };
  }
}

export const treasuryService = new TreasuryService();

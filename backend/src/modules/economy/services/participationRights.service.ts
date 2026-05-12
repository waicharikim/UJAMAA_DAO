/**
 * @file src/modules/economy/services/participationRights.service.ts
 * @description
 * Participation Rights Service — Core v2.1 Mechanic
 *
 * Manages earning, spending, balance, logs, monthly regen, commitment-based penalties
 * All operations are atomic and logged for audit
 *
 * Version: 2.1 — February 2026
 * Updated: Replaced dues penalties with commitment-based logic (dues optional), added event listeners
 */

import { PrismaClient, Prisma, ParticipationRightsLog } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import {
  ParticipationRightsReason,
  PR_CONFIG,
  CommitmentStatus,
  COMMITMENT_CONFIG,
  CommitmentType,
} from '../types.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { eventBus } from '../../../core/utils/eventBus.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { getPrContract, getUtContract, getGovernanceContract } from '../../../core/blockchain/client.js';

const {
  MAX_BALANCE,
  MONTHLY_REGEN_BASE,
  ACTIVE_USER_DAYS_THRESHOLD,
  INACTIVITY_DECAY_THRESHOLD_DAYS,
  INACTIVITY_DECAY_RATE,
  INACTIVITY_DECAY_FLOOR,
} = PR_CONFIG;

export class ParticipationRightsService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient;
  }

  /**
   * Get current PR balance from logs (sum of all transactions)
   */
  async getBalance(userId: string): Promise<number> {
    const logs = await this.prisma.participationRightsLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) return 0;

    return logs.reduce((sum, log) => sum + log.amount, 0);
  }

  /**
   * Award PR — capped at MAX_BALANCE
   */
  async award(
    userId: string,
    amount: number,
    reason: ParticipationRightsReason,
    metadata?: Record<string, any>
  ): Promise<ParticipationRightsLog> {
    if (amount <= 0) throw new Error('Award amount must be positive');

    const log = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const current = await this.getBalanceWithTx(tx, userId);
        const newBalance = Math.min(current + amount, MAX_BALANCE);

        const entry = await tx.participationRightsLog.create({
          data: {
            userId,
            amount,
            balance: newBalance,
            reason: reason,
            metadata: metadata
              ? JSON.parse(JSON.stringify(metadata))
              : undefined,
          },
        });

        // Update user field for quick access (denormalized)
        await tx.user.update({
          where: { id: userId },
          data: { participationRights: newBalance },
        });

        logger.info(
          { userId, amount, reason, newBalance, metadata },
          '[PR] Awarded Participation Rights'
        );

        return entry;
      }
    );

    await auditService.log(
      userId,
      AuditAction.PR_AWARDED,
      'participation_right',
      log.id,
      { amount, reason, newBalance: log.balance, ...(metadata && { metadata }) }
    );

    // On-chain mint — silently skipped if: test env, no wallet address, contract not configured
    if (process.env.NODE_ENV !== 'test') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });
      if (user?.walletAddress) {
        const prContract = getPrContract();
        if (prContract) {
          try {
            const amountWei = BigInt(amount) * BigInt(10 ** 18);
            await prContract.mint(user.walletAddress, amountWei);
            logger.info({ userId, amount }, '[PR] On-chain mint succeeded');
          } catch (err) {
            logger.warn(
              { userId, err },
              '[PR] On-chain mint failed — off-chain record intact'
            );
          }
        }
      }
    }

    return log;
  }

  /**
   * Spend PR — throws if insufficient
   */
  async spend(
    userId: string,
    amount: number,
    reason: ParticipationRightsReason,
    metadata?: Record<string, any>
  ): Promise<ParticipationRightsLog> {
    if (amount <= 0) throw new Error('Spend amount must be positive');

    const log = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const current = await this.getBalanceWithTx(tx, userId);

        if (current < amount) {
          throw ApiError.insufficientParticipationRights(
            'Insufficient Participation Rights',
            amount,
            current
          );
        }

        const newBalance = current - amount;

        const entry = await tx.participationRightsLog.create({
          data: {
            userId,
            amount: -amount,
            balance: newBalance,
            reason: reason,
            metadata: metadata
              ? JSON.parse(JSON.stringify(metadata))
              : undefined,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { participationRights: newBalance },
        });

        logger.info(
          { userId, amount: -amount, reason, newBalance, metadata },
          '[PR] Spent Participation Rights'
        );

        return entry;
      }
    );

    await auditService.log(
      userId,
      AuditAction.PR_SPENT,
      'participation_right',
      log.id,
      { amount, reason, newBalance: log.balance, ...(metadata && { metadata }) }
    );

    // On-chain burn — mirrors the DB deduction
    if (process.env.NODE_ENV !== 'test') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });
      if (user?.walletAddress) {
        const prContract = getPrContract();
        if (prContract) {
          try {
            const amountWei = BigInt(amount) * BigInt(10 ** 18);
            await prContract.burn(user.walletAddress, amountWei);
            logger.info({ userId, amount }, '[PR] On-chain burn succeeded');
          } catch (err) {
            logger.warn({ userId, err }, '[PR] On-chain burn failed — off-chain record intact');
          }
        }
      }
    }

    return log;
  }

  /**
   * Check if user has enough PR
   */
  async hasSufficient(userId: string, required: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= required;
  }

  // Helper for transaction
  private async getBalanceWithTx(tx: any, userId: string): Promise<number> {
    const logs = await tx.participationRightsLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return logs.reduce(
      (sum: number, log: ParticipationRightsLog) => sum + log.amount,
      0
    );
  }

  /**
   * Monthly regeneration cron — run on 1st of month
   */
  async monthlyRegeneration(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ACTIVE_USER_DAYS_THRESHOLD);

    const activeUsers = await this.prisma.user.findMany({
      where: {
        lastLoginAt: { gte: thirtyDaysAgo },
      },
      select: { id: true },
    });

    const results = await Promise.all(
      activeUsers.map((user) =>
        this.award(
          user.id,
          MONTHLY_REGEN_BASE,
          ParticipationRightsReason.MONTHLY_REGENERATION,
          {
            type: 'monthly_regen',
            activeUser: true,
          }
        ).catch(() => null)
      )
    );

    logger.info(
      { regeneratedCount: results.filter(Boolean).length },
      '[PR] Monthly regeneration completed'
    );
  }

  /**
   * Commitment penalties cron — run monthly
   * Only applies to breached commitments (opt-in only)
   */
  async applyCommitmentPenalties(): Promise<void> {
    const activeCommitments = await this.prisma.commitment.findMany({
      where: {
        status: CommitmentStatus.ACTIVE,
      },
    });

    let breachedCount = 0;

    for (const commitment of activeCommitments) {
      const isBreached = await this.isBreachedThisPeriod(commitment);

      if (isBreached) {
        commitment.missedCount += 1;

        const penaltyStep = Math.min(
          commitment.missedCount - 1,
          COMMITMENT_CONFIG.PENALTY_ON_BREACH.length - 1
        );
        const penaltyAmount = COMMITMENT_CONFIG.PENALTY_ON_BREACH[penaltyStep];

        if (penaltyAmount === 'ROLE_SUSPENSION') {
          // Future: suspend role/group membership
          logger.warn(
            { commitmentId: commitment.id },
            '[BREACH] Role suspension triggered'
          );
        } else if (typeof penaltyAmount === 'number') {
          await this.spend(
            commitment.userId,
            penaltyAmount,
            ParticipationRightsReason.DUES_PENALTY,
            { commitmentId: commitment.id, missedCount: commitment.missedCount }
          );
        }

        if (
          commitment.missedCount >= COMMITMENT_CONFIG.MAX_MISSED_BEFORE_BREACH
        ) {
          await this.prisma.commitment.update({
            where: { id: commitment.id },
            data: {
              status: CommitmentStatus.BREACHED,
              breachReason: `Missed ${commitment.missedCount} obligations`,
            },
          });

          breachedCount++;

          logger.info(
            { commitmentId: commitment.id, missed: commitment.missedCount },
            '[COMMITMENT] Breach threshold reached — status updated'
          );

          eventBus.publish('economy.commitment.breached', {
            commitmentId: commitment.id,
            userId: commitment.userId,
            missedCount: commitment.missedCount,
          });
        } else {
          await this.prisma.commitment.update({
            where: { id: commitment.id },
            data: { missedCount: commitment.missedCount },
          });
        }
      } else {
        // Reset missed count on fulfillment
        await this.prisma.commitment.update({
          where: { id: commitment.id },
          data: { missedCount: 0 },
        });
      }
    }

    logger.info(
      { breachedCount, checked: activeCommitments.length },
      '[COMMITMENT] Monthly penalties applied'
    );
  }

  /**
   * Check if commitment is breached for current period
   * Customize logic per commitment type
   */
  private async isBreachedThisPeriod(commitment: any): Promise<boolean> {
    if (commitment.type === CommitmentType.DUES) {
      const currentPeriod = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const payment = await this.prisma.duesPayment.findFirst({
        where: {
          userId: commitment.userId,
          period: currentPeriod,
          status: 'COMPLETED',
        },
      });
      return !payment;
    }

    // Add checks for other types (attendance, project deliverables)
    return false; // Placeholder - customize later
  }

  /**
   * Monthly inactivity decay — ADR-026
   *
   * For users inactive for ≥60 days: deduct 5% of current balance, capped by a 100 PR floor.
   * Runs after monthlyRegeneration so active users aren't double-counted.
   */
  async applyInactivityDecay(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVITY_DECAY_THRESHOLD_DAYS);

    // Users whose last login is before the 60-day cutoff AND have more than the floor balance
    const inactiveUsers = await this.prisma.user.findMany({
      where: {
        OR: [{ lastLoginAt: { lt: cutoff } }, { lastLoginAt: null }],
        participationRights: { gt: INACTIVITY_DECAY_FLOOR },
      },
      select: { id: true, participationRights: true },
    });

    let decayedCount = 0;

    for (const user of inactiveUsers) {
      const current = user.participationRights ?? 0;
      const decayAmount = Math.max(
        1,
        Math.floor(current * INACTIVITY_DECAY_RATE)
      );
      const newBalance = Math.max(
        INACTIVITY_DECAY_FLOOR,
        current - decayAmount
      );
      const actualDeduction = current - newBalance;

      if (actualDeduction <= 0) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { participationRights: newBalance },
        });
        await tx.participationRightsLog.create({
          data: {
            userId: user.id,
            amount: -actualDeduction,
            reason: ParticipationRightsReason.INACTIVITY_DECAY,
            balance: newBalance,
          },
        });
      });

      await auditService.log(
        user.id,
        AuditAction.PR_INACTIVITY_DECAY,
        'User',
        user.id,
        {
          deducted: actualDeduction,
          newBalance,
          daysInactive: INACTIVITY_DECAY_THRESHOLD_DAYS,
        }
      );

      decayedCount++;
    }

    logger.info(
      { decayedCount, checked: inactiveUsers.length },
      '[PR] Inactivity decay applied'
    );
  }
}

export const participationRightsService = new ParticipationRightsService();

// ============================================================================
// EVENT LISTENERS — Award PR on key events
// ============================================================================

eventBus.on('user.verification.completed', async (payload) => {
  const { userId, level } = payload;

  let amount = 0;
  switch (level) {
    case 'EMAIL_VERIFIED':
      amount = PR_CONFIG.EMAIL_VERIFIED;
      break;
    case 'PHONE_VERIFIED':
      amount = PR_CONFIG.PHONE_VERIFIED;
      break;
    case 'COMMUNITY_VERIFIED':
      amount = PR_CONFIG.COMMUNITY_VERIFIED;
      break;
    case 'FULL_VERIFIED':
      amount = PR_CONFIG.FULL_VERIFIED;
      break;
  }

  if (amount > 0) {
    await participationRightsService.award(
      userId,
      amount,
      ParticipationRightsReason[level as keyof typeof ParticipationRightsReason]
    );
  }
});

eventBus.on('governance.vote.cast', async (payload) => {
  await participationRightsService.award(
    payload.userId,
    PR_CONFIG.VOTE_CAST,
    ParticipationRightsReason.VOTED
  );
});

eventBus.on('governance.proposal.created', async (payload) => {
  await participationRightsService.award(
    payload.createdById,
    PR_CONFIG.PROPOSAL_CREATED,
    ParticipationRightsReason.PROPOSAL_CREATED
  );
});

eventBus.on('governance.milestone.verified', async (payload) => {
  if (payload.approved) {
    await participationRightsService.award(
      payload.submittedById,
      PR_CONFIG.MILESTONE_VERIFIED_BASE,
      ParticipationRightsReason.MILESTONE_VERIFIED
    );
  }
});

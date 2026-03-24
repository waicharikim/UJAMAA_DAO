/**
 * @file src/modules/economy/services/dues.service.ts
 * @description
 * Dues Service — Voluntary Monthly Payments → UT + PR
 *
 * Key:
 * - Dues are optional — no automatic penalties for non-payment
 * - Penalties only apply to explicit opt-in commitments (Commitment model)
 * - Payment → convert KES to UT (1:1) + award PR per tier
 *
 * Version: 2.2 — January 2026
 * Updated: Made penalties commitment-based only (dues optional), integrated Commitment model
 */

import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import { participationRightsService } from './participationRights.service.js';
import { treasuryService } from '../../treasury/services/treasury.service.js';
import {
  DuesTier,
  DUES_CONFIG,
  CommitmentStatus,
  COMMITMENT_CONFIG,
  CommitmentType,
  ParticipationRightsReason,
} from '../types.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';

class DuesService {
  /**
   * Record successful dues payment — award UT + PR
   */
  async recordPayment(
    userId: string,
    tier: DuesTier,
    amountKes: number,
    period: string, // "2025-12"
    mpesaReceipt?: string
  ) {
    const tierConfig = DUES_CONFIG.TIERS[tier];
    if (!tierConfig || amountKes !== tierConfig.amountKes) {
      throw ApiError.badRequest('Invalid tier or amount');
    }

    const payment = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Record payment
        const record = await tx.duesPayment.create({
          data: {
            userId,
            tier,
            totalAmount: amountKes,
            period,
            mpesaReceipt,
            paymentMethod: 'MPESA',
            status: 'COMPLETED',
            paidAt: new Date(),
          },
        });

        // Award UT (1:1 KES to UT — ADR-034: dues earn UT only, not PR)
        await tx.user.update({
          where: { id: userId },
          data: { fiatBackedUtBalance: { increment: amountKes } },
        });

        // If user has an active dues commitment, mark as fulfilled for this period
        await tx.commitment.updateMany({
          where: {
            userId,
            type: 'DUES',
            status: CommitmentStatus.ACTIVE,
          },
          data: {
            totalPaidKes: { increment: amountKes },
            // Could add period fulfillment tracking here if needed
          },
        });

        logger.info(
          { userId, tier, amountKes, period },
          '[DUES] Payment recorded — UT awarded'
        );

        return record;
      }
    );

    await auditService.log(
      userId,
      AuditAction.DUES_PAID,
      'dues_payment',
      payment.id,
      { tier, amountKes, period, mpesaReceipt }
    );

    // Allocate dues to ward group treasury (non-critical — catch any error so payment is unaffected)
    await treasuryService
      .allocateDues(payment.id, userId)
      .catch((err) =>
        logger.warn(
          { err, paymentId: payment.id },
          '[DUES] Treasury allocation failed — payment still recorded'
        )
      );

    return payment;
  }

  /**
   * Opt-in to a monthly dues commitment (voluntary)
   */
  async createDuesCommitment(
    userId: string,
    tier: DuesTier,
    startPeriod: string, // "2025-01"
    durationMonths?: number // optional end date
  ) {
    const tierConfig = DUES_CONFIG.TIERS[tier];
    if (!tierConfig) throw ApiError.badRequest('Invalid tier');

    const endDate = durationMonths
      ? new Date(new Date().setMonth(new Date().getMonth() + durationMonths))
      : null;

    const commitment = await prisma.commitment.create({
      data: {
        userId,
        type: CommitmentType.DUES,
        amountKes: tierConfig.amountKes,
        frequency: 'MONTHLY',
        startDate: new Date(),
        endDate,
        status: CommitmentStatus.ACTIVE,
      },
    });

    logger.info(
      { userId, tier, commitmentId: commitment.id },
      '[COMMITMENT] Dues commitment created'
    );

    await auditService.log(
      userId,
      AuditAction.COMMITMENT_CREATED,
      'commitment',
      commitment.id,
      {
        tier,
        amountKes: tierConfig.amountKes,
        frequency: 'MONTHLY',
        startPeriod,
        durationMonths,
      }
    );

    return commitment;
  }

  /**
   * Apply penalties for breached commitments (monthly cron)
   * Only affects users with active commitments
   */
  async applyCommitmentPenalties(currentPeriod: string) {
    const activeCommitments = await prisma.commitment.findMany({
      where: {
        status: CommitmentStatus.ACTIVE,
        type: CommitmentType.DUES, // Can expand to other types later
      },
      include: { user: true },
    });

    let breachedCount = 0;

    for (const commitment of activeCommitments) {
      const userId = commitment.userId;

      // Check recent payments
      const recentPayment = await prisma.duesPayment.findFirst({
        where: {
          userId,
          period: currentPeriod,
          status: 'COMPLETED',
        },
      });

      if (!recentPayment) {
        commitment.missedCount += 1;

        if (
          commitment.missedCount >= COMMITMENT_CONFIG.MAX_MISSED_BEFORE_BREACH
        ) {
          // Breach
          const reduction =
            COMMITMENT_CONFIG.PENALTY_ON_BREACH[commitment.missedCount - 1] ||
            100;

          if (reduction === 'ROLE_SUSPENSION') {
            // Future: suspend role/group membership
            logger.warn(
              { userId, commitmentId: commitment.id },
              '[BREACH] Role suspension triggered'
            );
          } else {
            await participationRightsService.spend(
              userId,
              reduction,
              ParticipationRightsReason.DUES_PENALTY,
              {
                commitmentId: commitment.id,
                missedCount: commitment.missedCount,
              }
            );
          }

          await prisma.commitment.update({
            where: { id: commitment.id },
            data: {
              status: CommitmentStatus.BREACHED,
              breachReason: `Missed ${commitment.missedCount} payments`,
            },
          });

          breachedCount++;
          logger.info(
            {
              userId,
              commitmentId: commitment.id,
              missed: commitment.missedCount,
            },
            '[COMMITMENT] Dues commitment breached — penalty applied'
          );
        } else {
          await prisma.commitment.update({
            where: { id: commitment.id },
            data: { missedCount: commitment.missedCount },
          });
        }
      } else {
        // Reset missed count on payment
        await prisma.commitment.update({
          where: { id: commitment.id },
          data: { missedCount: 0 },
        });
      }
    }

    logger.info(
      { breachedCount, totalChecked: activeCommitments.length },
      '[COMMITMENT] Monthly penalties applied'
    );
  }

  /**
   * Get user's active commitments and status
   */
  async getUserCommitments(userId: string) {
    const commitments = await prisma.commitment.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });

    return commitments.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      amountKes: c.amountKes,
      frequency: c.frequency,
      missedCount: c.missedCount,
      startDate: c.startDate,
      endDate: c.endDate,
    }));
  }
}

export const duesService = new DuesService();

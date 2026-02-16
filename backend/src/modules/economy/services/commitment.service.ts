/**
 * @file src/modules/economy/services/commitment.service.ts
 * @description
 * Commitment Service — Opt-in Obligations & Breach Penalties
 *
 * Handles:
 * - Creating voluntary commitments (dues, role, project, event)
 * - Tracking fulfillment (payments, attendance, etc.)
 * - Detecting breaches (missed obligations)
 * - Applying PR penalties on breach (via participationRightsService)
 * - Cron-based monthly breach checks
 *
 * Version: 1.0 — January 2026
 */

import { prisma } from "../../../core/database/client.js";
import { participationRightsService } from "./participationRights.service.js";
import {
  CommitmentType,
  CommitmentStatus,
  COMMITMENT_CONFIG,
  ParticipationRightsReason,
} from "../types.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { eventBus } from "../../../core/utils/eventBus.js";

class CommitmentService {
  /**
   * Create a new opt-in commitment
   */
  async createCommitment(
    userId: string,
    type: CommitmentType,
    amountKes?: number,
    amountPR?: number,
    frequency?: "MONTHLY" | "ONE_TIME" | "WEEKLY",
    durationMonths?: number,
    targetId?: string, // Group ID, Project ID, etc.
    description?: string
  ) {
    const endDate = durationMonths
      ? new Date(new Date().setMonth(new Date().getMonth() + durationMonths))
      : null;

    const commitment = await prisma.commitment.create({
      data: {
        userId,
        type,
        amountKes,
        amountPR,
        frequency: frequency || COMMITMENT_CONFIG.DEFAULT_FREQUENCY,
        startDate: new Date(),
        endDate,
        status: CommitmentStatus.ACTIVE,
        targetId,
        description,
      },
    });

    logger.info(
      { userId, commitmentId: commitment.id, type, amountKes, amountPR },
      "[COMMITMENT] New commitment created"
    );

    eventBus.publish("economy.commitment.created", {
      userId,
      commitmentId: commitment.id,
      type,
      amountKes,
      amountPR,
    });

    return commitment;
  }

  /**
   * Mark commitment as fulfilled for current period (e.g. payment received)
   */
  async markFulfilled(commitmentId: string, amountKes?: number, amountPR?: number) {
    const commitment = await prisma.commitment.findUnique({
      where: { id: commitmentId },
    });

    if (!commitment) throw ApiError.notFound("Commitment");
    if (commitment.status !== CommitmentStatus.ACTIVE) {
      throw ApiError.badRequest("Commitment is not active");
    }

    await prisma.commitment.update({
      where: { id: commitmentId },
      data: {
        totalPaidKes: { increment: amountKes || 0 },
        totalPaidPR: { increment: amountPR || 0 },
        missedCount: 0, // Reset on fulfillment
      },
    });

    logger.info(
      { commitmentId, amountKes, amountPR },
      "[COMMITMENT] Commitment fulfilled for period"
    );
  }

  /**
   * Cancel commitment (user/admin initiated)
   */
  async cancelCommitment(commitmentId: string, reason?: string) {
    const commitment = await prisma.commitment.update({
      where: { id: commitmentId },
      data: {
        status: CommitmentStatus.CANCELLED,
        breachReason: reason || "User cancelled",
      },
    });

    logger.info(
      { commitmentId, reason },
      "[COMMITMENT] Commitment cancelled"
    );

    eventBus.publish("economy.commitment.cancelled", {
      commitmentId,
      userId: commitment.userId,
      reason,
    });

    return commitment;
  }

  /**
   * Monthly cron: Check all active commitments for breaches
   */
  async checkForBreaches(currentPeriod: string): Promise<number> {
    const activeCommitments = await prisma.commitment.findMany({
      where: {
        status: CommitmentStatus.ACTIVE,
      },
    });

    let breachedCount = 0;

    for (const commitment of activeCommitments) {
      const isBreached = await this.isBreachedThisPeriod(commitment, currentPeriod);

      if (isBreached) {
        commitment.missedCount += 1;

        const penaltyStep = Math.min(commitment.missedCount - 1, COMMITMENT_CONFIG.PENALTY_ON_BREACH.length - 1);
        const penaltyAmount = COMMITMENT_CONFIG.PENALTY_ON_BREACH[penaltyStep];

        if (penaltyAmount === "ROLE_SUSPENSION") {
          // Future: revoke group role or access
          logger.warn({ commitmentId: commitment.id }, "[BREACH] Role suspension triggered");
        } else if (typeof penaltyAmount === "number") {
          await participationRightsService.spend(
            commitment.userId,
            penaltyAmount,
            ParticipationRightsReason.DUES_PENALTY,
            { commitmentId: commitment.id, missedCount: commitment.missedCount }
          );
        }

        if (commitment.missedCount >= COMMITMENT_CONFIG.MAX_MISSED_BEFORE_BREACH) {
          await prisma.commitment.update({
            where: { id: commitment.id },
            data: {
              status: CommitmentStatus.BREACHED,
              breachReason: `Missed ${commitment.missedCount} periods`,
            },
          });

          breachedCount++;

          logger.info(
            { commitmentId: commitment.id, missed: commitment.missedCount },
            "[COMMITMENT] Breach threshold reached — status updated"
          );

          eventBus.publish("economy.commitment.breached", {
            commitmentId: commitment.id,
            userId: commitment.userId,
            missedCount: commitment.missedCount,
          });
        } else {
          // Just increment missed count
          await prisma.commitment.update({
            where: { id: commitment.id },
            data: { missedCount: commitment.missedCount },
          });
        }
      } else {
        // Reset missed count on fulfillment
        await prisma.commitment.update({
          where: { id: commitment.id },
          data: { missedCount: 0 },
        });
      }
    }

    logger.info({ breachedCount, checked: activeCommitments.length }, "[COMMITMENT] Monthly breach check completed");

    return breachedCount;
  }

  /**
   * Check if commitment is breached for current period
   * Customize logic per commitment type
   */
  private async isBreachedThisPeriod(commitment: any, currentPeriod: string): Promise<boolean> {
    if (commitment.type === CommitmentType.DUES) {
      // Check if payment exists for current period
      const payment = await prisma.duesPayment.findFirst({
        where: {
          userId: commitment.userId,
          period: currentPeriod,
          status: "COMPLETED",
        },
      });
      return !payment;
    }

    // Add checks for other types (e.g. attendance logs, project deliverables)
    // Return false by default (no breach)
    return false;
  }

  /**
   * Get all commitments for a user (active + past)
   */
  async getUserCommitments(userId: string) {
    const commitments = await prisma.commitment.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
    });

    return commitments.map(c => ({
      id: c.id,
      type: c.type,
      status: c.status,
      amountKes: c.amountKes,
      amountPR: c.amountPR,
      frequency: c.frequency,
      missedCount: c.missedCount,
      startDate: c.startDate,
      endDate: c.endDate,
      breachReason: c.breachReason,
    }));
  }
}

export const commitmentService = new CommitmentService();
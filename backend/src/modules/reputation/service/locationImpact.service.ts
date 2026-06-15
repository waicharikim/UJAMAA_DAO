/**
 * @file src/modules/reputation/services/locationImpact.service.ts
 * @description
 * Location-Based Impact Points Service — Ward-Specific Reputation
 *
 * Version: 3.0 — March 2026
 */

import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import { ImpactPointReason, LOCATION_TIER_THRESHOLDS } from '../types.js';
import { logger } from '../../../core/logger/logger.js';

export class LocationImpactService {
  async getWardImpactPoints(userId: string, wardId: string) {
    const impact = await prisma.userLocationImpact.findUnique({
      where: { userId_wardId: { userId, wardId } },
      select: { impactPoints: true, tier: true },
    });

    return impact
      ? { ward: impact.impactPoints, tier: impact.tier }
      : { ward: 0, tier: 'NONE' };
  }

  /**
   * Get impact for primary hierarchy (ward → constituency → county)
   */
  async getPrimaryHierarchyImpact(
    userId: string,
    primaryWardId?: string | null
  ) {
    // The JWT doesn't carry primaryWardId, so callers often can't supply it —
    // resolve it from the user record when missing.
    if (!primaryWardId) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { primaryWardId: true },
      });
      primaryWardId = u?.primaryWardId ?? null;
    }
    if (!primaryWardId) return null;

    const impacts = await prisma.userLocationImpact.findMany({
      where: { userId },
      include: {
        ward: {
          select: {
            name: true,
            constituencyId: true,
            countyId: true,
            constituency: {
              select: {
                name: true,
                county: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const primary = impacts.find((i) => i.wardId === primaryWardId);

    if (!primary || !primary.ward) {
      return null;
    }

    const { constituencyId, countyId } = primary.ward;

    const constituencyPoints = impacts
      .filter((i) => i.ward.constituencyId === constituencyId)
      .reduce((sum, i) => sum + i.impactPoints, 0);

    const countyPoints = impacts
      .filter((i) => i.ward.countyId === countyId)
      .reduce((sum, i) => sum + i.impactPoints, 0);

    return {
      ward: {
        name: primary.ward.name,
        points: primary.impactPoints,
        tier: primary.tier,
      },
      constituency: {
        name: primary.ward.constituency?.name ?? 'Unknown',
        points: constituencyPoints,
      },
      county: {
        name: primary.ward.constituency?.county?.name ?? 'Unknown',
        points: countyPoints,
      },
    };
  }
  /**
   * Award IP in a specific ward (e.g., check-in, work)
   */
  async awardWardPoints(
    userId: string,
    wardId: string,
    amount: number,
    reason: ImpactPointReason,
    metadata?: Record<string, any>,
    // When awarded as a side-effect of a global IP award, the GLOBAL log already
    // records the action — skip the WARD log to avoid doubling the user's history.
    skipLog = false
  ) {
    if (amount <= 0) return;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Use composite unique key userId_wardId
      const impact = await tx.userLocationImpact.upsert({
        where: {
          userId_wardId: { userId, wardId },
        },
        update: {
          impactPoints: { increment: amount },
          lastActivity: new Date(),
        },
        create: {
          userId,
          wardId,
          impactPoints: amount,
          lastActivity: new Date(),
          type: 'LOCATION_BASED',
          tier: 'NONE',
        },
      });

      // Calculate new tier
      const newTotal = impact.impactPoints + amount;
      const newTier = this.calculateTier(newTotal);

      if (impact.tier !== newTier) {
        await tx.userLocationImpact.update({
          where: {
            userId_wardId: { userId, wardId },
          },
          data: { tier: newTier },
        });
      }

      // Log the award (skipped when this is a side-effect of a global award)
      if (!skipLog) {
        await tx.impactPointLog.create({
          data: {
            userId,
            amount,
            reason,
            scope: 'WARD',
            scopedId: wardId,
            metadata,
          },
        });
      }

      logger.info(
        { userId, wardId, amount, newTier },
        '[IP] Location Impact Points awarded'
      );

      return impact;
    });
  }

  private calculateTier(points: number): string {
    if (points >= LOCATION_TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
    if (points >= LOCATION_TIER_THRESHOLDS.GOLD) return 'GOLD';
    if (points >= LOCATION_TIER_THRESHOLDS.SILVER) return 'SILVER';
    if (points >= LOCATION_TIER_THRESHOLDS.BRONZE) return 'BRONZE';
    return 'NONE';
  }

  /**
   * Get full location impact breakdown for profile
   */
  async getUserImpactBreakdown(userId: string) {
    const impacts = await prisma.userLocationImpact.findMany({
      where: { userId },
      include: {
        ward: {
          select: {
            name: true,
            constituency: {
              select: {
                name: true,
                county: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { impactPoints: 'desc' },
    });

    return {
      breakdown: impacts.map((i) => ({
        wardId: i.wardId,
        ward: i.ward.name,
        constituency: i.ward.constituency.name,
        county: i.ward.constituency.county.name,
        points: i.impactPoints,
        tier: i.tier,
      })),
      totals: {
        locations: impacts.length,
        totalPoints: impacts.reduce((sum, i) => sum + i.impactPoints, 0),
      },
    };
  }
}

export const locationImpactService = new LocationImpactService();

/**
 * @file src/modules/reputation/services/impactPoint.service.ts
 * @description
 * Global Impact Points Service — Permanent Reputation (Voting Weight)
 *
 * Version: 3.0 — March 2026
 */

import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import { ImpactPointReason } from '../types.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { locationImpactService } from './locationImpact.service.js';

export class GlobalImpactPointService {
  async award(
    userId: string,
    amount: number,
    reason: ImpactPointReason,
    metadata?: Record<string, any>
  ) {
    if (amount <= 0) return;

    const log = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const entry = await tx.impactPointLog.create({
          data: {
            userId,
            amount,
            reason,
            scope: 'GLOBAL',
            metadata,
          },
        });

        const user = await tx.user.update({
          where: { id: userId },
          data: { globalImpactPoints: { increment: amount } },
          select: { primaryWardId: true },
        });

        // Attribute the same points to the user's home ward — in the SAME
        // transaction — so ward/constituency/county reputation
        // (getPrimaryHierarchyImpact) and geo leaderboards populate. skipLog
        // avoids doubling the IP history (the GLOBAL log above records it).
        if (user.primaryWardId) {
          await locationImpactService.awardWardPoints(
            userId,
            user.primaryWardId,
            amount,
            reason,
            metadata,
            true,
            tx
          );
        }

        logger.info(
          { userId, amount, reason },
          '[IP] Global Impact Points awarded'
        );

        return entry;
      }
    );

    await auditService
      .log(userId, AuditAction.IP_AWARDED, 'User', userId, {
        amount,
        reason,
        ...metadata,
      })
      .catch(() => {
        /* non-critical */
      });

    return log;
  }

  async getTotal(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalImpactPoints: true },
    });
    return user?.globalImpactPoints || 0;
  }

  async getHistory(userId: string, limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.impactPointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.impactPointLog.count({ where: { userId } }),
    ]);
    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const globalImpactPointService = new GlobalImpactPointService();

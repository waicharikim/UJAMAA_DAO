// @ts-nocheck — scaffold: ImpactPointLog model alignment in progress
/**
 * @file src/modules/reputation/services/impactPoint.service.ts
 * @description
 * Global Impact Points Service — Permanent Reputation (Voting Weight)
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from "../../../core/database/client.js";
import { Prisma } from "@prisma/client";
import { ImpactPointReason } from "../types.js";
import { logger } from "../../../core/logger/logger.js";

class GlobalImpactPointService {
  async award(
    userId: string,
    amount: number,
    reason: ImpactPointReason,
    metadata?: Record<string, any>
  ) {
    if (amount <= 0) return;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const log = await tx.impactPointLog.create({
        data: {
          userId,
          amount,
          reason,
          scope: "GLOBAL",
          metadata,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { globalImpactPoints: { increment: amount } },
      });

      logger.info({ userId, amount, reason }, "[IP] Global Impact Points awarded");

      return log;
    });
  }

  async getTotal(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalImpactPoints: true },
    });
    return user?.globalImpactPoints || 0;
  }
}

export const globalImpactPointService = new GlobalImpactPointService();
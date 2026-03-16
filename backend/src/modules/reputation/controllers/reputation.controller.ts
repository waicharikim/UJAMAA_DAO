/**
 * @file src/modules/reputation/controllers/reputation.controller.ts
 * @description Reputation Controller — IP totals, history, location breakdown
 * Version: 1.0 — March 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { globalImpactPointService } from '../service/impactPoint.service.js';
import { locationImpactService } from '../service/locationImpact.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { prisma } from '../../../core/database/client.js';

export class ReputationController {
  /**
   * GET /reputation/me — authenticated user's full reputation profile
   */
  static async getMyReputation(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const [total, breakdown] = await Promise.all([
      globalImpactPointService.getTotal(userId),
      locationImpactService.getUserImpactBreakdown(userId),
    ]);
    sendSuccess(
      res,
      { globalImpactPoints: total, ...breakdown },
      'Reputation profile'
    );
  }

  /**
   * GET /reputation/me/history — authenticated user's IP award history
   */
  static async getMyHistory(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const limit = parseInt(String(req.query.limit || 20), 10);
    const page = parseInt(String(req.query.page || 1), 10);
    const result = await globalImpactPointService.getHistory(
      userId,
      limit,
      page
    );
    sendSuccess(res, result, 'Impact point history');
  }

  /**
   * GET /reputation/:userId — public view of any user's reputation
   */
  static async getUserReputation(req: AuthRequest, res: Response) {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, globalImpactPoints: true },
    });

    if (!user) throw ApiError.notFound('User');

    const breakdown =
      await locationImpactService.getUserImpactBreakdown(userId);
    sendSuccess(
      res,
      {
        userId: user.id,
        name: user.name,
        globalImpactPoints: user.globalImpactPoints,
        ...breakdown,
      },
      'User reputation'
    );
  }
}

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
    const primaryWardId = req.user?.primaryWardId;
    const [total, breakdown, hierarchy] = await Promise.all([
      globalImpactPointService.getTotal(userId),
      locationImpactService.getUserImpactBreakdown(userId),
      // Pass the JWT's primaryWardId when present; the service resolves it from
      // the user record otherwise (the token doesn't always carry it).
      locationImpactService.getPrimaryHierarchyImpact(userId, primaryWardId),
    ]);
    sendSuccess(
      res,
      { globalImpactPoints: total, ...breakdown, hierarchy },
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
   * GET /reputation/leaderboard — top users by PR, IP, or combined score
   * Query params: metric (pr|ip|combined), scope (global|county|ward), scopeId, page, limit
   */
  static async getLeaderboard(req: AuthRequest, res: Response) {
    const metric = (req.query.metric as string) || 'combined';
    const scope = (req.query.scope as string) || 'global';
    const scopeId = req.query.scopeId as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || 50), 10))
    );
    const skip = (page - 1) * limit;

    // Build location filter. A ward/constituency/county leaderboard defaults to
    // the *viewer's* own area when no explicit scopeId is supplied (the UI
    // doesn't send one) — otherwise these tabs silently fell back to a global
    // ranking. The viewer's constituency/county are resolved from their ward,
    // since the JWT only carries primaryWardId.
    const locationFilter: any = {};
    if (scope === 'ward') {
      const wardId = scopeId ?? req.user?.primaryWardId;
      if (wardId) locationFilter.primaryWardId = wardId;
    } else if (scope === 'constituency') {
      let constituencyId = scopeId;
      if (!constituencyId && req.user?.primaryWardId) {
        const ward = await prisma.ward.findUnique({
          where: { id: req.user?.primaryWardId },
          select: { constituencyId: true },
        });
        constituencyId = ward?.constituencyId;
      }
      if (constituencyId) locationFilter.primaryWard = { constituencyId };
    } else if (scope === 'county') {
      let countyId = scopeId;
      if (!countyId && req.user?.primaryWardId) {
        const ward = await prisma.ward.findUnique({
          where: { id: req.user?.primaryWardId },
          select: { countyId: true },
        });
        countyId = ward?.countyId;
      }
      if (countyId) locationFilter.primaryWard = { countyId };
    }

    // Determine orderBy
    let orderBy: any;
    if (metric === 'pr') {
      orderBy = { participationRights: 'desc' };
    } else if (metric === 'ip') {
      orderBy = { globalImpactPoints: 'desc' };
    } else {
      // combined: sort by IP primarily (more stable metric)
      orderBy = [
        { globalImpactPoints: 'desc' },
        { participationRights: 'desc' },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          ...locationFilter,
          status: 'ACTIVE',
          communityVerified: true,
        },
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          participationRights: true,
          globalImpactPoints: true,
          primaryWard: {
            select: {
              id: true,
              name: true,
              county: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          ...locationFilter,
          status: 'ACTIVE',
          communityVerified: true,
        },
      }),
    ]);

    const entries = users.map((u, index) => ({
      rank: skip + index + 1,
      userId: u.id,
      name: u.name ?? 'Anonymous',
      avatarUrl: u.avatarUrl,
      participationRights: u.participationRights,
      globalImpactPoints: u.globalImpactPoints,
      combinedScore:
        u.globalImpactPoints + Math.floor(u.participationRights / 10),
      ward: u.primaryWard
        ? { id: u.primaryWard.id, name: u.primaryWard.name }
        : null,
      county: u.primaryWard?.county
        ? { id: u.primaryWard.county.id, name: u.primaryWard.county.name }
        : null,
    }));

    sendSuccess(
      res,
      { entries, total, page, limit, metric, scope },
      'Leaderboard retrieved'
    );
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

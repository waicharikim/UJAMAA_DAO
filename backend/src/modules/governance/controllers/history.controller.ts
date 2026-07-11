/**
 * @file src/modules/governance/controllers/history.controller.ts
 * @description
 * Community curation of the local timeline ("Our Story"). Members PROPOSE local
 * events (pending); a keeper (group leader / location admin / super admin) RATIFIES
 * them (confirm / dispute / reject). Confirmed entries feed Mhenga's group arc.
 */

import type { Response } from 'express';
import type { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { historianService } from '../historian/historian.service.js';
import { SystemRoles } from '../../../core/rbac/roles.js';

async function isActiveMember(
  userId: string,
  groupId: string
): Promise<boolean> {
  const m = await prisma.groupMember.findFirst({
    where: { groupId, userId, active: true },
    select: { id: true },
  });
  return !!m;
}

async function canRatify(
  userId: string,
  groupId: string,
  roles: string[]
): Promise<boolean> {
  if (roles.includes(SystemRoles.SUPER_ADMIN)) return true;
  if (roles.some((r) => r.startsWith('location:') && r.endsWith('_admin'))) {
    return true;
  }
  const leader = await prisma.groupMember.findFirst({
    where: { groupId, userId, active: true, role: 'LEADER' },
    select: { id: true },
  });
  return !!leader;
}

export class HistoryController {
  /** A community member proposes a local timeline entry (pending ratification). */
  static async propose(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { groupId, title, summary, era, startYear, themes } = req.body as {
      groupId: string;
      title: string;
      summary: string;
      era?: string;
      startYear?: number;
      themes?: string[];
    };
    if (!(await isActiveMember(userId, groupId))) {
      throw ApiError.forbidden(
        'You must be a member of this community to add to its story'
      );
    }
    const event = await historianService.proposeLocalEvent(groupId, {
      title,
      summary,
      era: era ?? 'Recent',
      startYear,
      themes,
    });
    sendSuccess(
      res,
      { id: event.id },
      'Added to the review queue — pending confirmation'
    );
  }

  /** This community's timeline (confirmed + pending + disputed). */
  static async list(req: AuthRequest, res: Response) {
    const events = await historianService.listGroupHistory(req.params.groupId);
    sendSuccess(res, events, "Community's story");
  }

  /** A keeper confirms / disputes / rejects a proposed entry. */
  static async ratify(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const roles = req.user!.roles ?? [];
    const { eventId } = req.params;
    const { action } = req.body as { action: 'confirm' | 'dispute' | 'reject' };
    const ev = await prisma.historicalEvent.findUnique({
      where: { id: eventId },
      select: { groupId: true },
    });
    if (!ev?.groupId) throw ApiError.notFound('Community history entry');
    if (!(await canRatify(userId, ev.groupId, roles))) {
      throw ApiError.forbidden(
        'Only a community leader or admin can review the story'
      );
    }
    const updated = await historianService.ratifyEvent(eventId, action);
    sendSuccess(res, updated, 'Reviewed');
  }
}

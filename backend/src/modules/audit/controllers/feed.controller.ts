/**
 * @file src/modules/audit/controllers/feed.controller.ts
 * @description
 * Public activity feed — surfaces safe, human-readable platform events to
 * authenticated members. Built on top of audit_logs without exposing sensitive
 * financial, security, or identity data.
 */

import { Response } from 'express';
import { prisma } from '../../../core/database/client.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { AuditAction } from '../types.js';

// ─── Event types safe to surface in the public feed ──────────────────────────

const FEED_ACTIONS = [
  AuditAction.PROPOSAL_CREATED,
  AuditAction.PROPOSAL_STATUS_CHANGED,
  AuditAction.PROPOSAL_VOTE_CAST,
  AuditAction.GROUP_CREATED,
  AuditAction.GROUP_JOINED,
  AuditAction.PROJECT_CREATED,
  AuditAction.MILESTONE_SUBMITTED,
  AuditAction.MILESTONE_VERIFIED,
  AuditAction.EMERGENCY_REPORTED,
  AuditAction.LISTING_CREATED,
  AuditAction.MODULE_PUBLISHED,
] as const;

type FeedCategory =
  | 'governance'
  | 'community'
  | 'project'
  | 'emergency'
  | 'marketplace'
  | 'education';

interface FeedItem {
  id: string;
  category: FeedCategory;
  description: string;
  timestamp: string;
  entityId?: string;
  meta: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstLastInitial(user: { name: string | null } | null): string {
  if (!user?.name) return 'A member';
  const parts = user.name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function humanStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending Review',
    APPROVED_FOR_VOTING: 'Open for Voting',
    VOTING: 'Active Voting',
    PASSED: 'Passed',
    REJECTED: 'Rejected',
  };
  return map[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

function getCategory(action: string): FeedCategory {
  if (action.startsWith('PROPOSAL')) return 'governance';
  if (action.startsWith('GROUP')) return 'community';
  if (action === AuditAction.EMERGENCY_REPORTED) return 'emergency';
  if (action.startsWith('LISTING')) return 'marketplace';
  if (action === AuditAction.MODULE_PUBLISHED) return 'education';
  return 'project';
}

function buildDescription(
  action: AuditAction,
  user: { name: string | null } | null,
  meta: Record<string, unknown>
): string {
  const actor = firstLastInitial(user);
  switch (action) {
    case AuditAction.PROPOSAL_CREATED:
      return `${actor} submitted a proposal: "${String(meta.title ?? 'Untitled')}"`;
    case AuditAction.PROPOSAL_STATUS_CHANGED:
      return `A proposal moved to ${humanStatus(String(meta.newStatus ?? ''))}`;
    case AuditAction.PROPOSAL_VOTE_CAST:
      // Never reveal who voted
      return 'A member voted on a proposal';
    case AuditAction.GROUP_CREATED:
      return `${actor} created a new group: "${String(meta.name ?? 'New Group')}"`;
    case AuditAction.GROUP_JOINED:
      return `${actor} joined a community group`;
    case AuditAction.PROJECT_CREATED:
      return `${actor} started a new project`;
    case AuditAction.MILESTONE_SUBMITTED:
      return `${actor} submitted a project milestone for review`;
    case AuditAction.MILESTONE_VERIFIED:
      return `A project milestone was ${meta.approved ? 'approved' : 'rejected'}`;
    case AuditAction.EMERGENCY_REPORTED:
      // Never reveal reporter identity
      return 'An emergency was reported in this ward';
    case AuditAction.LISTING_CREATED:
      return `${actor} added a new listing to the marketplace`;
    case AuditAction.MODULE_PUBLISHED:
      return `New learning material available: "${String(meta.title ?? 'Untitled')}"`;
    default:
      return (action as string).replace(/_/g, ' ').toLowerCase();
  }
}

function buildSafeMeta(
  action: AuditAction,
  raw: Record<string, unknown>
): Record<string, unknown> {
  switch (action) {
    case AuditAction.PROPOSAL_CREATED:
      return { title: raw.title, scope: raw.scope };
    case AuditAction.PROPOSAL_STATUS_CHANGED:
      return { newStatus: raw.newStatus, stage: raw.stage };
    case AuditAction.PROPOSAL_VOTE_CAST:
      return {}; // never expose option or weight
    case AuditAction.GROUP_CREATED:
      return { name: raw.name, type: raw.type };
    case AuditAction.GROUP_JOINED:
      return {};
    case AuditAction.PROJECT_CREATED:
      return { proposalId: raw.proposalId };
    case AuditAction.MILESTONE_SUBMITTED:
      return {};
    case AuditAction.MILESTONE_VERIFIED:
      return { approved: raw.approved, projectId: raw.projectId };
    case AuditAction.EMERGENCY_REPORTED:
      return { type: raw.type }; // wardId intentionally excluded
    case AuditAction.LISTING_CREATED:
      return { type: raw.type, title: raw.title };
    case AuditAction.MODULE_PUBLISHED:
      return { title: raw.title };
    default:
      return {};
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class FeedController {
  static async getFeed(req: AuthRequest, res: Response) {
    const limit = Math.min(Number(req.query.limit) || 20, 30);
    const cursor = req.query.cursor as string | undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        action: { in: FEED_ACTIONS as unknown as string[] },
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const hasMore = logs.length > limit;
    const page = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore
      ? page[page.length - 1].createdAt.toISOString()
      : null;

    const items: FeedItem[] = page.map((log) => {
      const raw = (log.metadata ?? {}) as Record<string, unknown>;
      const action = log.action as AuditAction;
      return {
        id: log.id,
        category: getCategory(action),
        description: buildDescription(action, log.user, raw),
        timestamp: log.createdAt.toISOString(),
        ...(log.entityId ? { entityId: log.entityId } : {}),
        meta: buildSafeMeta(action, raw),
      };
    });

    sendSuccess(res, { items, nextCursor }, 'Feed fetched');
  }
}

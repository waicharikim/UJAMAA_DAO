/**
 * @file src/modules/audit/controllers/feed.controller.ts
 * @description
 * Personalised activity feed — surfaces safe, human-readable platform events
 * to authenticated members based on their groups, geographic area, and own
 * activity.
 *
 * Geographic scoping (cascades outward):
 *   own groups            — proposals, projects, milestones, group-joins
 *   constituency-wide     — nearby projects/proposals, emergencies, new groups
 *                           (people travel and projects span ward boundaries)
 *   platform-wide         — COMMUNITY-scope proposals, education, marketplace
 */

import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { AuditAction } from '../types.js';

// ─── Feed event whitelist ─────────────────────────────────────────────────────

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
      return meta.title
        ? `"${String(meta.title)}" moved to ${humanStatus(String(meta.newStatus ?? ''))}`
        : `A proposal moved to ${humanStatus(String(meta.newStatus ?? ''))}`;
    case AuditAction.PROPOSAL_VOTE_CAST:
      return 'A member voted on a proposal';
    case AuditAction.GROUP_CREATED:
      return `${actor} created a new group: "${String(meta.name ?? 'New Group')}"`;
    case AuditAction.GROUP_JOINED:
      return meta.groupName
        ? `${actor} joined "${String(meta.groupName)}"`
        : `${actor} joined a community group`;
    case AuditAction.PROJECT_CREATED:
      return meta.title
        ? `${actor} started a new project: "${String(meta.title)}"`
        : `${actor} started a new project`;
    case AuditAction.MILESTONE_SUBMITTED:
      return meta.milestoneName
        ? `${actor} submitted "${String(meta.milestoneName)}" for review`
        : `${actor} submitted a project milestone for review`;
    case AuditAction.MILESTONE_VERIFIED:
      return meta.milestoneName
        ? `"${String(meta.milestoneName)}" was ${meta.approved ? 'approved' : 'rejected'}`
        : `A project milestone was ${meta.approved ? 'approved' : 'rejected'}`;
    case AuditAction.EMERGENCY_REPORTED:
      return 'An emergency was reported in this area';
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
      return { newStatus: raw.newStatus, stage: raw.stage, title: raw.title };
    case AuditAction.PROPOSAL_VOTE_CAST:
      return {};
    case AuditAction.GROUP_CREATED:
      return { name: raw.name, type: raw.type };
    case AuditAction.GROUP_JOINED:
      return { groupName: raw.groupName };
    case AuditAction.PROJECT_CREATED:
      return { proposalId: raw.proposalId, title: raw.title };
    case AuditAction.MILESTONE_SUBMITTED:
      return {
        projectId: raw.projectId,
        milestoneName: raw.milestoneName,
        projectTitle: raw.projectTitle,
      };
    case AuditAction.MILESTONE_VERIFIED:
      return {
        approved: raw.approved,
        projectId: raw.projectId,
        milestoneName: raw.milestoneName,
        projectTitle: raw.projectTitle,
      };
    case AuditAction.EMERGENCY_REPORTED:
      return { type: raw.type };
    case AuditAction.LISTING_CREATED:
      return { type: raw.type, title: raw.title };
    case AuditAction.MODULE_PUBLISHED:
      return { title: raw.title };
    default:
      return {};
  }
}

// ─── Personalisation ──────────────────────────────────────────────────────────

function buildPersonalisedOr(opts: {
  userId: string;
  groupIds: string[]; // groups user is a member of
  allProposalIds: string[]; // own groups + COMMUNITY scope + constituency groups
  allProjectIds: string[]; // own groups + constituency-based groups
  milestoneIds: string[]; // milestones for allProjectIds
  nearbyGroupIds: string[]; // groups based in user's constituency
  nearbyEmergencyIds: string[]; // emergencies reported in user's constituency
}): Prisma.AuditLogWhereInput {
  const {
    userId,
    groupIds,
    allProposalIds,
    allProjectIds,
    milestoneIds,
    nearbyGroupIds,
    nearbyEmergencyIds,
  } = opts;

  const conditions: Prisma.AuditLogWhereInput[] = [
    // Own actions always appear
    { userId },

    // Platform-wide
    { action: AuditAction.MODULE_PUBLISHED },
    { action: AuditAction.LISTING_CREATED },
  ];

  // Group joins — only for groups the user belongs to (social signal)
  if (groupIds.length > 0) {
    conditions.push({
      action: AuditAction.GROUP_JOINED,
      entityId: { in: groupIds },
    });
  }

  // New groups in user's constituency (discovery — people join cross-ward)
  if (nearbyGroupIds.length > 0) {
    conditions.push({
      action: AuditAction.GROUP_CREATED,
      entityId: { in: nearbyGroupIds },
    });
  }

  // Governance — own groups + COMMUNITY scope + constituency groups
  if (allProposalIds.length > 0) {
    conditions.push({
      action: {
        in: [
          AuditAction.PROPOSAL_CREATED,
          AuditAction.PROPOSAL_STATUS_CHANGED,
          AuditAction.PROPOSAL_VOTE_CAST,
        ] as string[],
      },
      entityId: { in: allProposalIds },
    });
  }

  // Projects — own groups + constituency groups
  if (allProjectIds.length > 0) {
    conditions.push({
      action: AuditAction.PROJECT_CREATED,
      entityId: { in: allProjectIds },
    });
  }

  // Milestones for those projects
  if (milestoneIds.length > 0) {
    conditions.push({
      action: {
        in: [
          AuditAction.MILESTONE_SUBMITTED,
          AuditAction.MILESTONE_VERIFIED,
        ] as string[],
      },
      entityId: { in: milestoneIds },
    });
  }

  // Emergencies — constituency-wide (people travel, floods/fires cross ward lines)
  if (nearbyEmergencyIds.length > 0) {
    conditions.push({
      action: AuditAction.EMERGENCY_REPORTED,
      entityId: { in: nearbyEmergencyIds },
    });
  }

  return { OR: conditions };
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class FeedController {
  static async getFeed(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const limit = Math.min(Number(req.query.limit) || 20, 30);
    const cursor = req.query.cursor as string | undefined;

    // ── 1. User context: memberships + primary ward ────────────────────────
    const [memberships, userRow] = await Promise.all([
      prisma.groupMember.findMany({
        where: { userId, active: true },
        select: { groupId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          primaryWardId: true,
          primaryWard: { select: { constituencyId: true, countyId: true } },
        },
      }),
    ]);

    const groupIds = memberships.map((m) => m.groupId);
    const primaryWardId = userRow?.primaryWardId ?? null;
    const constituencyId = userRow?.primaryWard?.constituencyId ?? null;

    // ── 2. Geographic expansion — all wards in user's constituency ─────────
    // Used for emergencies and group discovery (people travel, projects span wards)
    const nearbyWardIds: string[] = primaryWardId ? [primaryWardId] : [];
    if (constituencyId) {
      const constituencyWards = await prisma.ward.findMany({
        where: { constituencyId },
        select: { id: true },
      });
      for (const w of constituencyWards) {
        if (!nearbyWardIds.includes(w.id)) nearbyWardIds.push(w.id);
      }
    }

    // ── 3. Pre-fetch proposal IDs ──────────────────────────────────────────
    // Three sources: user's own groups, COMMUNITY scope, groups in constituency
    const [
      memberGroupProposals,
      communityProposals,
      constituencyGroupProposals,
    ] = await Promise.all([
      groupIds.length > 0
        ? prisma.proposal.findMany({
            where: { groupId: { in: groupIds } },
            select: { id: true },
            take: 200,
          })
        : ([] as { id: string }[]),
      prisma.proposal.findMany({
        where: { proposalScope: 'COMMUNITY' },
        select: { id: true },
        take: 200,
      }),
      // Proposals from groups based in user's constituency (even non-member groups)
      nearbyWardIds.length > 0
        ? prisma.proposal.findMany({
            where: { group: { wardId: { in: nearbyWardIds } } },
            select: { id: true },
            take: 200,
          })
        : ([] as { id: string }[]),
    ]);

    const allProposalIds = [
      ...new Set([
        ...memberGroupProposals.map((p) => p.id),
        ...communityProposals.map((p) => p.id),
        ...constituencyGroupProposals.map((p) => p.id),
      ]),
    ];
    const memberProposalIds = memberGroupProposals.map((p) => p.id);

    // ── 4. Pre-fetch project IDs ───────────────────────────────────────────
    // Own-group projects + constituency-based projects
    const [memberProjects, constituencyProjects] = await Promise.all([
      groupIds.length > 0
        ? prisma.project.findMany({
            where: { proposal: { groupId: { in: groupIds } } },
            select: { id: true },
            take: 200,
          })
        : ([] as { id: string }[]),
      nearbyWardIds.length > 0
        ? prisma.project.findMany({
            where: { proposal: { group: { wardId: { in: nearbyWardIds } } } },
            select: { id: true },
            take: 200,
          })
        : ([] as { id: string }[]),
    ]);

    const allProjectIds = [
      ...new Set([
        ...memberProjects.map((p) => p.id),
        ...constituencyProjects.map((p) => p.id),
      ]),
    ];
    const memberProjectIds = memberProjects.map((p) => p.id);

    // ── 5. Pre-fetch milestone IDs, nearby groups, nearby emergencies ─────
    const [milestoneRows, nearbyGroupRows, nearbyEmergencyRows] =
      await Promise.all([
        allProjectIds.length > 0
          ? prisma.milestone.findMany({
              where: { projectId: { in: allProjectIds } },
              select: { id: true },
              take: 500,
            })
          : ([] as { id: string }[]),
        // Groups based in user's constituency (for GROUP_CREATED discovery)
        nearbyWardIds.length > 0
          ? prisma.group.findMany({
              where: { wardId: { in: nearbyWardIds } },
              select: { id: true },
              take: 200,
            })
          : ([] as { id: string }[]),
        // Emergencies reported in user's constituency (location field = wardId)
        nearbyWardIds.length > 0
          ? prisma.emergencyAlert.findMany({
              where: { location: { in: nearbyWardIds } },
              select: { id: true },
              take: 200,
            })
          : ([] as { id: string }[]),
      ]);

    const milestoneIds = milestoneRows.map((m) => m.id);
    const nearbyGroupIds = nearbyGroupRows.map((g) => g.id);
    const nearbyEmergencyIds = nearbyEmergencyRows.map((e) => e.id);

    // ── 6. Build personalised filter + query ──────────────────────────────
    const personalisedFilter = buildPersonalisedOr({
      userId,
      groupIds,
      allProposalIds,
      allProjectIds,
      milestoneIds,
      nearbyGroupIds,
      nearbyEmergencyIds,
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        AND: [
          { action: { in: FEED_ACTIONS as unknown as string[] } },
          personalisedFilter,
          ...(cursor ? [{ createdAt: { lt: new Date(cursor) } }] : []),
        ],
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

/**
 * @file src/modules/governance/baraza/agents/tools.ts
 * @description
 * Read-only DB tools the deliberation agents can call on demand to ground their
 * arguments in this group's REAL data — ward stats, treasury, past decisions,
 * elections — rather than relying on the model's generic knowledge.
 *
 * All tools are scoped to a single groupId (bound per deliberation). Every tool
 * returns a JSON string and never throws — failures return a short message so
 * the agent can proceed.
 */

import OpenAI from 'openai';
import { prisma } from '../../../../core/database/client.js';
import { logger } from '../../../../core/logger/logger.js';

/** OpenAI tool definitions offered to the deliberation agents. */
export const DELIBERATION_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  [
    {
      type: 'function',
      function: {
        name: 'get_ward_stats',
        description:
          "This group's real community stats: active members, recent baraza participation (last 30 days), and total Participation Rights held by members.",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_group_treasury',
        description:
          "This group's real treasury: KES balance and utility-token balance. Use to check whether a proposed budget is realistic against funds on hand.",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_past_decisions',
        description:
          "Search this group's past proposals/decisions (and community opinions) by keyword. Use to check precedent: has something like this been tried, and what happened?",
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Keyword or phrase to search past decisions.',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_election_results',
        description:
          "This group's active elections and most recent completed election with winner. Use to understand the current leadership/power context.",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
  ];

/** Dispatch a deliberation tool call, scoped to the deliberation's group. */
export async function executeDeliberationTool(
  name: string,
  args: Record<string, unknown>,
  groupId: string
): Promise<string> {
  try {
    switch (name) {
      case 'get_ward_stats':
        return await toolWardStats(groupId);
      case 'get_group_treasury':
        return await toolTreasury(groupId);
      case 'search_past_decisions':
        return await toolPastDecisions(groupId, (args.query as string) ?? '');
      case 'get_election_results':
        return await toolElections(groupId);
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    logger.warn({ err, tool: name, groupId }, '[BARAZA_TOOLS] Tool failed');
    return `Could not retrieve data for ${name}.`;
  }
}

async function toolWardStats(groupId: string): Promise<string> {
  const [memberCount, recentActive, totalPR] = await Promise.all([
    prisma.groupMember.count({ where: { groupId, active: true } }),
    prisma.barazaAttendance.count({
      where: {
        barazaGroup: { groupId },
        sessionDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        },
      },
    }),
    prisma.user.aggregate({
      where: { groupMemberships: { some: { groupId, active: true } } },
      _sum: { participationRights: true },
    }),
  ]);

  return JSON.stringify({
    activeMembers: memberCount,
    participantsLast30Days: recentActive,
    totalPRHeld: totalPR._sum.participationRights ?? 0,
  });
}

async function toolTreasury(groupId: string): Promise<string> {
  const treasury = await prisma.groupTreasury.findUnique({
    where: { groupId },
    select: { balance: true, tokenBalance: true, updatedAt: true },
  });
  if (!treasury) return 'No treasury on record for this group.';

  return JSON.stringify({
    kesBalance: Number(treasury.balance),
    utBalance: treasury.tokenBalance ?? 0,
    lastUpdated: treasury.updatedAt?.toISOString().slice(0, 10) ?? null,
  });
}

async function toolPastDecisions(
  groupId: string,
  query: string
): Promise<string> {
  if (!query.trim()) return 'Please provide a search term.';

  const [proposals, opinions] = await Promise.all([
    prisma.proposal.findMany({
      where: {
        groupId,
        status: {
          in: ['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'] as any,
        },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, status: true, outcome: true, createdAt: true },
    }),
    prisma.proposalAnnotation.findMany({
      where: {
        proposal: { groupId },
        OR: [
          { quotedText: { contains: query, mode: 'insensitive' } },
          { comment: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        comment: true,
        fieldKey: true,
        proposal: { select: { title: true } },
      },
    }),
  ]);

  if (!proposals.length && !opinions.length) {
    return `No past decisions or opinions matching "${query}".`;
  }

  return JSON.stringify({
    decisions: proposals.map((p) => ({
      title: p.title,
      outcome: p.outcome ?? p.status,
      status: p.status,
      date: p.createdAt.toISOString().slice(0, 10),
    })),
    opinions: opinions.map((o) => ({
      proposal: o.proposal.title,
      on: o.fieldKey,
      opinion: o.comment,
    })),
  });
}

async function toolElections(groupId: string): Promise<string> {
  const [active, recent] = await Promise.all([
    prisma.election.findMany({
      where: { groupId, status: { in: ['NOMINATIONS_OPEN', 'VOTING_OPEN'] } },
      select: { roleKey: true, status: true },
      take: 5,
    }),
    prisma.election.findFirst({
      where: { groupId, status: 'CLOSED' },
      orderBy: { votingCloseAt: 'desc' },
      select: {
        roleKey: true,
        votingCloseAt: true,
        candidates: {
          orderBy: { voteCount: 'desc' },
          take: 1,
          select: { voteCount: true, user: { select: { name: true } } },
        },
      },
    }),
  ]);

  const result: Record<string, unknown> = {
    activeElections: active.map((e) => ({ role: e.roleKey, status: e.status })),
  };
  if (recent) {
    const winner = recent.candidates[0];
    result.lastElection = {
      role: recent.roleKey,
      closedOn: recent.votingCloseAt.toISOString().slice(0, 10),
      winner: winner?.user?.name ?? null,
    };
  }
  return JSON.stringify(result);
}

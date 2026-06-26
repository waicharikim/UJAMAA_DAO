/**
 * @file src/modules/integration/services/baraza-ai.service.ts
 * @description
 * Baraza AI — Qwen Cloud-powered conversational layer for the Telegram bot.
 *
 * Uses Qwen Cloud via the OpenAI-compatible DashScope endpoint.
 * No Anthropic dependency — requires only the `openai` npm package.
 *
 * Routing rule: slash commands (/present, /verify, etc.) stay deterministic.
 * Any free-text message in a registered baraza goes through this service.
 *
 * Graceful degradation: if DASHSCOPE_API_KEY is not set, returns a fallback message.
 * Tools: get_user_stats, get_group_proposals, get_group_treasury,
 *        get_election_results, get_ward_stats, search_past_decisions.
 * Model: configurable via BARAZA_AI_MODEL (default: qwen-plus).
 */

import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';

// qwen-plus: best balance of speed + capability for conversational use
// qwen-max: use for deeper reasoning if latency allows
// qwen-turbo: cheapest, fastest — good for high-volume low-stakes queries
const MODEL = process.env.BARAZA_AI_MODEL ?? 'qwen-plus';
const MAX_TOOL_ROUNDS = 3;
const MAX_TOKENS = 1024;

// Qwen Cloud international DashScope endpoint (OpenAI-compatible)
const DASHSCOPE_BASE_URL =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

const SYSTEM_PROMPT = `You are BarazaBot, the AI assistant for UjamaaDAO — a community self-governance platform built for East African communities. You live inside Telegram groups called barazas (community meetings).

## What UjamaaDAO is
UjamaaDAO helps communities self-govern through:
- **Participation Rights (PR)**: Non-transferable points earned through real participation. They represent your standing in the community and are required to vote, propose, and join projects.
- **Utility Tokens (UT)**: Tokens earned through economic activity and M-Pesa contributions. Can be withdrawn to M-Pesa (no cash-out for PR — by design).
- **Impact Points (IP)**: A reputation score reflecting your contributions at ward, constituency, county, and national level.

## How to earn PR
- Attend a baraza (/present): 15 PR
- Facilitate a baraza: 25 PR
- Vote on a proposal: 5 PR
- Create a proposal: 10 PR
- Get email verified (registration bonus): 50 PR
- Get community verified: 100 PR

## Verification levels (lowest → highest)
1. EMAIL_VERIFIED — basic access
2. PHONE_VERIFIED — can request community verification
3. COMMUNITY_VERIFIED — full access (economy, governance, marketplace, projects)
4. FULL_VERIFIED — wallet linked, highest trust level

## Governance flow
1. Community member creates a proposal in their group (costs PR)
2. Group leader reviews → forwards DRAFT to PENDING_REVIEW
3. Location admin approves → APPROVED_FOR_VOTING
4. Members vote during the voting window
5. System tallies automatically — APPROVED → EXECUTING, or REJECTED

## Bot commands (you don't handle these — the bot does)
- /present — mark attendance at an open baraza session (earns 15 PR)
- /verify [code] — link your phone number via a 6-digit code from UjamaaDAO
- /schedule YYYY-MM-DD HH:MM — (leader only) schedule a baraza session
- /open — (leader only) open the session for /present
- /close — (leader only) close the session and tally attendance

## Your role
- Answer questions about UjamaaDAO features, PR/UT/IP mechanics, governance
- Tell members about their PR balance, IP score, and verification level (use tools)
- Share information about active proposals and treasury balance (use tools)
- Reply in the SAME language the member used: if they write in English, answer in English; if in Kiswahili, answer in Kiswahili; if they mix, you may mix. Do NOT translate or repeat your answer in another language, and do not add flag emojis.
- Be warm, community-oriented, and concise — this is a community chat, not a corporate bot
- You cannot take actions (vote, create proposals, send money) — only inform and guide
- Never make up data — use the tools for real information

Keep responses short — this is a Telegram chat, not an essay. 2–4 sentences is usually enough.`;

export interface BarazaUserContext {
  userId: string | null;
  displayName: string;
  ward?: string;
  verificationLevel?: string;
  participationRights?: number;
  activeElectionCount?: number;
}

const UNAVAILABLE_MSG =
  'BarazaBot AI is unavailable right now / haipatikani kwa sasa. Commands like /present, /verify, /schedule still work. 🌿';

// Tool definitions in OpenAI format
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_user_stats',
      description:
        "Get the current user's PR balance, total Impact Points, and verification level.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_group_proposals',
      description:
        'Get proposals for this baraza group. Use status=ACTIVE for proposals currently open for review or voting; status=ALL for recent history.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ACTIVE', 'ALL'],
            description: 'Filter scope',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_group_treasury',
      description: 'Get the KES and UT treasury balance for the group.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_election_results',
      description:
        'Get elections for this group. Returns active elections (open for nominations or voting) and the most recent completed election with winner.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ward_stats',
      description:
        'Get ward-level community statistics: member count, total PR issued, active members (participated in last 30 days), and recent M-Pesa contributions.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_past_decisions',
      description:
        'Search past proposals and decisions for this group by keyword. Use when a member asks about a previous vote, decision, or initiative.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Keyword or phrase to search in proposal titles and descriptions',
          },
        },
        required: ['query'],
      },
    },
  },
];

export class BarazaAiService {
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: DASHSCOPE_BASE_URL,
      });
    }
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  async reply(
    text: string,
    userContext: BarazaUserContext,
    groupId: string
  ): Promise<string> {
    if (!this.client) return UNAVAILABLE_MSG;

    const contextHeader = buildContextHeader(userContext);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${contextHeader}\n\n${text}` },
    ];

    try {
      let response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        tools: TOOLS,
        tool_choice: 'auto',
        messages,
      });

      let round = 0;
      while (
        response.choices[0]?.finish_reason === 'tool_calls' &&
        round < MAX_TOOL_ROUNDS
      ) {
        round++;
        const assistantMessage = response.choices[0].message;
        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls ?? [];
        const toolResults = await Promise.all(
          toolCalls.map(async (tc) => {
            // OpenAI v6 tool_calls is a union (function | custom); only
            // function tool calls carry a `.function` payload.
            if (tc.type !== 'function') {
              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                content: 'Unsupported tool call type.',
              };
            }
            const result = await executeToolCall(
              tc.function.name,
              JSON.parse(tc.function.arguments || '{}'),
              userContext,
              groupId
            );
            return {
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: result,
            };
          })
        );

        messages.push(...toolResults);
        response = await this.client!.chat.completions.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          tools: TOOLS,
          tool_choice: 'auto',
          messages,
        });
      }

      return response.choices[0]?.message?.content ?? UNAVAILABLE_MSG;
    } catch (err) {
      logger.warn({ err, groupId }, '[BarazaAI] Qwen API call failed');
      return UNAVAILABLE_MSG;
    }
  }
}

// ─────────────────────────────────────────────
// Tool execution
// ─────────────────────────────────────────────

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  userContext: BarazaUserContext,
  groupId: string
): Promise<string> {
  try {
    switch (name) {
      case 'get_user_stats':
        return await toolGetUserStats(userContext.userId);
      case 'get_group_proposals':
        return await toolGetGroupProposals(
          groupId,
          (input.status as string) ?? 'ACTIVE'
        );
      case 'get_group_treasury':
        return await toolGetGroupTreasury(groupId);
      case 'get_election_results':
        return await toolGetElectionResults(groupId);
      case 'get_ward_stats':
        return await toolGetWardStats(groupId);
      case 'search_past_decisions':
        return await toolSearchPastDecisions(
          groupId,
          (input.query as string) ?? ''
        );
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    logger.warn({ err, tool: name }, '[BarazaAI] Tool call failed');
    return `Could not retrieve data for ${name}.`;
  }
}

// ─────────────────────────────────────────────
// Tool implementations (unchanged from original)
// ─────────────────────────────────────────────

async function toolGetUserStats(userId: string | null): Promise<string> {
  if (!userId) return 'User is not linked to a UjamaaDAO account.';

  const [user, ipAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        participationRights: true,
        verificationLevel: true,
        primaryWard: { select: { name: true } },
      },
    }),
    prisma.impactPointLog.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  if (!user) return 'User not found.';

  return JSON.stringify({
    participationRights: user.participationRights,
    impactPoints: ipAgg._sum.amount ?? 0,
    verificationLevel: user.verificationLevel,
    ward: user.primaryWard?.name ?? 'Not set',
  });
}

async function toolGetGroupProposals(
  groupId: string,
  status: string
): Promise<string> {
  const where: Prisma.ProposalWhereInput =
    status === 'ACTIVE'
      ? {
          groupId,
          status: { in: ['PENDING_REVIEW', 'APPROVED_FOR_VOTING'] as any },
        }
      : { groupId };

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      title: true,
      status: true,
      votingEndsAt: true,
      _count: { select: { votes: true } },
    },
  });

  if (!proposals.length) return 'No proposals found for this group.';

  return JSON.stringify(
    proposals.map((p) => ({
      title: p.title,
      status: p.status,
      votes: p._count.votes,
      votingEndsAt: p.votingEndsAt?.toISOString().slice(0, 10) ?? null,
    }))
  );
}

async function toolGetGroupTreasury(groupId: string): Promise<string> {
  const treasury = await prisma.groupTreasury.findUnique({
    where: { groupId },
    select: { balance: true, tokenBalance: true, updatedAt: true },
  });

  if (!treasury) return 'No treasury found for this group.';

  return JSON.stringify({
    kesBalance: Number(treasury.balance),
    utBalance: treasury.tokenBalance ?? 0,
    lastUpdated: treasury.updatedAt?.toISOString().slice(0, 10) ?? null,
  });
}

async function toolGetElectionResults(groupId: string): Promise<string> {
  const [active, recent] = await Promise.all([
    prisma.election.findMany({
      where: {
        groupId,
        status: { in: ['NOMINATIONS_OPEN', 'VOTING_OPEN'] },
      },
      select: {
        id: true,
        roleKey: true,
        status: true,
        nominationsCloseAt: true,
        votingCloseAt: true,
        _count: { select: { candidates: true } },
      },
      take: 5,
    }),
    prisma.election.findFirst({
      where: { groupId, status: 'CLOSED' },
      orderBy: { votingCloseAt: 'desc' },
      select: {
        roleKey: true,
        status: true,
        votingCloseAt: true,
        candidates: {
          orderBy: { voteCount: 'desc' },
          take: 1,
          select: {
            voteCount: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const result: Record<string, unknown> = {};

  if (active.length) {
    result.activeElections = active.map((e) => ({
      role: e.roleKey,
      status: e.status,
      candidates: e._count.candidates,
      nominationsCloseAt: e.nominationsCloseAt.toISOString().slice(0, 10),
      votingCloseAt: e.votingCloseAt.toISOString().slice(0, 10),
    }));
  } else {
    result.activeElections = [];
  }

  if (recent) {
    const winner = recent.candidates[0];
    result.lastElection = {
      role: recent.roleKey,
      closedOn: recent.votingCloseAt.toISOString().slice(0, 10),
      winner: winner
        ? { name: winner.user?.name ?? 'Unknown', votes: winner.voteCount }
        : null,
    };
  }

  return JSON.stringify(result);
}

async function toolGetWardStats(groupId: string): Promise<string> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { wardId: true, constituencyId: true, countyId: true },
  });

  const [memberCount, recentActive, totalPR] = await Promise.all([
    prisma.groupMember.count({ where: { groupId, active: true } }),
    group?.wardId
      ? prisma.barazaAttendance.count({
          where: {
            barazaGroup: { groupId },
            sessionDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10),
            },
          },
        })
      : Promise.resolve(0),
    prisma.user.aggregate({
      where: {
        groupMemberships: { some: { groupId, active: true } },
      },
      _sum: { participationRights: true },
    }),
  ]);

  return JSON.stringify({
    members: memberCount,
    activeParticipantsLast30Days: recentActive,
    totalPRHeld: totalPR._sum.participationRights ?? 0,
  });
}

async function toolSearchPastDecisions(
  groupId: string,
  query: string
): Promise<string> {
  if (!query.trim()) return 'Please provide a search term.';

  const proposals = await prisma.proposal.findMany({
    where: {
      groupId,
      status: { in: ['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'] as any },
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      title: true,
      status: true,
      createdAt: true,
      _count: { select: { votes: true } },
    },
  });

  const opinions = await prisma.proposalAnnotation.findMany({
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
      quotedText: true,
      fieldKey: true,
      createdAt: true,
      proposal: { select: { title: true } },
      author: { select: { name: true } },
    },
  });

  if (!proposals.length && !opinions.length) {
    return `No past decisions or community opinions found matching "${query}".`;
  }

  return JSON.stringify({
    decisions: proposals.map((p) => ({
      title: p.title,
      outcome: p.status,
      votes: p._count.votes,
      date: p.createdAt.toISOString().slice(0, 10),
    })),
    opinions: opinions.map((o) => ({
      proposal: o.proposal.title,
      author: o.author.name,
      on: o.fieldKey,
      quoted: o.quotedText.slice(0, 100),
      opinion: o.comment,
      date: o.createdAt.toISOString().slice(0, 10),
    })),
  });
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildContextHeader(ctx: BarazaUserContext): string {
  const parts = [`Member: ${ctx.displayName}`];
  if (ctx.ward) parts.push(`Ward: ${ctx.ward}`);
  if (ctx.verificationLevel) parts.push(`Level: ${ctx.verificationLevel}`);
  if (ctx.participationRights !== undefined)
    parts.push(`PR: ${ctx.participationRights}`);
  if (ctx.activeElectionCount !== undefined && ctx.activeElectionCount > 0)
    parts.push(`Active elections: ${ctx.activeElectionCount}`);
  return `[Context: ${parts.join(' | ')}]`;
}

export const barazaAiService = new BarazaAiService();

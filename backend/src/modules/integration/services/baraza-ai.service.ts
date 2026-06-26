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

## LANGUAGE — MOST IMPORTANT RULE
Detect the language of the member's latest message and reply ONLY in that exact language.
- If the member writes in English, reply 100% in English. Do NOT use any Swahili.
- If the member writes in Kiswahili, reply 100% in Kiswahili.
- If they mix, you may mix to match them.
Never default to Swahili. Never translate or repeat your answer in a second language. No flag emojis.

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

## Blockchain & wallet (answer accurately — NEVER guess or make up details)
- UjamaaDAO is HYBRID: the governance record lives on a PUBLIC blockchain — **Base, an Ethereum Layer-2** — while profiles, chat, education and discovery stay off-chain for speed. It is NOT a private or "permissioned" chain.
- On-chain: PR (soulbound / non-transferable), UT, and governance — each proposal's content hash AND the votes.
- Votes are **user-signed**: your own wallet signs your vote, so it comes from you and **the platform cannot vote for you or fake your vote**. Results are recorded on-chain and anyone can verify them.
- Voting is **gasless** — you never need ETH or to pay any gas; sponsorship is handled for you.
- Wallet = a **passkey-secured Coinbase Smart Wallet**: no seed phrase, secured by your phone's passkey (fingerprint / Face ID). You do NOT need any crypto knowledge.
- You do NOT need a wallet for everyday use: 3 community vouches (COMMUNITY_VERIFIED) already unlock proposals, voting, projects and dues. A linked wallet is the final step (FULL_VERIFIED) and is what makes your on-chain votes unforgeable.
- Status: contracts are live and tested on **Base Sepolia** (a test network); the **Base mainnet** launch is planned. Until mainnet, the off-chain record is authoritative.
- Money is NEVER crypto: real money (dues, contributions) moves via **M-Pesa** to platform accounts. PR can't be cashed out; earned UT can't be cashed out.

## Bot commands (you don't handle these — the bot does)
- /present — mark attendance at an open baraza session (earns 15 PR)
- /verify [code] — link your phone number via a 6-digit code from UjamaaDAO
- /schedule YYYY-MM-DD HH:MM — (leader only) schedule a baraza session
- /open — (leader only) open the session for /present
- /close — (leader only) close the session and tally attendance

## A member's communities
A member belongs to several communities at once: their location chain (ward → constituency → county → national, and a second ward chain if they have a secondary ward — up to 7 system groups) plus any voluntary groups (SACCOs, projects, interest groups) they have joined. "Your community" is never just the ward. When you report community-specific data (proposals, treasury, elections, decisions), the tool results are labelled by community — always say which community each item belongs to, and if something spans several, group it by community.

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

/**
 * A community the user belongs to. In a baraza group chat this is the single
 * registered group; in a DM it is every group the user is an active member of
 * (their up-to-7 system groups + all voluntary groups). Group-scoped tools
 * operate across this whole set and label results by community name.
 */
export interface BarazaCommunity {
  groupId: string;
  groupName: string;
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
        "Get proposals across the user's communities (their ward/constituency/county/national system groups and any voluntary groups). Results are labelled by community. Use status=ACTIVE for proposals currently open for review or voting; status=ALL for recent history.",
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
      description:
        "Get the KES and UT treasury balances for the user's communities, labelled by community.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_election_results',
      description:
        "Get elections across the user's communities. Returns active elections (open for nominations or voting) and the most recent completed election with winner, labelled by community.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ward_stats',
      description:
        "Get community statistics for the user's communities: member counts (and, when the user is in a single community, active members in the last 30 days and total PR held). Use when asked how big or how active a community is.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_past_decisions',
      description:
        "Search past proposals and decisions across the user's communities by keyword. Use when a member asks about a previous vote, decision, or initiative.",
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
        // Cap each call and limit retries so a slow Qwen can't hang the webhook
        // async tail. reply() already catches and falls back on failure.
        timeout: 30_000,
        maxRetries: 1,
      });
    }
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  async reply(
    text: string,
    userContext: BarazaUserContext,
    communities: BarazaCommunity[]
  ): Promise<string> {
    if (!this.client) return UNAVAILABLE_MSG;

    const contextHeader = buildContextHeader(userContext, communities);
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
              communities
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
      logger.warn(
        { err, communities: communities.map((c) => c.groupId) },
        '[BarazaAI] Qwen API call failed'
      );
      return UNAVAILABLE_MSG;
    }
  }
}

// ─────────────────────────────────────────────
// Tool execution
// ─────────────────────────────────────────────

const GROUP_SCOPED_TOOLS = new Set([
  'get_group_proposals',
  'get_group_treasury',
  'get_election_results',
  'get_ward_stats',
  'search_past_decisions',
]);

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  userContext: BarazaUserContext,
  communities: BarazaCommunity[]
): Promise<string> {
  // Group-scoped tools need at least one community. In a DM where the user
  // isn't linked to any group, answer honestly rather than error.
  if (GROUP_SCOPED_TOOLS.has(name) && communities.length === 0) {
    return "I couldn't find any communities linked to your account. Join or get verified in a community in the UjamaaDAO app, then ask me again.";
  }
  try {
    switch (name) {
      case 'get_user_stats':
        return await toolGetUserStats(userContext.userId);
      case 'get_group_proposals':
        return await toolGetGroupProposals(
          communities,
          (input.status as string) ?? 'ACTIVE'
        );
      case 'get_group_treasury':
        return await toolGetGroupTreasury(communities);
      case 'get_election_results':
        return await toolGetElectionResults(communities);
      case 'get_ward_stats':
        return await toolGetWardStats(communities);
      case 'search_past_decisions':
        return await toolSearchPastDecisions(
          communities,
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
  communities: BarazaCommunity[],
  status: string
): Promise<string> {
  const groupIds = communities.map((c) => c.groupId);
  const nameOf = communityNameMap(communities);

  const where: Prisma.ProposalWhereInput =
    status === 'ACTIVE'
      ? {
          groupId: { in: groupIds },
          status: { in: ['PENDING_REVIEW', 'APPROVED_FOR_VOTING'] as any },
        }
      : { groupId: { in: groupIds } };

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      title: true,
      status: true,
      votingEndsAt: true,
      groupId: true,
      _count: { select: { votes: true } },
    },
  });

  if (!proposals.length) return 'No proposals found in your communities.';

  return JSON.stringify(
    proposals.map((p) => ({
      community: nameOf(p.groupId),
      title: p.title,
      status: p.status,
      votes: p._count.votes,
      votingEndsAt: p.votingEndsAt?.toISOString().slice(0, 10) ?? null,
    }))
  );
}

async function toolGetGroupTreasury(
  communities: BarazaCommunity[]
): Promise<string> {
  const groupIds = communities.map((c) => c.groupId);
  const nameOf = communityNameMap(communities);

  const treasuries = await prisma.groupTreasury.findMany({
    where: { groupId: { in: groupIds } },
    select: {
      groupId: true,
      balance: true,
      tokenBalance: true,
      updatedAt: true,
    },
  });

  if (!treasuries.length) return 'No treasuries found in your communities.';

  return JSON.stringify(
    treasuries.map((t) => ({
      community: nameOf(t.groupId),
      kesBalance: Number(t.balance),
      utBalance: t.tokenBalance ?? 0,
      lastUpdated: t.updatedAt?.toISOString().slice(0, 10) ?? null,
    }))
  );
}

async function toolGetElectionResults(
  communities: BarazaCommunity[]
): Promise<string> {
  const groupIds = communities.map((c) => c.groupId);
  const nameOf = communityNameMap(communities);

  const [active, recent] = await Promise.all([
    prisma.election.findMany({
      where: {
        groupId: { in: groupIds },
        status: { in: ['NOMINATIONS_OPEN', 'VOTING_OPEN'] },
      },
      select: {
        groupId: true,
        roleKey: true,
        status: true,
        nominationsCloseAt: true,
        votingCloseAt: true,
        _count: { select: { candidates: true } },
      },
      take: 10,
    }),
    prisma.election.findMany({
      where: { groupId: { in: groupIds }, status: 'CLOSED' },
      orderBy: { votingCloseAt: 'desc' },
      take: 5,
      select: {
        groupId: true,
        roleKey: true,
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

  const result: Record<string, unknown> = {
    activeElections: active.map((e) => ({
      community: nameOf(e.groupId),
      role: e.roleKey,
      status: e.status,
      candidates: e._count.candidates,
      nominationsCloseAt: e.nominationsCloseAt.toISOString().slice(0, 10),
      votingCloseAt: e.votingCloseAt.toISOString().slice(0, 10),
    })),
    recentElections: recent.map((e) => {
      const winner = e.candidates[0];
      return {
        community: nameOf(e.groupId),
        role: e.roleKey,
        closedOn: e.votingCloseAt.toISOString().slice(0, 10),
        winner: winner
          ? { name: winner.user?.name ?? 'Unknown', votes: winner.voteCount }
          : null,
      };
    }),
  };

  return JSON.stringify(result);
}

async function toolGetWardStats(
  communities: BarazaCommunity[]
): Promise<string> {
  // Single community (e.g. inside a baraza group chat): return the rich metrics.
  if (communities.length === 1) {
    const { groupId, groupName } = communities[0];
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
      community: groupName,
      members: memberCount,
      activeParticipantsLast30Days: recentActive,
      totalPRHeld: totalPR._sum.participationRights ?? 0,
    });
  }

  // Multiple communities (a DM): return member counts per community cheaply.
  const groupIds = communities.map((c) => c.groupId);
  const nameOf = communityNameMap(communities);
  const counts = await prisma.groupMember.groupBy({
    by: ['groupId'],
    where: { groupId: { in: groupIds }, active: true },
    _count: { _all: true },
  });
  const byGroup = new Map(counts.map((c) => [c.groupId, c._count._all]));

  return JSON.stringify(
    communities.map((c) => ({
      community: nameOf(c.groupId),
      members: byGroup.get(c.groupId) ?? 0,
    }))
  );
}

async function toolSearchPastDecisions(
  communities: BarazaCommunity[],
  query: string
): Promise<string> {
  if (!query.trim()) return 'Please provide a search term.';

  const groupIds = communities.map((c) => c.groupId);
  const nameOf = communityNameMap(communities);

  const proposals = await prisma.proposal.findMany({
    where: {
      groupId: { in: groupIds },
      status: { in: ['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'] as any },
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      title: true,
      status: true,
      createdAt: true,
      groupId: true,
      _count: { select: { votes: true } },
    },
  });

  const opinions = await prisma.proposalAnnotation.findMany({
    where: {
      proposal: { groupId: { in: groupIds } },
      OR: [
        { quotedText: { contains: query, mode: 'insensitive' } },
        { comment: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      comment: true,
      quotedText: true,
      fieldKey: true,
      createdAt: true,
      proposal: { select: { title: true, groupId: true } },
      author: { select: { name: true } },
    },
  });

  if (!proposals.length && !opinions.length) {
    return `No past decisions or community opinions found matching "${query}" in your communities.`;
  }

  return JSON.stringify({
    decisions: proposals.map((p) => ({
      community: nameOf(p.groupId),
      title: p.title,
      outcome: p.status,
      votes: p._count.votes,
      date: p.createdAt.toISOString().slice(0, 10),
    })),
    opinions: opinions.map((o) => ({
      community: nameOf(o.proposal.groupId),
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

function buildContextHeader(
  ctx: BarazaUserContext,
  communities: BarazaCommunity[]
): string {
  const parts = [`Member: ${ctx.displayName}`];
  if (ctx.ward) parts.push(`Primary ward: ${ctx.ward}`);
  if (ctx.verificationLevel) parts.push(`Level: ${ctx.verificationLevel}`);
  if (ctx.participationRights !== undefined)
    parts.push(`PR: ${ctx.participationRights}`);
  if (ctx.activeElectionCount !== undefined && ctx.activeElectionCount > 0)
    parts.push(`Active elections: ${ctx.activeElectionCount}`);
  if (communities.length)
    parts.push(
      `Communities (${communities.length}): ${communities
        .map((c) => c.groupName)
        .join(', ')}`
    );
  return `[Context: ${parts.join(' | ')}]`;
}

/** Returns a lookup from groupId → community name for labelling tool results. */
function communityNameMap(
  communities: BarazaCommunity[]
): (groupId: string | null) => string {
  const map = new Map(communities.map((c) => [c.groupId, c.groupName]));
  return (groupId) => (groupId && map.get(groupId)) || 'your community';
}

export const barazaAiService = new BarazaAiService();

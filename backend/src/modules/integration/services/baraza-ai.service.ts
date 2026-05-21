/**
 * @file src/modules/integration/services/baraza-ai.service.ts
 * @description
 * Baraza AI — Claude-powered conversational layer for the Telegram bot.
 *
 * Routing rule: slash commands (/present, /verify, etc.) stay deterministic.
 * Any free-text message in a registered baraza goes through this service.
 *
 * Graceful degradation: if CLAUDE_API_KEY is not set, returns a fallback message.
 * Tools: get_user_stats, get_group_proposals, get_group_treasury.
 * Model: configurable via BARAZA_AI_MODEL (default: claude-haiku-4-5-20251001).
 */

import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';

const MODEL = process.env.BARAZA_AI_MODEL ?? 'claude-haiku-4-5-20251001';
const MAX_TOOL_ROUNDS = 3;
const MAX_TOKENS = 1024;

// Static — never changes at runtime; eligible for prompt caching
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
- Respond in English or Swahili based on the user's language — mix is fine
- Be warm, community-oriented, and concise — this is a community chat, not a corporate bot
- You cannot take actions (vote, create proposals, send money) — only inform and guide
- Never make up data — use the tools for real information

Keep responses short — this is a Telegram chat, not an essay. 2–4 sentences is usually enough.`;

export interface BarazaUserContext {
  userId: string | null;
  displayName: string;
  ward?: string;
  verificationLevel?: string;
}

const UNAVAILABLE_MSG =
  'BarazaBot AI si available saa hii. Commands kama /present, /verify, /schedule bado zinafanya kazi. 🌿';

export class BarazaAiService {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
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
    const tools = buildTools();
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `${contextHeader}\n\n${text}` },
    ];

    try {
      let response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      let round = 0;
      while (response.stop_reason === 'tool_use' && round < MAX_TOOL_ROUNDS) {
        round++;
        const toolBlocks = response.content.filter(
          (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock =>
            b.type === 'tool_use'
        );
        messages.push({ role: 'assistant', content: response.content });

        const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolBlocks.map(async (block: Anthropic.ToolUseBlock) => ({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: await executeToolCall(
              block.name,
              block.input as Record<string, unknown>,
              userContext,
              groupId
            ),
          }))
        );

        messages.push({ role: 'user', content: results });
        response = await this.client!.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools,
          messages,
        });
      }

      const textBlock = response.content.find(
        (b: Anthropic.ContentBlock): b is Anthropic.TextBlock =>
          b.type === 'text'
      );
      return textBlock?.text ?? UNAVAILABLE_MSG;
    } catch (err) {
      logger.warn({ err, groupId }, '[BarazaAI] Claude API call failed');
      return UNAVAILABLE_MSG;
    }
  }
}

// ─────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────

function buildTools(): Anthropic.Tool[] {
  return [
    {
      name: 'get_user_stats',
      description:
        "Get the current user's PR balance, total Impact Points, and verification level.",
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_group_proposals',
      description:
        'Get proposals for this baraza group. Use status=ACTIVE for proposals currently open for review or voting; status=ALL for recent history.',
      input_schema: {
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
    {
      name: 'get_group_treasury',
      description: 'Get the KES and UT treasury balance for the group.',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
  ];
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
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    logger.warn({ err, tool: name }, '[BarazaAI] Tool call failed');
    return `Could not retrieve data for ${name}.`;
  }
}

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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildContextHeader(ctx: BarazaUserContext): string {
  const parts = [`Member: ${ctx.displayName}`];
  if (ctx.ward) parts.push(`Ward: ${ctx.ward}`);
  if (ctx.verificationLevel) parts.push(`Level: ${ctx.verificationLevel}`);
  return `[${parts.join(' | ')}]`;
}

export const barazaAiService = new BarazaAiService();

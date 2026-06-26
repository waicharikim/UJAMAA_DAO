/**
 * @file tests/integration/baraza-ai.service.test.ts
 * @description Tests for BarazaAiService — Qwen (OpenAI-compatible DashScope)
 * client mocked, tool execution uses the real DB.
 *
 * The service reasons over a SET of communities (BarazaCommunity[]): a single
 * group inside a baraza chat, or all of a user's groups in a DM. Group-scoped
 * tools query across the set and label results by community.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

// vi.hoisted so the mock fn exists before the hoisted vi.mock factory runs
// (the service constructs its OpenAI client at module load when DASHSCOPE_API_KEY
// is present in the test env).
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import {
  BarazaAiService,
  type BarazaUserContext,
  type BarazaCommunity,
} from '../../src/modules/integration/services/baraza-ai.service.js';
import { seedLocation, seedGroup, seedUser, INT_WARD_ID } from './helpers.js';

// ─────────────────────────────────────────────
// OpenAI-shaped response builders
// ─────────────────────────────────────────────

function makeTextResponse(content: string) {
  return {
    choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
  };
}

function makeToolUseResponse(
  toolName: string,
  toolId: string,
  args: Record<string, unknown> = {}
) {
  return {
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: toolId,
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  };
}

const BASE_CTX: BarazaUserContext = {
  userId: null,
  displayName: 'TestUser',
};

/** One-element community set, as used inside a registered baraza group chat. */
function single(groupId: string, groupName = 'Test Community'): BarazaCommunity[] {
  return [{ groupId, groupName }];
}

/** Last message of a recorded create() call — the tool result in the 2nd round. */
function lastToolResult(callIndex: number) {
  const call = mockCreate.mock.calls[callIndex][0];
  return call.messages[call.messages.length - 1];
}

// ─────────────────────────────────────────────
// isAvailable / fallback
// ─────────────────────────────────────────────

describe('BarazaAiService.isAvailable', () => {
  it('returns false when DASHSCOPE_API_KEY is not set', () => {
    const saved = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    const svc = new BarazaAiService();
    expect(svc.isAvailable).toBe(false);
    if (saved) process.env.DASHSCOPE_API_KEY = saved;
  });

  it('returns true when DASHSCOPE_API_KEY is set', () => {
    process.env.DASHSCOPE_API_KEY = 'sk-test';
    const svc = new BarazaAiService();
    expect(svc.isAvailable).toBe(true);
    delete process.env.DASHSCOPE_API_KEY;
  });
});

describe('BarazaAiService.reply — not available', () => {
  it('returns fallback message when API key is absent', async () => {
    const saved = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    const svc = new BarazaAiService();
    const reply = await svc.reply('Hello', BASE_CTX, single('g1'));
    expect(reply).toMatch(/unavailable|haipatikani/i);
    if (saved) process.env.DASHSCOPE_API_KEY = saved;
  });
});

// ─────────────────────────────────────────────
// Basic reply routing
// ─────────────────────────────────────────────

describe('BarazaAiService.reply — basic text response', () => {
  let svc: BarazaAiService;

  beforeEach(() => {
    process.env.DASHSCOPE_API_KEY = 'sk-test';
    vi.clearAllMocks();
    svc = new BarazaAiService();
  });

  afterEach(() => {
    delete process.env.DASHSCOPE_API_KEY;
  });

  it('returns the model text response', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('Karibu! PR ni 15 kwa kila baraza.')
    );

    const result = await svc.reply('How do I earn PR?', BASE_CTX, single('g1'));
    expect(result).toBe('Karibu! PR ni 15 kwa kila baraza.');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('returns fallback when the API throws', async () => {
    mockCreate.mockRejectedValue(new Error('rate limit'));
    const result = await svc.reply('Hello', BASE_CTX, single('g1'));
    expect(result).toMatch(/unavailable|haipatikani/i);
  });

  it('returns fallback when response has no content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: null } }],
    });
    const result = await svc.reply('Hello', BASE_CTX, single('g1'));
    expect(result).toMatch(/unavailable|haipatikani/i);
  });

  it('injects context header (incl. communities) into the user message', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('OK'));
    const ctx: BarazaUserContext = {
      userId: 'u1',
      displayName: 'Alice',
      ward: 'Westlands',
      verificationLevel: 'COMMUNITY_VERIFIED',
      participationRights: 120,
      activeElectionCount: 2,
    };

    await svc.reply('Hello', ctx, [
      { groupId: 'g1', groupName: 'Westlands Ward' },
      { groupId: 'g2', groupName: 'Mwangaza SACCO' },
    ]);

    // OpenAI message order: [system, user]
    const call = mockCreate.mock.calls[0][0];
    const userMsg = call.messages[1].content as string;
    expect(userMsg).toContain('Alice');
    expect(userMsg).toContain('Westlands');
    expect(userMsg).toContain('120');
    expect(userMsg).toContain('Active elections: 2');
    expect(userMsg).toContain('Mwangaza SACCO');
  });
});

// ─────────────────────────────────────────────
// Tool use loop
// ─────────────────────────────────────────────

describe('BarazaAiService.reply — tool use', () => {
  let svc: BarazaAiService;
  let user: Awaited<ReturnType<typeof seedUser>>;
  let group: Awaited<ReturnType<typeof seedGroup>>;

  beforeEach(async () => {
    process.env.DASHSCOPE_API_KEY = 'sk-test';
    vi.clearAllMocks();
    svc = new BarazaAiService();
    await seedLocation();
    user = await seedUser(`ai-tool-${Date.now()}@test.com`);
    group = await seedGroup(INT_WARD_ID);
  });

  afterEach(() => {
    delete process.env.DASHSCOPE_API_KEY;
  });

  it('resolves get_user_stats tool and returns final text', async () => {
    const ctx: BarazaUserContext = {
      userId: user.id,
      displayName: user.name ?? 'User',
    };

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_user_stats', 'tu-1'))
      .mockResolvedValueOnce(makeTextResponse('Una PR 50 na uko EMAIL_VERIFIED.'));

    const result = await svc.reply('What is my PR?', ctx, single(group.id));
    expect(result).toBe('Una PR 50 na uko EMAIL_VERIFIED.');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const toolMsg = lastToolResult(1);
    expect(toolMsg.role).toBe('tool');
    expect(toolMsg.tool_call_id).toBe('tu-1');
  });

  it('resolves get_group_proposals tool, labelled by community', async () => {
    await prisma.proposal.create({
      data: {
        groupId: group.id,
        title: 'Test Proposal',
        description: 'Test description',
        status: 'PENDING_REVIEW',
        proposalType: 'COMMUNITY_INITIATIVE',
        proposalScope: 'COMMUNITY',
        creatorId: user.id,
      },
    });

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse('get_group_proposals', 'tu-2', { status: 'ACTIVE' })
      )
      .mockResolvedValueOnce(makeTextResponse('Kuna pendekezo moja linasubiri.'));

    const result = await svc.reply(
      'Any proposals?',
      BASE_CTX,
      single(group.id, 'Westlands Ward')
    );
    expect(result).toContain('pendekezo');

    const parsed = JSON.parse(lastToolResult(1).content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].title).toBe('Test Proposal');
    expect(parsed[0].community).toBe('Westlands Ward');
  });

  it('resolves get_group_treasury tool (array, labelled by community)', async () => {
    await prisma.groupTreasury.create({
      data: { groupId: group.id, balance: 5000, tokenBalance: 250 },
    });

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_group_treasury', 'tu-3'))
      .mockResolvedValueOnce(makeTextResponse('Treasury ina KES 5,000.'));

    await svc.reply('What is in the treasury?', BASE_CTX, single(group.id));

    const parsed = JSON.parse(lastToolResult(1).content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].kesBalance).toBe(5000);
    expect(parsed[0].utBalance).toBe(250);
  });

  it('resolves get_election_results tool', async () => {
    const { seedElection } = await import('../elections/helpers.js');
    await seedElection(group.id, 'NOMINATIONS_OPEN');

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_election_results', 'tu-4'))
      .mockResolvedValueOnce(makeTextResponse('Kuna uchaguzi unaoendelea.'));

    await svc.reply('Any elections?', BASE_CTX, single(group.id));

    const parsed = JSON.parse(lastToolResult(1).content);
    expect(parsed.activeElections).toHaveLength(1);
    expect(parsed.activeElections[0].status).toBe('NOMINATIONS_OPEN');
    expect(parsed.activeElections[0].role).toBe('LEADER');
  });

  it('resolves get_ward_stats tool (single community → rich metrics)', async () => {
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER', active: true },
    });

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_ward_stats', 'tu-5'))
      .mockResolvedValueOnce(makeTextResponse('Kuna wanachama 1 katika kata.'));

    await svc.reply('How many members?', BASE_CTX, single(group.id));

    const parsed = JSON.parse(lastToolResult(1).content);
    expect(parsed.members).toBeGreaterThanOrEqual(1);
  });

  it('get_ward_stats across multiple communities returns per-community counts', async () => {
    const group2 = await seedGroup(INT_WARD_ID);
    await prisma.groupMember.createMany({
      data: [
        { groupId: group.id, userId: user.id, role: 'MEMBER', active: true },
        { groupId: group2.id, userId: user.id, role: 'MEMBER', active: true },
      ],
    });

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_ward_stats', 'tu-5b'))
      .mockResolvedValueOnce(makeTextResponse('Uko kwenye jamii mbili.'));

    await svc.reply('My communities?', BASE_CTX, [
      { groupId: group.id, groupName: 'Group A' },
      { groupId: group2.id, groupName: 'Group B' },
    ]);

    const parsed = JSON.parse(lastToolResult(1).content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((p: { community: string }) => p.community).sort()).toEqual([
      'Group A',
      'Group B',
    ]);
  });

  it('resolves search_past_decisions tool', async () => {
    await prisma.proposal.create({
      data: {
        groupId: group.id,
        title: 'Borehole Drilling Initiative',
        description: 'We will drill a borehole in the ward.',
        status: 'APPROVED',
        proposalType: 'MAJOR_PROJECT',
        proposalScope: 'COMMUNITY',
        creatorId: user.id,
      },
    });

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse('search_past_decisions', 'tu-6', { query: 'borehole' })
      )
      .mockResolvedValueOnce(makeTextResponse('Mnamo 2025 mliamua kutengeneza kisima.'));

    await svc.reply(
      'What did we decide about the borehole?',
      BASE_CTX,
      single(group.id)
    );

    const parsed = JSON.parse(lastToolResult(1).content);
    expect(parsed.decisions[0].title).toContain('Borehole');
    expect(parsed.decisions[0].outcome).toBe('APPROVED');
  });

  it('returns "no match" when search_past_decisions finds nothing', async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse('search_past_decisions', 'tu-7', {
          query: 'nonexistent xyz',
        })
      )
      .mockResolvedValueOnce(makeTextResponse('Sikupata maamuzi yanayohusiana.'));

    await svc.reply(
      'Any past decisions about nonexistent xyz?',
      BASE_CTX,
      single(group.id)
    );

    expect(lastToolResult(1).content).toContain('No past decisions');
  });

  it('group-scoped tool with no communities returns a graceful message', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_group_proposals', 'tu-empty'))
      .mockResolvedValueOnce(makeTextResponse('Hujajiunga na jamii yoyote.'));

    await svc.reply('Any proposals?', BASE_CTX, []);

    expect(lastToolResult(1).content).toMatch(/couldn't find any communities/i);
  });

  it('handles unknown tool gracefully', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('unknown_tool', 'tu-8'))
      .mockResolvedValueOnce(makeTextResponse('I could not retrieve that.'));

    const result = await svc.reply('Hello', BASE_CTX, single(group.id));
    expect(result).toBe('I could not retrieve that.');
    expect(lastToolResult(1).content).toContain('Unknown tool');
  });

  it('caps tool rounds at MAX_TOOL_ROUNDS and returns fallback', async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse('get_user_stats', 'tu-loop'));

    const result = await svc.reply('Keep looping', BASE_CTX, single(group.id));
    expect(result).toMatch(/unavailable|haipatikani/i);
    expect(mockCreate).toHaveBeenCalledTimes(4); // initial + 3 rounds
  });

  it('get_user_stats returns "not linked" when userId is null', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_user_stats', 'tu-9'))
      .mockResolvedValueOnce(makeTextResponse('Hujaunganisha akaunti.'));

    await svc.reply(
      'What is my PR?',
      { userId: null, displayName: 'Guest' },
      single(group.id)
    );

    expect(lastToolResult(1).content).toContain('not linked');
  });

  it('get_group_treasury returns "not found" when no treasury exists', async () => {
    const emptyGroup = await seedGroup(INT_WARD_ID);

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_group_treasury', 'tu-10'))
      .mockResolvedValueOnce(makeTextResponse('Hakuna hazina bado.'));

    await svc.reply('Treasury?', BASE_CTX, single(emptyGroup.id));

    expect(lastToolResult(1).content).toContain('No treasuries found');
  });
});

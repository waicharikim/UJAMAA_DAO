/**
 * @file tests/integration/baraza-ai.service.test.ts
 * @description Tests for BarazaAiService — Claude API mocked, tool execution uses real DB.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import {
  BarazaAiService,
  type BarazaUserContext,
} from '../../src/modules/integration/services/baraza-ai.service.js';
import {
  seedLocation,
  seedGroup,
  seedUser,
  INT_WARD_ID,
} from './helpers.js';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeTextResponse(text: string) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
  };
}

function makeToolUseResponse(toolName: string, toolId: string, input: Record<string, unknown> = {}) {
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
  };
}

const BASE_CTX: BarazaUserContext = {
  userId: null,
  displayName: 'TestUser',
};

// ─────────────────────────────────────────────
// isAvailable / fallback
// ─────────────────────────────────────────────

describe('BarazaAiService.isAvailable', () => {
  it('returns false when CLAUDE_API_KEY is not set', () => {
    const saved = process.env.CLAUDE_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    const svc = new BarazaAiService();
    expect(svc.isAvailable).toBe(false);
    process.env.CLAUDE_API_KEY = saved;
  });

  it('returns true when CLAUDE_API_KEY is set', () => {
    process.env.CLAUDE_API_KEY = 'sk-ant-test';
    const svc = new BarazaAiService();
    expect(svc.isAvailable).toBe(true);
    delete process.env.CLAUDE_API_KEY;
  });
});

describe('BarazaAiService.reply — not available', () => {
  it('returns fallback message when API key is absent', async () => {
    const saved = process.env.CLAUDE_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    const svc = new BarazaAiService();
    const reply = await svc.reply('Hello', BASE_CTX, 'group-1');
    expect(reply).toMatch(/BarazaBot AI si available/);
    process.env.CLAUDE_API_KEY = saved;
  });
});

// ─────────────────────────────────────────────
// Basic reply routing
// ─────────────────────────────────────────────

describe('BarazaAiService.reply — basic text response', () => {
  let svc: BarazaAiService;

  beforeEach(() => {
    process.env.CLAUDE_API_KEY = 'sk-ant-test';
    vi.clearAllMocks();
    svc = new BarazaAiService();
  });

  afterEach(() => {
    delete process.env.CLAUDE_API_KEY;
  });

  it('returns Claude text response', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('Karibu! PR ni 15 kwa kila baraza.'));

    const result = await svc.reply('How do I earn PR?', BASE_CTX, 'g1');
    expect(result).toBe('Karibu! PR ni 15 kwa kila baraza.');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('returns fallback when Claude API throws', async () => {
    mockCreate.mockRejectedValue(new Error('rate limit'));
    const result = await svc.reply('Hello', BASE_CTX, 'g1');
    expect(result).toMatch(/BarazaBot AI si available/);
  });

  it('returns fallback when response has no text block', async () => {
    mockCreate.mockResolvedValue({ stop_reason: 'end_turn', content: [] });
    const result = await svc.reply('Hello', BASE_CTX, 'g1');
    expect(result).toMatch(/BarazaBot AI si available/);
  });

  it('injects context header into user message', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('OK'));
    const ctx: BarazaUserContext = {
      userId: 'u1',
      displayName: 'Alice',
      ward: 'Westlands',
      verificationLevel: 'COMMUNITY_VERIFIED',
      participationRights: 120,
      activeElectionCount: 2,
    };

    await svc.reply('Hello', ctx, 'g1');

    const call = mockCreate.mock.calls[0][0];
    const userMsg = call.messages[0].content as string;
    expect(userMsg).toContain('Alice');
    expect(userMsg).toContain('Westlands');
    expect(userMsg).toContain('120');
    expect(userMsg).toContain('Active elections: 2');
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
    process.env.CLAUDE_API_KEY = 'sk-ant-test';
    vi.clearAllMocks();
    svc = new BarazaAiService();
    await seedLocation();
    user = await seedUser(`ai-tool-${Date.now()}@test.com`);
    group = await seedGroup(INT_WARD_ID);
  });

  afterEach(() => {
    delete process.env.CLAUDE_API_KEY;
  });

  it('resolves get_user_stats tool and returns final text', async () => {
    const ctx: BarazaUserContext = { userId: user.id, displayName: user.name ?? 'User' };

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_user_stats', 'tu-1'))
      .mockResolvedValueOnce(makeTextResponse('Una PR 50 na uko EMAIL_VERIFIED.'));

    const result = await svc.reply('What is my PR?', ctx, group.id);
    expect(result).toBe('Una PR 50 na uko EMAIL_VERIFIED.');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Second call must include tool_result
    const secondCall = mockCreate.mock.calls[1][0];
    const lastUserMsg = secondCall.messages[secondCall.messages.length - 1];
    expect(lastUserMsg.role).toBe('user');
    expect(lastUserMsg.content[0].type).toBe('tool_result');
    expect(lastUserMsg.content[0].tool_use_id).toBe('tu-1');
  });

  it('resolves get_group_proposals tool', async () => {
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
      .mockResolvedValueOnce(makeToolUseResponse('get_group_proposals', 'tu-2', { status: 'ACTIVE' }))
      .mockResolvedValueOnce(makeTextResponse('Kuna pendekezo moja linasubiri kukaguliwa.'));

    const result = await svc.reply('Any proposals?', BASE_CTX, group.id);
    expect(result).toContain('pendekezo');

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    const parsed = JSON.parse(toolResult.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].title).toBe('Test Proposal');
  });

  it('resolves get_group_treasury tool', async () => {
    await prisma.groupTreasury.create({
      data: { groupId: group.id, balance: 5000, tokenBalance: 250 },
    });

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_group_treasury', 'tu-3'))
      .mockResolvedValueOnce(makeTextResponse('Treasury ina KES 5,000.'));

    await svc.reply('What is in the treasury?', BASE_CTX, group.id);

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.kesBalance).toBe(5000);
    expect(parsed.utBalance).toBe(250);
  });

  it('resolves get_election_results tool', async () => {
    const { seedElection } = await import('../elections/helpers.js');
    await seedElection(group.id, 'NOMINATIONS_OPEN');

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_election_results', 'tu-4'))
      .mockResolvedValueOnce(makeTextResponse('Kuna uchaguzi unaoendelea.'));

    await svc.reply('Any elections?', BASE_CTX, group.id);

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.activeElections).toHaveLength(1);
    expect(parsed.activeElections[0].status).toBe('NOMINATIONS_OPEN');
    expect(parsed.activeElections[0].role).toBe('LEADER');
  });

  it('resolves get_ward_stats tool', async () => {
    // Add user as member of group
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER', active: true },
    });

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_ward_stats', 'tu-5'))
      .mockResolvedValueOnce(makeTextResponse('Kuna wanachama 1 katika kata.'));

    await svc.reply('How many members?', BASE_CTX, group.id);

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.members).toBeGreaterThanOrEqual(1);
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
      .mockResolvedValueOnce(makeToolUseResponse('search_past_decisions', 'tu-6', { query: 'borehole' }))
      .mockResolvedValueOnce(makeTextResponse('Mnamo 2025 mliamua kutengeneza kisima.'));

    await svc.reply('What did we decide about the borehole?', BASE_CTX, group.id);

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    const parsed = JSON.parse(toolResult.content);
    expect(parsed[0].title).toContain('Borehole');
    expect(parsed[0].outcome).toBe('APPROVED');
  });

  it('returns "no match" when search_past_decisions finds nothing', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('search_past_decisions', 'tu-7', { query: 'nonexistent xyz' }))
      .mockResolvedValueOnce(makeTextResponse('Sikupata maamuzi yanayohusiana na hilo.'));

    await svc.reply('Any past decisions about nonexistent xyz?', BASE_CTX, group.id);

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    expect(toolResult.content).toContain('No past decisions found');
  });

  it('handles unknown tool gracefully', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('unknown_tool', 'tu-8'))
      .mockResolvedValueOnce(makeTextResponse('I could not retrieve that information.'));

    const result = await svc.reply('Hello', BASE_CTX, group.id);
    expect(result).toBe('I could not retrieve that information.');

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    expect(toolResult.content).toContain('Unknown tool');
  });

  it('caps tool rounds at MAX_TOOL_ROUNDS and returns last text', async () => {
    // Return tool_use 4 times, text on 5th — should stop after round 3 and return fallback
    mockCreate.mockResolvedValue(makeToolUseResponse('get_user_stats', 'tu-loop'));

    const result = await svc.reply('Keep looping', BASE_CTX, group.id);
    // After MAX_TOOL_ROUNDS (3), stop_reason is still tool_use so textBlock is undefined → fallback
    expect(result).toMatch(/BarazaBot AI si available/);
    expect(mockCreate).toHaveBeenCalledTimes(4); // initial + 3 rounds
  });

  it('get_user_stats returns "not linked" when userId is null', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_user_stats', 'tu-9'))
      .mockResolvedValueOnce(makeTextResponse('Hujaunganisha akaunti.'));

    await svc.reply('What is my PR?', { userId: null, displayName: 'Guest' }, group.id);

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    expect(toolResult.content).toContain('not linked');
  });

  it('get_group_treasury returns "not found" when treasury does not exist', async () => {
    const emptyGroup = await seedGroup(INT_WARD_ID);

    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_group_treasury', 'tu-10'))
      .mockResolvedValueOnce(makeTextResponse('Hakuna hazina bado.'));

    await svc.reply('Treasury?', BASE_CTX, emptyGroup.id);

    const secondCall = mockCreate.mock.calls[1][0];
    const toolResult = secondCall.messages[secondCall.messages.length - 1].content[0];
    expect(toolResult.content).toContain('No treasury found');
  });
});

/**
 * @file tests/governance/deliberation.service.test.ts
 * Unit tests for the deliberation layer.
 *
 * Two surfaces:
 *  1. rankAnnotations() — pure ranking by net score (no DB, no AI).
 *  2. generateAndStore() — Qwen availability is mocked (core/ai/qwen) so the
 *     test is deterministic regardless of whether DASHSCOPE_API_KEY is set.
 */

const { qwen } = vi.hoisted(() => ({
  qwen: { available: false, completeResult: null as string | null },
}));

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

// Mock the Qwen client so AI availability is deterministic in tests, regardless
// of whether DASHSCOPE_API_KEY is set in the environment.
vi.mock('../../src/core/ai/qwen.js', () => ({
  getQwenClient: () => (qwen.available ? {} : null),
  getClaudeClient: () => (qwen.available ? {} : null),
  complete: async () => qwen.completeResult,
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProposalStatus } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import {
  deliberationService,
  rankAnnotations,
} from '../../src/modules/governance/services/deliberation.service.js';
import {
  createGovernanceUser,
  seedGovernanceGroup,
  seedProposal,
} from './helpers.js';

describe('rankAnnotations()', () => {
  const make = (comment: string, upvotes: number, downvotes: number) => ({
    comment,
    quotedText: 'q',
    fieldKey: 'rationale',
    upvotes,
    downvotes,
  });

  it('sorts by net score (upvotes - downvotes) descending', () => {
    const ranked = rankAnnotations([
      make('low', 1, 0), // net 1
      make('high', 8, 1), // net 7
      make('mid', 5, 2), // net 3
    ]);
    expect(ranked.map((a) => a.comment)).toEqual(['high', 'mid', 'low']);
  });

  it('respects topN', () => {
    const ranked = rankAnnotations(
      [make('a', 5, 0), make('b', 4, 0), make('c', 3, 0)],
      2
    );
    expect(ranked.map((a) => a.comment)).toEqual(['a', 'b']);
  });

  it('handles negative net scores', () => {
    const ranked = rankAnnotations([make('hated', 0, 5), make('liked', 3, 0)]);
    expect(ranked.map((a) => a.comment)).toEqual(['liked', 'hated']);
  });
});

describe('deliberationService.generateAndStore()', () => {
  let creatorId: string;
  let proposalId: string;

  beforeEach(async () => {
    qwen.available = false;
    qwen.completeResult = null;
    const creator = await createGovernanceUser(`delib-${Date.now()}@test.com`);
    creatorId = creator.id;
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );
    proposalId = proposal.id;
  });

  async function seedAnnotation() {
    await prisma.proposalAnnotation.create({
      data: {
        proposalId,
        authorId: creatorId,
        fieldKey: 'rationale',
        startOffset: 0,
        endOffset: 10,
        quotedText: 'the budget line',
        comment: 'This budget looks too high for the scope.',
        color: '#3b82f6',
      },
    });
  }

  function readSummary() {
    return prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { deliberationSummary: true, deliberationSummaryAt: true },
    });
  }

  it('stores nothing when the AI is unavailable', async () => {
    qwen.available = false;
    await seedAnnotation();
    await expect(
      deliberationService.generateAndStore(proposalId)
    ).resolves.toBeUndefined();
    const row = await readSummary();
    expect(row?.deliberationSummary).toBeNull();
    expect(row?.deliberationSummaryAt).toBeNull();
  });

  it('stores nothing when AI is available but there are no annotations', async () => {
    qwen.available = true;
    await deliberationService.generateAndStore(proposalId);
    const row = await readSummary();
    expect(row?.deliberationSummary).toBeNull();
  });

  it('stores the neutral digest when AI is available and annotations exist', async () => {
    qwen.available = true;
    qwen.completeResult = JSON.stringify({
      support: ['Members back the borehole'],
      concerns: ['Budget may be too high'],
      openQuestions: ['Who maintains it after handover?'],
    });
    await seedAnnotation();

    await deliberationService.generateAndStore(proposalId);

    const row = await readSummary();
    expect(row?.deliberationSummaryAt).toBeInstanceOf(Date);
    const summary = row?.deliberationSummary as {
      support: string[];
      concerns: string[];
      openQuestions: string[];
    };
    expect(summary.support).toContain('Members back the borehole');
    expect(summary.concerns).toContain('Budget may be too high');
    expect(summary.openQuestions).toContain('Who maintains it after handover?');
  });

  it('does not throw for a non-existent proposal', async () => {
    qwen.available = true;
    await expect(
      deliberationService.generateAndStore(
        '00000000-0000-0000-0000-000000000000'
      )
    ).resolves.toBeUndefined();
  });
});

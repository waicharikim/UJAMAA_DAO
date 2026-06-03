/**
 * @file tests/governance/deliberation.service.test.ts
 * Unit tests for the deliberation layer.
 *
 * Two surfaces:
 *  1. rankAnnotations() — pure ranking by net score (no DB, no AI).
 *  2. generateAndStore() — the dormant path: with no CLAUDE_API_KEY (the test
 *     env never sets it), it must store null and never throw.
 */

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProposalStatus } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import {
  deliberationService,
  rankAnnotations,
} from '../../src/modules/governance/services/deliberation.service.js';
import { getClaudeClient } from '../../src/core/ai/claude.js';
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

describe('deliberationService.generateAndStore() — dormant path', () => {
  let proposalId: string;

  beforeEach(async () => {
    const creator = await createGovernanceUser(`delib-${Date.now()}@test.com`);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );
    proposalId = proposal.id;
  });

  it('Claude is unavailable in the test env (no CLAUDE_API_KEY)', () => {
    expect(getClaudeClient()).toBeNull();
  });

  it('stores no summary and does not throw when the AI is unavailable', async () => {
    await expect(
      deliberationService.generateAndStore(proposalId)
    ).resolves.toBeUndefined();

    const row = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { deliberationSummary: true, deliberationSummaryAt: true },
    });
    expect(row?.deliberationSummary).toBeNull();
    expect(row?.deliberationSummaryAt).toBeNull();
  });

  it('does not throw for a non-existent proposal', async () => {
    await expect(
      deliberationService.generateAndStore(
        '00000000-0000-0000-0000-000000000000'
      )
    ).resolves.toBeUndefined();
  });
});

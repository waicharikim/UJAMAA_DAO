/**
 * @file tests/governance/baraza-deliberation-memory.service.test.ts
 * Tests the deliberation memory feedback loop: recordProposalOutcomeInMemory()
 * back-fills a proposal's real-world outcome into every agent's episodic memory
 * (matched by proposalId, scoped to the deliberation's group).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProposalStatus } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import { recordProposalOutcomeInMemory } from '../../src/modules/governance/baraza/baraza-deliberation.service.js';
import {
  createGovernanceUser,
  seedGovernanceGroup,
  seedProposal,
} from './helpers.js';

const CONTENT_HASH = 'a'.repeat(64);

/** Build an episodic-log entry the way updateAgentMemory() writes it. */
function episode(proposalId: string, title: string, outcome = 'PENDING') {
  return {
    proposalId,
    proposalTitle: title,
    deliberationId: 'd-1',
    date: '2026-06-01',
    roundSummaries: ['r1'],
    finalPosition: 'I held my position.',
    outcome: 'HELD',
    proposalOutcome: outcome,
  };
}

async function seedAgentState(
  groupId: string,
  agentKey: 'UCHUMI' | 'MAISHA',
  episodicLog: unknown[]
) {
  return prisma.barazaAgentState.create({
    data: { groupId, agentKey, episodicLog: episodicLog as never },
  });
}

describe('recordProposalOutcomeInMemory()', () => {
  let groupId: string;
  let proposalId: string;

  beforeEach(async () => {
    const creator = await createGovernanceUser(`delibmem-${Date.now()}@test.com`);
    const group = await seedGovernanceGroup(creator.id);
    groupId = group.id;
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.COMPLETED
    );
    proposalId = proposal.id;

    await prisma.barazaDeliberation.create({
      data: { proposalId, groupId, contentHash: CONTENT_HASH },
    });
  });

  it('back-fills the real outcome into every agent that deliberated this proposal', async () => {
    await seedAgentState(groupId, 'UCHUMI', [episode(proposalId, 'Borehole')]);
    await seedAgentState(groupId, 'MAISHA', [episode(proposalId, 'Borehole')]);

    await recordProposalOutcomeInMemory(
      proposalId,
      'Borehole completed; 500 households served.'
    );

    const states = await prisma.barazaAgentState.findMany({ where: { groupId } });
    expect(states).toHaveLength(2);
    for (const s of states) {
      const log = s.episodicLog as Array<{ proposalOutcome: string }>;
      expect(log[0].proposalOutcome).toBe(
        'Borehole completed; 500 households served.'
      );
    }
  });

  it('only touches the matching proposal, leaving other episodes intact', async () => {
    await seedAgentState(groupId, 'UCHUMI', [
      episode(proposalId, 'This one'),
      episode('99999999-9999-4999-8999-999999999999', 'Another proposal'),
    ]);

    await recordProposalOutcomeInMemory(proposalId, 'Done well.');

    const s = await prisma.barazaAgentState.findFirstOrThrow({
      where: { groupId, agentKey: 'UCHUMI' },
    });
    const log = s.episodicLog as Array<{ proposalOutcome: string }>;
    expect(log[0].proposalOutcome).toBe('Done well.');
    expect(log[1].proposalOutcome).toBe('PENDING'); // untouched
  });

  it('truncates a very long outcome to 300 chars', async () => {
    await seedAgentState(groupId, 'UCHUMI', [episode(proposalId, 'Long')]);
    await recordProposalOutcomeInMemory(proposalId, 'x'.repeat(500));

    const s = await prisma.barazaAgentState.findFirstOrThrow({
      where: { groupId, agentKey: 'UCHUMI' },
    });
    const log = s.episodicLog as Array<{ proposalOutcome: string }>;
    expect(log[0].proposalOutcome).toHaveLength(300);
  });

  it('is a no-op (no throw) when the proposal was never deliberated', async () => {
    await prisma.barazaDeliberation.deleteMany({ where: { proposalId } });
    await seedAgentState(groupId, 'UCHUMI', [episode(proposalId, 'X')]);

    await expect(
      recordProposalOutcomeInMemory(proposalId, 'Done.')
    ).resolves.toBeUndefined();

    const s = await prisma.barazaAgentState.findFirstOrThrow({
      where: { groupId, agentKey: 'UCHUMI' },
    });
    const log = s.episodicLog as Array<{ proposalOutcome: string }>;
    expect(log[0].proposalOutcome).toBe('PENDING'); // unchanged
  });

  it('does not throw on an empty outcome string', async () => {
    await seedAgentState(groupId, 'UCHUMI', [episode(proposalId, 'X')]);
    await expect(
      recordProposalOutcomeInMemory(proposalId, '   ')
    ).resolves.toBeUndefined();
  });
});

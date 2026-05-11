/**
 * @file tests/governance/proposal.memory.test.ts
 * Service unit tests + route integration tests for the proposal memory layer.
 *
 * Covers: updateMemory() and recordOutcome() — added in session 47.
 * auditService mocked throughout.
 */

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { ProposalStatus } from '@prisma/client';
import app, { servicesReady } from '../../src/app.js';
import { proposalService } from '../../src/modules/governance/services/proposal.service.js';
import {
  createGovernanceUser,
  seedGovernanceGroup,
  seedProposal,
  addGroupMember,
  makeGovernanceToken,
} from './helpers.js';

const BASE = '/api/v1/governance';

// ─────────────────────────────────────────────────────────────────────────────
// Service unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ProposalService — updateMemory()', () => {
  let creatorId: string;
  let otherId: string;
  let groupId: string;
  let draftProposalId: string;

  beforeEach(async () => {
    const creator = await createGovernanceUser(`pm-c-${Date.now()}@test.com`);
    const other = await createGovernanceUser(`pm-o-${Date.now()}@test.com`);
    creatorId = creator.id;
    otherId = other.id;
    const group = await seedGovernanceGroup(creatorId);
    groupId = group.id;
    const proposal = await seedProposal(creatorId, groupId, ProposalStatus.DRAFT);
    draftProposalId = proposal.id;
  });

  it('updates rationale and alternatives on a DRAFT proposal', async () => {
    const result = await proposalService.updateMemory(creatorId, draftProposalId, {
      rationale: 'This is why we need this proposal for our ward',
      alternatives: 'We considered option B but chose A because of cost',
    });
    expect(result.rationale).toBe(
      'This is why we need this proposal for our ward'
    );
    expect(result.alternatives).toBe(
      'We considered option B but chose A because of cost'
    );
  });

  it('updates only rationale when alternatives is omitted', async () => {
    const result = await proposalService.updateMemory(creatorId, draftProposalId, {
      rationale: 'Only rationale provided here for testing purposes',
    });
    expect(result.rationale).toBe(
      'Only rationale provided here for testing purposes'
    );
  });

  it('throws 404 for an unknown proposal', async () => {
    await expect(
      proposalService.updateMemory(
        creatorId,
        '00000000-0000-0000-0000-000000000000',
        { rationale: 'Test rationale text' }
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when caller is not the proposal creator', async () => {
    await expect(
      proposalService.updateMemory(otherId, draftProposalId, {
        rationale: 'Unauthorized rationale update attempt',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when proposal is past the DRAFT/PENDING_REVIEW stage', async () => {
    const votingProposal = await seedProposal(
      creatorId,
      groupId,
      ProposalStatus.VOTING
    );
    await expect(
      proposalService.updateMemory(creatorId, votingProposal.id, {
        rationale: 'Too late to update this proposal memory field',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('ProposalService — recordOutcome()', () => {
  let creatorId: string;
  let otherId: string;
  let groupId: string;

  beforeEach(async () => {
    const creator = await createGovernanceUser(`ro-c-${Date.now()}@test.com`);
    const other = await createGovernanceUser(`ro-o-${Date.now()}@test.com`);
    creatorId = creator.id;
    otherId = other.id;
    const group = await seedGovernanceGroup(creatorId);
    groupId = group.id;
  });

  it('records outcome on a PASSED proposal by the creator', async () => {
    const proposal = await seedProposal(
      creatorId,
      groupId,
      ProposalStatus.APPROVED
    );
    const result = await proposalService.recordOutcome(
      creatorId,
      proposal.id,
      'The borehole was drilled and is now serving 200 households in the ward'
    );
    expect(result.outcome).toBe(
      'The borehole was drilled and is now serving 200 households in the ward'
    );
    expect(result.outcomeRecordedAt).not.toBeNull();
  });

  it('records outcome when caller is the group leader (not creator)', async () => {
    const leader = await createGovernanceUser(`ro-l-${Date.now()}@test.com`);
    const leaderGroup = await seedGovernanceGroup(leader.id);
    const proposal = await seedProposal(
      creatorId,
      leaderGroup.id,
      ProposalStatus.APPROVED
    );
    await addGroupMember(creatorId, leaderGroup.id, 'MEMBER');
    const result = await proposalService.recordOutcome(
      leader.id,
      proposal.id,
      'The project was completed successfully by the community members'
    );
    expect(result.outcome).toBeDefined();
  });

  it('throws 404 for an unknown proposal', async () => {
    await expect(
      proposalService.recordOutcome(
        creatorId,
        '00000000-0000-0000-0000-000000000000',
        'An outcome for a nonexistent proposal here'
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when proposal has not passed (status is DRAFT)', async () => {
    const draftProposal = await seedProposal(
      creatorId,
      groupId,
      ProposalStatus.DRAFT
    );
    await expect(
      proposalService.recordOutcome(
        creatorId,
        draftProposal.id,
        'Outcome for a draft proposal which should not be allowed'
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 403 for a user who is neither creator nor leader', async () => {
    const proposal = await seedProposal(
      creatorId,
      groupId,
      ProposalStatus.APPROVED
    );
    await expect(
      proposalService.recordOutcome(
        otherId,
        proposal.id,
        'Unauthorized outcome recording attempt here'
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Proposal Memory Routes', () => {
  let creatorId: string;
  let otherId: string;
  let groupId: string;
  let creatorToken: string;
  let otherToken: string;

  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    const creator = await createGovernanceUser(`pmr-c-${Date.now()}@test.com`);
    const other = await createGovernanceUser(`pmr-o-${Date.now()}@test.com`);
    creatorId = creator.id;
    otherId = other.id;
    const group = await seedGovernanceGroup(creatorId);
    groupId = group.id;
    creatorToken = makeGovernanceToken(creatorId);
    otherToken = makeGovernanceToken(otherId);
  });

  // ── PATCH /:proposalId/memory ─────────────────────────────────────────────

  describe('PATCH /governance/:proposalId/memory', () => {
    it('returns 401 with no auth token', async () => {
      const proposal = await seedProposal(creatorId, groupId, ProposalStatus.DRAFT);
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/memory`)
        .send({ rationale: 'Test rationale for this proposal update' });
      expect(res.status).toBe(401);
    });

    it('returns 200 and updates memory on a DRAFT proposal', async () => {
      const proposal = await seedProposal(creatorId, groupId, ProposalStatus.DRAFT);
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/memory`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          rationale: 'This explains why we need this initiative for our ward',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rationale).toBe(
        'This explains why we need this initiative for our ward'
      );
    });

    it('returns 403 when caller is not the proposal creator', async () => {
      const proposal = await seedProposal(creatorId, groupId, ProposalStatus.DRAFT);
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/memory`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          rationale: 'Unauthorized rationale update attempt here in test',
        });
      expect(res.status).toBe(403);
    });

    it('returns 400 when proposal is past the DRAFT stage', async () => {
      const proposal = await seedProposal(
        creatorId,
        groupId,
        ProposalStatus.VOTING
      );
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/memory`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          rationale: 'Too late to update memory on a voting proposal here',
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when rationale is too short (< 10 chars)', async () => {
      const proposal = await seedProposal(creatorId, groupId, ProposalStatus.DRAFT);
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/memory`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ rationale: 'Short' });
      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /:proposalId/outcome ────────────────────────────────────────────

  describe('PATCH /governance/:proposalId/outcome', () => {
    it('returns 401 with no auth token', async () => {
      const proposal = await seedProposal(
        creatorId,
        groupId,
        ProposalStatus.APPROVED
      );
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/outcome`)
        .send({
          outcome: 'The project was completed and is serving the community',
        });
      expect(res.status).toBe(401);
    });

    it('returns 200 and records outcome on a PASSED proposal', async () => {
      const proposal = await seedProposal(
        creatorId,
        groupId,
        ProposalStatus.APPROVED
      );
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/outcome`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          outcome:
            'The project was completed and is now serving the community well',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outcome).toBeDefined();
      expect(res.body.data.outcomeRecordedAt).toBeDefined();
    });

    it('returns 400 when proposal has not passed', async () => {
      const proposal = await seedProposal(creatorId, groupId, ProposalStatus.DRAFT);
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/outcome`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          outcome: 'Outcome on a draft proposal which should be rejected here',
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when outcome text is too short (< 10 chars)', async () => {
      const proposal = await seedProposal(
        creatorId,
        groupId,
        ProposalStatus.APPROVED
      );
      const res = await request(app)
        .patch(`${BASE}/${proposal.id}/outcome`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ outcome: 'Short' });
      expect(res.status).toBe(400);
    });
  });
});

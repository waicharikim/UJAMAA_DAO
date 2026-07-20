/**
 * @file tests/governance/proposal.lifecycle.test.ts
 * @description Tests for session 61 governance features:
 *   - POST   /governance/:proposalId/cancel
 *   - PATCH  /governance/:proposalId/progress
 *   - proposalService.cancelProposal()
 *   - proposalService.updateProgress()
 *   - processTallyProposals() job
 *   - processExpireProposalReview() job
 *
 * DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks — must appear before all other imports
// ─────────────────────────────────────────────

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

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: {
      send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
  })),
}));

vi.mock(
  '../../src/modules/community/services/groupMembership.service.js',
  () => ({
    groupMembershipService: {
      enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
      updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
      getUserGroups: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getGroupById: vi.fn().mockResolvedValue(null),
    },
  })
);

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { ProposalStatus, ProposalType } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import app, { servicesReady } from '../../src/app.js';
import { proposalService } from '../../src/modules/governance/services/proposal.service.js';
import { treasuryService } from '../../src/modules/treasury/services/treasury.service.js';
import {
  processTallyProposals,
  processExpireProposalReview,
} from '../../src/modules/governance/jobs/proposal.jobs.js';
import {
  createGovernanceUser,
  awardPR,
  seedGovernanceGroup,
  addGroupMember,
  seedProposal,
  seedProjectForProposal,
  makeGovernanceToken,
} from './helpers.js';

const BASE = '/api/v1/governance';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:proposalId/cancel — route tests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /:proposalId/cancel', () => {
  it('returns 200 when creator cancels a DRAFT proposal', async () => {
    const creator = await createGovernanceUser('cancel-draft@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.CANCELLED);
  });

  it('returns 200 when creator cancels a PENDING_REVIEW proposal', async () => {
    const creator = await createGovernanceUser('cancel-pending@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.PENDING_REVIEW
    );

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.CANCELLED);
  });

  it('returns 403 when a non-creator member tries to cancel', async () => {
    const creator = await createGovernanceUser('cancel-creator@example.com');
    const member = await createGovernanceUser('cancel-member@example.com');
    const memberToken = makeGovernanceToken(member.id);
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(member.id, group.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/cancel`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 when creator tries to cancel a VOTING proposal', async () => {
    const creator = await createGovernanceUser('cancel-voting@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown proposalId', async () => {
    const user = await createGovernanceUser('cancel-404@example.com');
    const token = makeGovernanceToken(user.id);
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .post(`${BASE}/${fakeId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(
      `${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/cancel`
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:proposalId/resubmit — route tests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /:proposalId/resubmit', () => {
  it('returns 200 and resets proposal to DRAFT', async () => {
    const creator = await createGovernanceUser('route-resub-ok@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.REJECTED
    );

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/resubmit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.DRAFT);
    expect(updated!.resubmissionCount).toBe(1);
  });

  it('returns 403 when a non-creator tries to resubmit', async () => {
    const creator = await createGovernanceUser('route-resub-owner@example.com');
    const other = await createGovernanceUser('route-resub-other@example.com');
    const otherToken = makeGovernanceToken(other.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.REJECTED
    );

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/resubmit`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 when proposal is not REJECTED', async () => {
    const creator = await createGovernanceUser(
      'route-resub-status@example.com'
    );
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/resubmit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when resubmission cap is reached', async () => {
    const creator = await createGovernanceUser('route-resub-cap@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await prisma.proposal.create({
      data: {
        groupId: group.id,
        creatorId: creator.id,
        title: 'Route cap test proposal for resubmission limit',
        description:
          'Testing that the 3-resubmission cap is enforced at the route level.',
        proposalType: 'COMMUNITY_INITIATIVE',
        proposalScope: 'GROUP',
        status: ProposalStatus.REJECTED,
        resubmissionCount: 3,
      },
    });

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/resubmit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(
      `${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resubmit`
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:proposalId/progress — route tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /:proposalId/progress', () => {
  it('returns 200 when creator moves APPROVED → EXECUTING', async () => {
    const creator = await createGovernanceUser('progress-exec@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(200);

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.EXECUTING);
  });

  it('returns 200 when creator moves EXECUTING → COMPLETED', async () => {
    const creator = await createGovernanceUser('progress-done@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.EXECUTING
    );

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.COMPLETED);
  });

  it('returns 200 when group leader (not creator) moves APPROVED → EXECUTING', async () => {
    const creator = await createGovernanceUser(
      'progress-leader-creator@example.com'
    );
    const leader = await createGovernanceUser('progress-leader@example.com');
    const leaderToken = makeGovernanceToken(leader.id);
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(leader.id, group.id, 'LEADER');
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(200);
  });

  it('returns 403 when a plain member (not creator, not leader) calls progress', async () => {
    const creator = await createGovernanceUser(
      'progress-creator-only@example.com'
    );
    const member = await createGovernanceUser('progress-member@example.com');
    const memberToken = makeGovernanceToken(member.id);
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(member.id, group.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid transition DRAFT → EXECUTING', async () => {
    const creator = await createGovernanceUser(
      'progress-bad-trans@example.com'
    );
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when status field is missing', async () => {
    const creator = await createGovernanceUser(
      'progress-no-status@example.com'
    );
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/progress`)
      .send({ status: 'EXECUTING' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Treasury disbursement on EXECUTING transition
// ─────────────────────────────────────────────────────────────────────────────

async function seedFundedProposal(
  creatorId: string,
  groupId: string,
  fundingAmount: number
) {
  return prisma.proposal.create({
    data: {
      groupId,
      creatorId,
      title: 'Borehole Drilling Proposal',
      description: 'Fund drilling of community borehole.',
      proposalType: ProposalType.COMMUNITY_INITIATIVE,
      proposalScope: 'GROUP',
      status: ProposalStatus.APPROVED,
      groupFundingAmount: fundingAmount,
    },
  });
}

describe('PATCH /:proposalId/progress — treasury disbursement', () => {
  it('debits group treasury when moving APPROVED → EXECUTING with groupFundingAmount set', async () => {
    const creator = await createGovernanceUser('disburse-ok@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    await treasuryService.deposit(group.id, { amount: 50000 }, creator.id);
    const proposal = await seedFundedProposal(creator.id, group.id, 10000);
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(200);

    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(Number(treasury!.balance)).toBe(40000);

    const txn = await prisma.walletTransaction.findFirst({
      where: {
        treasuryId: treasury!.id,
        referenceType: 'PROPOSAL',
        proposalId: proposal.id,
      },
    });
    expect(txn).not.toBeNull();
    expect(txn!.transactionType).toBe('DEBIT');
    expect(Number(txn!.amount)).toBe(10000);
  });

  it('skips disbursement when groupFundingAmount is null (no treasury needed)', async () => {
    const creator = await createGovernanceUser('disburse-null@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(200);
    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(treasury).toBeNull();
  });

  it('returns 400 when treasury has insufficient funds for disbursement', async () => {
    const creator = await createGovernanceUser(
      'disburse-insufficient@example.com'
    );
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    await treasuryService.deposit(group.id, { amount: 500 }, creator.id);
    const proposal = await seedFundedProposal(creator.id, group.id, 10000);
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(400);
    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.APPROVED);
  });

  it('returns 400 when group has no treasury and groupFundingAmount > 0', async () => {
    const creator = await createGovernanceUser(
      'disburse-no-treasury@example.com'
    );
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedFundedProposal(creator.id, group.id, 5000);
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'EXECUTING' });

    expect(res.status).toBe(400);
  });

  it('does not re-debit treasury on EXECUTING → COMPLETED transition', async () => {
    const creator = await createGovernanceUser(
      'disburse-completed@example.com'
    );
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    await treasuryService.deposit(group.id, { amount: 50000 }, creator.id);
    const proposal = await prisma.proposal.create({
      data: {
        groupId: group.id,
        creatorId: creator.id,
        title: 'Already Executing Proposal',
        description: 'Already in execution.',
        proposalType: ProposalType.COMMUNITY_INITIATIVE,
        proposalScope: 'GROUP',
        status: ProposalStatus.EXECUTING,
        groupFundingAmount: 10000,
      },
    });

    const res = await request(app)
      .patch(`${BASE}/${proposal.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId: group.id },
    });
    expect(Number(treasury!.balance)).toBe(50000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelProposal() — service unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('cancelProposal()', () => {
  it('cancels a DRAFT proposal and sets status to CANCELLED', async () => {
    const creator = await createGovernanceUser('svc-cancel-draft@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    const result = await proposalService.cancelProposal(
      creator.id,
      proposal.id
    );

    expect(result.status).toBe(ProposalStatus.CANCELLED);

    const db = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    expect(db!.status).toBe(ProposalStatus.CANCELLED);
  });

  it('cancels a PENDING_REVIEW proposal', async () => {
    const creator = await createGovernanceUser('svc-cancel-review@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.PENDING_REVIEW
    );

    const result = await proposalService.cancelProposal(
      creator.id,
      proposal.id
    );

    expect(result.status).toBe(ProposalStatus.CANCELLED);
  });

  it('throws 403 when a non-creator tries to cancel', async () => {
    const creator = await createGovernanceUser('svc-cancel-403-c@example.com');
    const other = await createGovernanceUser('svc-cancel-403-o@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    await expect(
      proposalService.cancelProposal(other.id, proposal.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when trying to cancel a VOTING proposal', async () => {
    const creator = await createGovernanceUser('svc-cancel-voting@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    await expect(
      proposalService.cancelProposal(creator.id, proposal.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for an unknown proposalId', async () => {
    const user = await createGovernanceUser('svc-cancel-404@example.com');
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await expect(
      proposalService.cancelProposal(user.id, fakeId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateProgress() — service unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('updateProgress()', () => {
  it('advances APPROVED → EXECUTING (creator)', async () => {
    const creator = await createGovernanceUser('svc-prog-exec@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const result = await proposalService.updateProgress(
      creator.id,
      proposal.id,
      {
        status: 'EXECUTING',
      }
    );

    expect(result.status).toBe(ProposalStatus.EXECUTING);
  });

  it('advances EXECUTING → COMPLETED (creator)', async () => {
    const creator = await createGovernanceUser('svc-prog-done@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.EXECUTING
    );

    const result = await proposalService.updateProgress(
      creator.id,
      proposal.id,
      {
        status: 'COMPLETED',
        note: 'Borehole drilled and commissioned',
      }
    );

    expect(result.status).toBe(ProposalStatus.COMPLETED);
    // note is stored in the outcome field
    const db = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    expect(db!.outcome).toBe('Borehole drilled and commissioned');
  });

  it('allows a group leader (not creator) to advance APPROVED → EXECUTING', async () => {
    const creator = await createGovernanceUser('svc-prog-ldr-c@example.com');
    const leader = await createGovernanceUser('svc-prog-ldr-l@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(leader.id, group.id, 'LEADER');
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await seedProjectForProposal(proposal.id, creator.id, group.id);

    const result = await proposalService.updateProgress(
      leader.id,
      proposal.id,
      {
        status: 'EXECUTING',
      }
    );

    expect(result.status).toBe(ProposalStatus.EXECUTING);
  });

  it('throws 403 when neither creator nor leader calls updateProgress', async () => {
    const creator = await createGovernanceUser('svc-prog-403-c@example.com');
    const outsider = await createGovernanceUser('svc-prog-403-o@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(outsider.id, group.id); // MEMBER, not LEADER
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );

    await expect(
      proposalService.updateProgress(outsider.id, proposal.id, {
        status: 'EXECUTING',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 for an invalid transition (DRAFT → EXECUTING)', async () => {
    const creator = await createGovernanceUser('svc-prog-400@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    await expect(
      proposalService.updateProgress(creator.id, proposal.id, {
        status: 'EXECUTING',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── POLICY proposals: decision recorded, never executed ───────────────────

  it('POLICY: completes APPROVED → COMPLETED with a required outcome note', async () => {
    const creator = await createGovernanceUser('svc-policy-done@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { kind: 'POLICY' },
    });

    const result = await proposalService.updateProgress(
      creator.id,
      proposal.id,
      {
        status: 'COMPLETED',
        note: 'The no-littering by-law was adopted by community vote.',
      }
    );

    expect(result.status).toBe(ProposalStatus.COMPLETED);
    const db = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    expect(db!.outcome).toBe(
      'The no-littering by-law was adopted by community vote.'
    );
  });

  it('POLICY: rejects completion without an outcome note (400)', async () => {
    const creator = await createGovernanceUser('svc-policy-noout@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { kind: 'POLICY' },
    });

    await expect(
      proposalService.updateProgress(creator.id, proposal.id, {
        status: 'COMPLETED',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('POLICY: cannot be EXECUTED (400)', async () => {
    const creator = await createGovernanceUser('svc-policy-exec@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { kind: 'POLICY' },
    });

    await expect(
      proposalService.updateProgress(creator.id, proposal.id, {
        status: 'EXECUTING',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('PROJECT: blocked from EXECUTING until a project is set up (400)', async () => {
    const creator = await createGovernanceUser('svc-gate-noproj@example.com');
    const group = await seedGovernanceGroup(creator.id);
    // PROJECT-kind (default), APPROVED, but no project created yet.
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED
    );

    await expect(
      proposalService.updateProgress(creator.id, proposal.id, {
        status: 'EXECUTING',
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    // After the setup gate (a project exists), the transition succeeds.
    await seedProjectForProposal(proposal.id, creator.id, group.id);
    const result = await proposalService.updateProgress(
      creator.id,
      proposal.id,
      {
        status: 'EXECUTING',
      }
    );
    expect(result.status).toBe(ProposalStatus.EXECUTING);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processTallyProposals() — job unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('processTallyProposals()', () => {
  it('tallies an expired VOTING proposal — quorum met → APPROVED', async () => {
    const creator = await createGovernanceUser('tally-job-ok@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    // Move voting end to the past so the job picks it up
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { votingEndsAt: new Date(Date.now() - 1000) },
    });

    // Cast one YES vote — creator is the only member so voterCount/totalEligible = 1/1 >= 0.4
    await awardPR(creator.id, 50);
    await prisma.groupMemberVote.create({
      data: {
        groupId: group.id,
        memberId: creator.id,
        proposalId: proposal.id,
        vote: true,
        voteWeight: 50,
      },
    });

    await processTallyProposals();

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.APPROVED);
  });

  it('does not tally a VOTING proposal whose votingEndsAt is in the future', async () => {
    const creator = await createGovernanceUser('tally-job-future@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );
    // votingEndsAt is set to +7 days by seedProposal — leave it unchanged

    await processTallyProposals();

    const unchanged = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(unchanged!.status).toBe(ProposalStatus.VOTING);
  });

  it('completes without error when there are no expired VOTING proposals', async () => {
    // DB has no proposals at all after truncation
    await expect(processTallyProposals()).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processExpireProposalReview() — job unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('processExpireProposalReview()', () => {
  it('auto-rejects a PENDING_REVIEW proposal older than 30 days', async () => {
    const creator = await createGovernanceUser('expire-job-old@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.PENDING_REVIEW
    );

    // Set updatedAt to 31 days ago via raw SQL (Prisma @updatedAt cannot be set directly)
    const pastDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE "Proposal" SET "updatedAt" = ${pastDate} WHERE id = ${proposal.id}::uuid`;

    await processExpireProposalReview();

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.REJECTED);
    expect(updated!.reviewNote).toContain('expired');
  });

  it('does not reject a recent PENDING_REVIEW proposal', async () => {
    const creator = await createGovernanceUser('expire-job-new@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.PENDING_REVIEW
    );
    // updatedAt is just set to now() — within 30-day window

    await processExpireProposalReview();

    const unchanged = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(unchanged!.status).toBe(ProposalStatus.PENDING_REVIEW);
  });

  it('completes without error when there are no stale reviews', async () => {
    await expect(processExpireProposalReview()).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resubmitProposal() — service unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('resubmitProposal()', () => {
  it('resets a REJECTED proposal to DRAFT and increments resubmissionCount', async () => {
    const creator = await createGovernanceUser('resub-basic@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.REJECTED
    );

    const result = await proposalService.resubmitProposal(
      creator.id,
      proposal.id
    );

    expect(result.status).toBe(ProposalStatus.DRAFT);
    expect(result.resubmissionCount).toBe(1);
  });

  it('clears voting fields on resubmission', async () => {
    const creator = await createGovernanceUser('resub-voting@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await prisma.proposal.create({
      data: {
        groupId: group.id,
        creatorId: creator.id,
        title: 'Resubmit voting clear test',
        description: 'Testing that voting fields are cleared on resubmission.',
        proposalType: 'COMMUNITY_INITIATIVE',
        proposalScope: 'GROUP',
        status: ProposalStatus.REJECTED,
        votesFor: 5,
        votesAgainst: 10,
        votingStartsAt: new Date(),
        votingEndsAt: new Date(),
        reviewNote: 'Did not achieve quorum.',
        reviewedById: creator.id,
      },
    });

    const result = await proposalService.resubmitProposal(
      creator.id,
      proposal.id
    );

    expect(result.votesFor).toBe(0);
    expect(result.votesAgainst).toBe(0);
    expect(result.votingStartsAt).toBeNull();
    expect(result.votingEndsAt).toBeNull();
    expect(result.reviewedById).toBeNull();
    // reviewNote is kept so creator can see why it was rejected
    expect(result.reviewNote).toBe('Did not achieve quorum.');
  });

  it('throws 403 if a non-creator tries to resubmit', async () => {
    const creator = await createGovernanceUser(
      'resub-auth-creator@example.com'
    );
    const other = await createGovernanceUser('resub-auth-other@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.REJECTED
    );

    await expect(
      proposalService.resubmitProposal(other.id, proposal.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 if proposal is not REJECTED', async () => {
    const creator = await createGovernanceUser('resub-status@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    await expect(
      proposalService.resubmitProposal(creator.id, proposal.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when resubmissionCount has reached 3', async () => {
    const creator = await createGovernanceUser('resub-cap@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await prisma.proposal.create({
      data: {
        groupId: group.id,
        creatorId: creator.id,
        title: 'Resubmission cap test proposal',
        description:
          'Testing that the 3-resubmission cap is enforced correctly.',
        proposalType: 'COMMUNITY_INITIATIVE',
        proposalScope: 'GROUP',
        status: ProposalStatus.REJECTED,
        resubmissionCount: 3,
      },
    });

    await expect(
      proposalService.resubmitProposal(creator.id, proposal.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

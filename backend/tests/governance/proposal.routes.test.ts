/**
 * @file tests/governance/proposal.routes.test.ts
 * @description Supertest integration tests for governance module routes.
 *
 * Routes under test:
 *   GET    /governance
 *   GET    /governance/:proposalId
 *   POST   /governance/create
 *   POST   /governance/start-voting
 *   POST   /governance/vote
 *   POST   /governance/:proposalId/tally
 *
 * All routes require authenticate (valid JWT). No verificationLevel gate.
 * DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
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
      send: vi
        .fn()
        .mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
  })),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
    updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
    getUserGroups: vi.fn().mockResolvedValue([]),
    getGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupById: vi.fn().mockResolvedValue(null),
  },
}));

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { ProposalStatus } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import app, { servicesReady } from '../../src/app.js';
import {
  createGovernanceUser,
  awardPR,
  seedGovernanceGroup,
  addGroupMember,
  seedProposal,
  makeGovernanceToken,
} from './helpers.js';

const BASE = '/api/v1/governance';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /governance
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /governance', () => {
  it('returns 200 with an empty proposals list when none exist', async () => {
    const user = await createGovernanceUser('list-empty@example.com');
    const token = makeGovernanceToken(user.id);

    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.proposals).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('returns 200 with proposals matching a status filter', async () => {
    const user = await createGovernanceUser('list-filter@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    await seedProposal(user.id, group.id, ProposalStatus.DRAFT);
    await seedProposal(user.id, group.id, ProposalStatus.VOTING);

    const res = await request(app)
      .get(`${BASE}?status=VOTING`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.proposals[0].status).toBe('VOTING');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /governance/:proposalId
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /governance/:proposalId', () => {
  it('returns 200 with the proposal and votesSummary', async () => {
    const user = await createGovernanceUser('get-single@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id);

    const res = await request(app)
      .get(`${BASE}/${proposal.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(proposal.id);
    expect(res.body.data.votesSummary).toBeDefined();
    expect(res.body.data.votesSummary.total).toBe(0);
  });

  it('returns 404 for a non-existent proposalId', async () => {
    const user = await createGovernanceUser('get-404@example.com');
    const token = makeGovernanceToken(user.id);
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .get(`${BASE}/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get(
      `${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /governance/create
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /governance/create', () => {
  it('returns 200 and creates a DRAFT proposal', async () => {
    const user = await createGovernanceUser('create-ok@example.com');
    const token = makeGovernanceToken(user.id);
    const other = await createGovernanceUser('create-other@example.com');
    const group = await seedGovernanceGroup(user.id);
    await addGroupMember(other.id, group.id);
    await awardPR(user.id, 200);

    const res = await request(app)
      .post(`${BASE}/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        groupId: group.id,
        title: 'Build a community borehole for the ward',
        description:
          'We propose building a borehole to serve the community. The borehole will provide clean water to over 500 households currently walking 3km to the nearest river.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.groupId).toBe(group.id);
  });

  it('returns 400 when title is too short (< 10 chars)', async () => {
    const user = await createGovernanceUser('create-short-title@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);

    const res = await request(app)
      .post(`${BASE}/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        groupId: group.id,
        title: 'Short',
        description:
          'A description that is certainly long enough for validation but the title is too short.',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when description is too short (< 50 chars)', async () => {
    const user = await createGovernanceUser('create-short-desc@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);

    const res = await request(app)
      .post(`${BASE}/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        groupId: group.id,
        title: 'A valid title of sufficient length',
        description: 'Too short.',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when groupId is not a valid UUID', async () => {
    const user = await createGovernanceUser('create-bad-uuid@example.com');
    const token = makeGovernanceToken(user.id);

    const res = await request(app)
      .post(`${BASE}/create`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        groupId: 'not-a-uuid',
        title: 'A valid title of sufficient length',
        description:
          'A detailed description that meets the minimum length requirement for the validation schema.',
      });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/create`)
      .send({ groupId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'X', description: 'Y' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /governance/start-voting
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /governance/start-voting', () => {
  it('returns 200 and transitions APPROVED_FOR_VOTING proposal to VOTING', async () => {
    const user = await createGovernanceUser('sv-ok@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(
      user.id,
      group.id,
      ProposalStatus.APPROVED_FOR_VOTING
    );

    const res = await request(app)
      .post(`${BASE}/start-voting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id });

    expect(res.status).toBe(200);
    expect(res.body.data.startsAt).toBeDefined();
    expect(res.body.data.endsAt).toBeDefined();

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.VOTING);
  });

  it('returns 400 when proposal is not in APPROVED_FOR_VOTING status', async () => {
    const user = await createGovernanceUser('sv-not-draft@example.com');
    const token = makeGovernanceToken(user.id);
    const group = await seedGovernanceGroup(user.id);
    const proposal = await seedProposal(user.id, group.id, ProposalStatus.DRAFT);

    const res = await request(app)
      .post(`${BASE}/start-voting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id });

    expect(res.status).toBe(400);
  });

  it('returns 400 when proposalId is not a valid UUID', async () => {
    const user = await createGovernanceUser('sv-bad-uuid@example.com');
    const token = makeGovernanceToken(user.id);

    const res = await request(app)
      .post(`${BASE}/start-voting`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/start-voting`)
      .send({ proposalId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /governance/vote
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /governance/vote', () => {
  it('returns 200 and records a YES vote', async () => {
    const creator = await createGovernanceUser('vote-creator@example.com');
    const voter = await createGovernanceUser('vote-voter@example.com');
    const token = makeGovernanceToken(voter.id);
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    const res = await request(app)
      .post(`${BASE}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id, option: 'YES' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const voteRow = await prisma.groupMemberVote.findFirst({
      where: { proposalId: proposal.id, memberId: voter.id },
    });
    expect(voteRow).not.toBeNull();
  });

  it('returns 409 when the same user votes twice', async () => {
    const creator = await createGovernanceUser('vote-dup-creator@example.com');
    const voter = await createGovernanceUser('vote-dup-voter@example.com');
    const token = makeGovernanceToken(voter.id);
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    await request(app)
      .post(`${BASE}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id, option: 'YES' });

    const res = await request(app)
      .post(`${BASE}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id, option: 'NO' });

    expect(res.status).toBe(409);
  });

  it('returns 400 when option is invalid', async () => {
    const user = await createGovernanceUser('vote-bad-option@example.com');
    const token = makeGovernanceToken(user.id);

    const res = await request(app)
      .post(`${BASE}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        proposalId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        option: 'MAYBE',
      });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/vote`)
      .send({
        proposalId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        option: 'YES',
      });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /governance/:proposalId/tally
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /governance/:proposalId/tally', () => {
  it('returns 200 and tallies a VOTING proposal', async () => {
    const creator = await createGovernanceUser('tally-r-creator@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    // Seed a high-weight YES vote so quorum is met
    await prisma.groupMemberVote.create({
      data: {
        groupId: group.id,
        memberId: creator.id,
        proposalId: proposal.id,
        vote: true,
        voteWeight: 5000,
      },
    });

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/tally`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.newStatus).toBe('APPROVED');
  });

  it('returns 404 for a non-existent proposalId', async () => {
    const user = await createGovernanceUser('tally-404@example.com');
    const token = makeGovernanceToken(user.id);
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .post(`${BASE}/${fakeId}/tally`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(
      `${BASE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/tally`
    );
    expect(res.status).toBe(401);
  });

  it('returns REJECTED when quorum is not met', async () => {
    const creator = await createGovernanceUser('tally-rej-creator@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);
    // Add extra members so quorum threshold is high
    for (let i = 0; i < 5; i++) {
      const m = await createGovernanceUser(`tally-rej-m${i}@example.com`);
      await addGroupMember(m.id, group.id);
    }
    const proposal = await seedProposal(creator.id, group.id, ProposalStatus.VOTING);
    // No votes cast → totalVoteWeight=0 → quorum fails

    const res = await request(app)
      .post(`${BASE}/${proposal.id}/tally`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.newStatus).toBe('REJECTED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional coverage — vote options, missing fields, filters, auth guard
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /governance/vote — NO and ABSTAIN options', () => {
  async function setupVoter(emailPrefix: string) {
    const creator = await createGovernanceUser(`${emailPrefix}-creator@example.com`);
    const voter = await createGovernanceUser(`${emailPrefix}-voter@example.com`);
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);
    const proposal = await seedProposal(creator.id, group.id, ProposalStatus.VOTING);
    return { voter, proposal, token: makeGovernanceToken(voter.id) };
  }

  it('returns 200 and records a NO vote', async () => {
    const { token, proposal } = await setupVoter('route-no');

    const res = await request(app)
      .post(`${BASE}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id, option: 'NO' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const voteRow = await prisma.groupMemberVote.findFirst({
      where: { proposalId: proposal.id },
    });
    expect(voteRow).not.toBeNull();
    expect(voteRow!.vote).toBe(false);
  });

  it('returns 200 and records an ABSTAIN vote (stored as vote=false)', async () => {
    const { token, proposal } = await setupVoter('route-abstain');

    const res = await request(app)
      .post(`${BASE}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id, option: 'ABSTAIN' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const voteRow = await prisma.groupMemberVote.findFirst({
      where: { proposalId: proposal.id },
    });
    expect(voteRow).not.toBeNull();
    expect(voteRow!.vote).toBe(false);
  });

  it('returns 400 when proposalId is missing', async () => {
    const user = await createGovernanceUser('vote-noid@example.com');
    const token = makeGovernanceToken(user.id);

    const res = await request(app)
      .post(`${BASE}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ option: 'YES' });

    expect(res.status).toBe(400);
  });
});

describe('GET /governance — groupId filter and pagination', () => {
  it('filters proposals by groupId', async () => {
    const creator = await createGovernanceUser('route-filter-grp@example.com');
    const token = makeGovernanceToken(creator.id);
    const groupA = await seedGovernanceGroup(creator.id);
    const groupB = await prisma.group.create({
      data: {
        name: 'Route Filter Group B',
        description: 'Second group for route filter test',
        isSystemGroup: false,
        locationScope: 'WARD',
        voluntaryType: 'SAVINGS_CREDIT',
      },
    });
    await prisma.groupMember.create({
      data: {
        userId: creator.id,
        groupId: groupB.id,
        role: 'LEADER',
        autoEnrolled: false,
        canLeave: true,
        joinedAt: new Date(),
        active: true,
      },
    });

    await seedProposal(creator.id, groupA.id, ProposalStatus.DRAFT, 'Group A proposal');
    await seedProposal(creator.id, groupB.id, ProposalStatus.DRAFT, 'Group B proposal');

    const res = await request(app)
      .get(`${BASE}?groupId=${groupA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.proposals[0].groupId).toBe(groupA.id);
  });

  it('respects limit and offset query params', async () => {
    const creator = await createGovernanceUser('route-page@example.com');
    const token = makeGovernanceToken(creator.id);
    const group = await seedGovernanceGroup(creator.id);

    for (let i = 1; i <= 4; i++) {
      await seedProposal(creator.id, group.id, ProposalStatus.DRAFT, `Paginated Proposal ${i}`);
    }

    const res = await request(app)
      .get(`${BASE}?limit=2&offset=0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.proposals).toHaveLength(2);
    expect(res.body.data.total).toBe(4);
  });
});

describe('POST /governance/start-voting — non-leader forbidden', () => {
  it('returns 403 when a non-LEADER member tries to start voting', async () => {
    const creator = await createGovernanceUser('sv-creator2@example.com');
    const member = await createGovernanceUser('sv-member2@example.com');
    const memberToken = makeGovernanceToken(member.id);
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(member.id, group.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED_FOR_VOTING
    );

    const res = await request(app)
      .post(`${BASE}/start-voting`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ proposalId: proposal.id });

    expect(res.status).toBe(403);
  });
});

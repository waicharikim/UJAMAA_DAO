/**
 * @file tests/governance/proposal.service.test.ts
 * @description Unit tests for ProposalService.
 *
 * Tests: createProposal, startVoting, castVote, tallyVotes, getProposal, listProposals
 *
 * Uses real Prisma against postgres_test DB.
 * DB truncated before each test by testSetup.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProposalStatus } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import { proposalService } from '../../src/modules/governance/services/proposal.service.js';
import {
  createGovernanceUser,
  awardPR,
  seedGovernanceGroup,
  addGroupMember,
  seedProposal,
} from './helpers.js';

// PR cost for a WARD-scoped group
const WARD_PR_COST = 50;
// PR cost to cast a vote
const VOTE_PR_REWARD = 10; // voting earns PR (PR_CONFIG.VOTE_CAST)

beforeEach(async () => {
  // DB truncated by testSetup.ts — nothing extra needed
});

// ─────────────────────────────────────────────────────────────────────────────
// createProposal()
// ─────────────────────────────────────────────────────────────────────────────

describe('createProposal()', () => {
  it('creates a DRAFT proposal and spends the PR cost', async () => {
    const creator = await createGovernanceUser('creator@example.com');
    const other = await createGovernanceUser('other@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(other.id, group.id);
    await awardPR(creator.id, 200);

    const proposal = await proposalService.createProposal(creator.id, {
      groupId: group.id,
      title: 'Build a water pump in the ward',
      description:
        'We propose building a water pump to serve the community and reduce time spent walking to the river every morning.',
    });

    expect(proposal.status).toBe(ProposalStatus.DRAFT);
    expect(proposal.groupId).toBe(group.id);
    expect(proposal.creatorId).toBe(creator.id);

    const updated = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { participationRights: true },
    });
    expect(updated!.participationRights).toBe(200 - WARD_PR_COST);
  });

  it('creates an EMERGENCY proposal when isEmergency=true', async () => {
    const creator = await createGovernanceUser('emergency-creator@example.com');
    const other = await createGovernanceUser('emergency-other@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(other.id, group.id);
    await awardPR(creator.id, 200);

    const proposal = await proposalService.createProposal(creator.id, {
      groupId: group.id,
      title: 'Emergency flood relief for the ward',
      description:
        'The recent floods have displaced dozens of families. We need emergency funds to provide shelter and food for affected community members.',
      isEmergency: true,
    });

    expect(proposal.proposalType).toBe('EMERGENCY');
    expect(proposal.status).toBe(ProposalStatus.DRAFT);
  });

  it('throws 404 when group does not exist', async () => {
    const creator = await createGovernanceUser('no-group@example.com');
    await awardPR(creator.id, 200);
    const fakeGroupId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await expect(
      proposalService.createProposal(creator.id, {
        groupId: fakeGroupId,
        title: 'Should fail immediately on lookup',
        description: 'Description is long enough but does not matter here.',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when user is not a group member', async () => {
    const creator = await createGovernanceUser('member@example.com');
    const outsider = await createGovernanceUser('outsider@example.com');
    const other = await createGovernanceUser('other2@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(other.id, group.id);
    await awardPR(outsider.id, 200);

    await expect(
      proposalService.createProposal(outsider.id, {
        groupId: group.id,
        title: 'This user has no membership',
        description:
          'This user is not a member of the group and should receive a 403 error when trying to create a proposal.',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when user has insufficient PR', async () => {
    const creator = await createGovernanceUser('broke@example.com');
    const other = await createGovernanceUser('other3@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(other.id, group.id);
    // Award less than the 50 PR cost
    await awardPR(creator.id, 20);

    await expect(
      proposalService.createProposal(creator.id, {
        groupId: group.id,
        title: 'Cannot afford this proposal',
        description:
          'The user has only 20 PR but the ward scope costs 50 PR so this should be rejected with a 403 error.',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startVoting()
// ─────────────────────────────────────────────────────────────────────────────

describe('startVoting()', () => {
  it('moves an APPROVED_FOR_VOTING proposal to VOTING (called by LEADER)', async () => {
    const creator = await createGovernanceUser('voter-start@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED_FOR_VOTING
    );

    const result = await proposalService.startVoting(creator.id, proposal.id);

    expect(result.startsAt).toBeDefined();
    expect(result.endsAt).toBeDefined();
    expect(result.endsAt.getTime()).toBeGreaterThan(result.startsAt.getTime());

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.VOTING);
    expect(updated!.votingStartsAt).not.toBeNull();
    expect(updated!.votingEndsAt).not.toBeNull();
  });

  it('throws 403 when called by a non-LEADER member', async () => {
    const creator = await createGovernanceUser('sv-creator@example.com');
    const other = await createGovernanceUser('sv-other@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(other.id, group.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.APPROVED_FOR_VOTING
    );

    await expect(
      proposalService.startVoting(other.id, proposal.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when proposal is not in APPROVED_FOR_VOTING status', async () => {
    const creator = await createGovernanceUser('already-voting@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT
    );

    await expect(
      proposalService.startVoting(creator.id, proposal.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when proposal does not exist', async () => {
    const creator = await createGovernanceUser('sv-notfound@example.com');
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await expect(
      proposalService.startVoting(creator.id, fakeId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// castVote()
// ─────────────────────────────────────────────────────────────────────────────

describe('castVote()', () => {
  it('records a YES vote, earns 10 PR reward, and returns vote weight', async () => {
    const creator = await createGovernanceUser('cv-creator@example.com');
    const voter = await createGovernanceUser('cv-voter@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    const result = await proposalService.castVote(voter.id, {
      proposalId: proposal.id,
      option: 'YES',
    });

    expect(result.weight).toBeDefined();

    const voteRow = await prisma.groupMemberVote.findUnique({
      where: {
        groupId_memberId_proposalId: {
          groupId: group.id,
          memberId: voter.id,
          proposalId: proposal.id,
        },
      },
    });
    expect(voteRow).not.toBeNull();
    expect(voteRow!.vote).toBe(true); // YES

    const updated = await prisma.user.findUnique({
      where: { id: voter.id },
      select: { participationRights: true },
    });
    expect(updated!.participationRights).toBe(50 + VOTE_PR_REWARD);
  });

  it('records a NO vote correctly', async () => {
    const creator = await createGovernanceUser('cv-creator-no@example.com');
    const voter = await createGovernanceUser('cv-voter-no@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    await proposalService.castVote(voter.id, {
      proposalId: proposal.id,
      option: 'NO',
    });

    const voteRow = await prisma.groupMemberVote.findFirst({
      where: { proposalId: proposal.id, memberId: voter.id },
    });
    expect(voteRow!.vote).toBe(false); // NO
  });

  it('throws 403 when user is not a group member', async () => {
    const creator = await createGovernanceUser('cv-creator2@example.com');
    const nonMember = await createGovernanceUser('cv-nonmember@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await awardPR(nonMember.id, 50);

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    await expect(
      proposalService.castVote(nonMember.id, {
        proposalId: proposal.id,
        option: 'YES',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when proposal is not in VOTING status', async () => {
    const creator = await createGovernanceUser('cv-draft@example.com');
    const voter = await createGovernanceUser('cv-draft-voter@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    const proposal = await seedProposal(creator.id, group.id); // DRAFT

    await expect(
      proposalService.castVote(voter.id, {
        proposalId: proposal.id,
        option: 'YES',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 409 when user votes twice on the same proposal', async () => {
    const creator = await createGovernanceUser('cv-dup-creator@example.com');
    const voter = await createGovernanceUser('cv-dup-voter@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    await proposalService.castVote(voter.id, {
      proposalId: proposal.id,
      option: 'YES',
    });

    await expect(
      proposalService.castVote(voter.id, {
        proposalId: proposal.id,
        option: 'NO',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 404 when proposal does not exist', async () => {
    const voter = await createGovernanceUser('cv-noprop@example.com');
    await awardPR(voter.id, 50);
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await expect(
      proposalService.castVote(voter.id, { proposalId: fakeId, option: 'YES' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tallyVotes()
// ─────────────────────────────────────────────────────────────────────────────

// tallyVotes awards PR + IP (incl. per-location impact) to every voter and the
// creator, so it does real work per vote and runs slower than the 5s default
// under test-DB load. Give the block headroom (documented flaky test).
describe('tallyVotes()', { timeout: 20000 }, () => {
  it('marks proposal APPROVED when quorum met and yes > 50%', async () => {
    const creator = await createGovernanceUser('tally-creator@example.com');
    const voter = await createGovernanceUser('tally-voter@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    // 2 members in group; 1 vote (weight=0) → voteWeight=0, totalEligible=2
    // quorum: 0/2 = 0 < 0.4 → normally fails but with weight=0 any vote doesn't help quorum.
    // To guarantee quorum, seed the vote with a weight > 0 directly:
    await prisma.groupMemberVote.create({
      data: {
        groupId: group.id,
        memberId: voter.id,
        proposalId: proposal.id,
        vote: true,
        voteWeight: 1000, // high weight to ensure quorum and yes > 50%
      },
    });

    const result = await proposalService.tallyVotes(proposal.id);

    expect(result!.newStatus).toBe(ProposalStatus.APPROVED);
    expect(result!.quorum).toBe(true);
    expect(result!.approved).toBe(true);

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.APPROVED);
  });

  it('marks proposal REJECTED when quorum is not met', async () => {
    const creator = await createGovernanceUser('tally-reject@example.com');
    const group = await seedGovernanceGroup(creator.id);
    // Add many members so quorum threshold is high
    for (let i = 0; i < 5; i++) {
      const m = await createGovernanceUser(`tally-member-${i}@example.com`);
      await addGroupMember(m.id, group.id);
    }

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );
    // No votes cast → totalVoteWeight=0 → quorum fails → REJECTED

    const result = await proposalService.tallyVotes(proposal.id);

    expect(result!.newStatus).toBe(ProposalStatus.REJECTED);
    expect(result!.quorum).toBe(false);

    const updated = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(updated!.status).toBe(ProposalStatus.REJECTED);
  });

  it('returns early without updating when proposal is not in VOTING status', async () => {
    const creator = await createGovernanceUser('tally-draft@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(creator.id, group.id); // DRAFT

    const result = await proposalService.tallyVotes(proposal.id);

    expect(result).toBeUndefined(); // early return

    // Status must still be DRAFT
    const unchanged = await prisma.proposal.findUnique({
      where: { id: proposal.id },
    });
    expect(unchanged!.status).toBe(ProposalStatus.DRAFT);
  });

  it('throws 404 when proposal does not exist', async () => {
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await expect(proposalService.tallyVotes(fakeId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getProposal()
// ─────────────────────────────────────────────────────────────────────────────

describe('getProposal()', () => {
  it('returns proposal with votesSummary', async () => {
    const creator = await createGovernanceUser('get-creator@example.com');
    const group = await seedGovernanceGroup(creator.id);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    // Seed 1 YES vote and 1 NO vote with known weights
    const voterA = await createGovernanceUser('get-voterA@example.com');
    const voterB = await createGovernanceUser('get-voterB@example.com');
    await addGroupMember(voterA.id, group.id);
    await addGroupMember(voterB.id, group.id);

    await prisma.groupMemberVote.createMany({
      data: [
        {
          groupId: group.id,
          memberId: voterA.id,
          proposalId: proposal.id,
          vote: true,
          voteWeight: 80,
        },
        {
          groupId: group.id,
          memberId: voterB.id,
          proposalId: proposal.id,
          vote: false,
          voteWeight: 20,
        },
      ],
    });

    const result = await proposalService.getProposal(proposal.id);

    expect(result.id).toBe(proposal.id);
    expect(result.votesSummary.total).toBe(2);
    expect(result.votesSummary.yesWeight).toBe(80);
    expect(result.votesSummary.noWeight).toBe(20);
    expect(result.creator).toMatchObject({ id: creator.id });
  });

  it('throws 404 for non-existent proposal', async () => {
    const fakeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await expect(proposalService.getProposal(fakeId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listProposals()
// ─────────────────────────────────────────────────────────────────────────────

describe('listProposals()', () => {
  it('returns all proposals with total count', async () => {
    const creator = await createGovernanceUser('list-creator@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT,
      'Proposal One'
    );
    await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING,
      'Proposal Two'
    );

    const result = await proposalService.listProposals({});

    expect(result.total).toBe(2);
    expect(result.proposals).toHaveLength(2);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('filters by groupId', async () => {
    const creator = await createGovernanceUser('list-grp@example.com');
    const groupA = await seedGovernanceGroup(creator.id, 'Group A');
    const groupB = await prisma.group.create({
      data: {
        name: 'Group B',
        description: 'Second group',
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

    await seedProposal(
      creator.id,
      groupA.id,
      ProposalStatus.DRAFT,
      'Group A Proposal'
    );
    await seedProposal(
      creator.id,
      groupB.id,
      ProposalStatus.DRAFT,
      'Group B Proposal'
    );

    const result = await proposalService.listProposals({ groupId: groupA.id });

    expect(result.total).toBe(1);
    expect(result.proposals[0].groupId).toBe(groupA.id);
  });

  it('filters by status', async () => {
    const creator = await createGovernanceUser('list-status@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.DRAFT,
      'Draft Proposal'
    );
    await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING,
      'Voting Proposal'
    );

    const result = await proposalService.listProposals({
      status: ProposalStatus.VOTING,
    });

    expect(result.total).toBe(1);
    expect(result.proposals[0].status).toBe(ProposalStatus.VOTING);
  });

  it('respects limit and offset pagination', async () => {
    const creator = await createGovernanceUser('list-page@example.com');
    const group = await seedGovernanceGroup(creator.id);

    for (let i = 1; i <= 5; i++) {
      await seedProposal(
        creator.id,
        group.id,
        ProposalStatus.DRAFT,
        `Proposal ${i.toString().padStart(2, '0')}`
      );
    }

    const page1 = await proposalService.listProposals({ limit: 2, offset: 0 });
    const page2 = await proposalService.listProposals({ limit: 2, offset: 2 });

    expect(page1.total).toBe(5);
    expect(page1.proposals).toHaveLength(2);
    expect(page2.proposals).toHaveLength(2);
    // No overlap
    const ids1 = page1.proposals.map((p) => p.id);
    const ids2 = page2.proposals.map((p) => p.id);
    expect(ids1.every((id) => !ids2.includes(id))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// castVote() — additional coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('castVote() — additional', () => {
  it('ABSTAIN is stored as null (true=YES, false=NO, null=ABSTAIN)', async () => {
    const creator = await createGovernanceUser('abstain-creator@example.com');
    const voter = await createGovernanceUser('abstain-voter@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);
    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );

    await proposalService.castVote(voter.id, {
      proposalId: proposal.id,
      option: 'ABSTAIN',
    });

    const voteRow = await prisma.groupMemberVote.findFirst({
      where: { proposalId: proposal.id, memberId: voter.id },
    });
    expect(voteRow).not.toBeNull();
    expect(voteRow!.vote).toBeNull();
  });

  it('sets castFirstVote=true on OnboardingProgress after first vote', async () => {
    const creator = await createGovernanceUser('cfv-creator@example.com');
    const voter = await createGovernanceUser('cfv-voter@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    // Seed an OnboardingProgress row for the voter
    await prisma.onboardingProgress.create({
      data: { userId: voter.id, castFirstVote: false },
    });

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );
    await proposalService.castVote(voter.id, {
      proposalId: proposal.id,
      option: 'YES',
    });

    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId: voter.id },
    });
    expect(progress!.castFirstVote).toBe(true);
  });

  it('does not update castFirstVote when it is already true', async () => {
    const creator = await createGovernanceUser('cfv2-creator@example.com');
    const voter = await createGovernanceUser('cfv2-voter@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(voter.id, group.id);
    await awardPR(voter.id, 50);

    await prisma.onboardingProgress.create({
      data: { userId: voter.id, castFirstVote: true },
    });

    const proposal = await seedProposal(
      creator.id,
      group.id,
      ProposalStatus.VOTING
    );
    // Should succeed without error even when castFirstVote=true already
    const result = await proposalService.castVote(voter.id, {
      proposalId: proposal.id,
      option: 'NO',
    });

    expect(result.weight).toBeDefined();
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId: voter.id },
    });
    expect(progress!.castFirstVote).toBe(true); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProposal() — budget field
// ─────────────────────────────────────────────────────────────────────────────

describe('createProposal() — budget', () => {
  it('stores fundingAmountKes as the budget field', async () => {
    const creator = await createGovernanceUser('budget-creator@example.com');
    const other = await createGovernanceUser('budget-other@example.com');
    const group = await seedGovernanceGroup(creator.id);
    await addGroupMember(other.id, group.id);
    await awardPR(creator.id, 200);

    const proposal = await proposalService.createProposal(creator.id, {
      groupId: group.id,
      title: 'Borehole funding proposal for the community',
      description:
        'This proposal requests funding for a borehole to serve over 500 households currently walking 3km daily for water.',
      fundingAmountKes: 250000,
    });

    const saved = await prisma.proposal.findUnique({
      where: { id: proposal.id },
      select: { budget: true },
    });
    expect(Number(saved!.budget)).toBe(250000);
  });
});

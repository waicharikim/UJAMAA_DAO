/**
 * @file tests/elections/election.service.test.ts
 * Unit tests for ElectionService — full lifecycle coverage.
 */

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { auditService } from '../../src/modules/audit/services/audit.service.js';
import { ElectionService } from '../../src/modules/elections/services/election.service.js';
import { NOMINATION_PR_COST } from '../../src/modules/elections/types.js';
import {
  seedLocation,
  createElectionUser,
  createGroupWithMembers,
  seedElection,
} from './helpers.js';

const svc = new ElectionService();

describe('ElectionService', () => {
  let groupId: string;
  let member1Id: string;
  let member2Id: string;
  let member3Id: string;

  beforeEach(async () => {
    await seedLocation();
    const m1 = await createElectionUser(`elect-m1-${Date.now()}@test.com`, { participationRights: 200 });
    const m2 = await createElectionUser(`elect-m2-${Date.now()}@test.com`, { participationRights: 150 });
    const m3 = await createElectionUser(`elect-m3-${Date.now()}@test.com`, { participationRights: 100 });
    member1Id = m1.id;
    member2Id = m2.id;
    member3Id = m3.id;
    groupId = await createGroupWithMembers([member1Id, member2Id, member3Id]);
  });

  // ─────────────────────────────────────────────
  // createElection
  // ─────────────────────────────────────────────

  describe('createElection', () => {
    it('creates a PENDING election with correct window dates', async () => {
      const before = new Date();
      const { id } = await svc.createElection({
        scope: 'GROUP',
        groupId,
        roleKey: 'LEADER',
      });

      const election = await prisma.election.findUnique({ where: { id } });
      expect(election).not.toBeNull();
      expect(election!.status).toBe('PENDING');
      expect(election!.scope).toBe('GROUP');
      expect(election!.roleKey).toBe('LEADER');
      expect(election!.groupId).toBe(groupId);

      // nominationsOpenAt should be ~3 days from now
      const diff = election!.nominationsOpenAt.getTime() - before.getTime();
      expect(diff).toBeGreaterThan(2.9 * 86400000);
      expect(diff).toBeLessThan(3.1 * 86400000);
    });

    it('calls the audit service with ELECTION_CREATED action', async () => {
      vi.mocked(auditService.log).mockClear();

      const { id } = await svc.createElection({
        scope: 'GROUP',
        groupId,
        roleKey: 'TREASURER',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.anything(),
        'ELECTION_CREATED',
        'Election',
        id,
        expect.any(Object)
      );
    });
  });

  // ─────────────────────────────────────────────
  // openNominations
  // ─────────────────────────────────────────────

  describe('openNominations', () => {
    it('transitions PENDING elections with past nominationsOpenAt to NOMINATIONS_OPEN', async () => {
      // Create a PENDING election with nominationsOpenAt in the past
      const election = await prisma.election.create({
        data: {
          groupId,
          scope: 'GROUP',
          roleKey: 'LEADER',
          status: 'PENDING',
          nominationsOpenAt: new Date(Date.now() - 1000),
          nominationsCloseAt: new Date(Date.now() + 7 * 86400000),
          votingOpenAt: new Date(Date.now() + 7 * 86400000),
          votingCloseAt: new Date(Date.now() + 14 * 86400000),
          termMonths: 12,
        },
      });

      const count = await svc.openNominations();
      expect(count).toBeGreaterThanOrEqual(1);

      const updated = await prisma.election.findUnique({ where: { id: election.id } });
      expect(updated!.status).toBe('NOMINATIONS_OPEN');
    });

    it('does not transition PENDING elections with future nominationsOpenAt', async () => {
      const election = await prisma.election.create({
        data: {
          groupId,
          scope: 'GROUP',
          roleKey: 'LEADER',
          status: 'PENDING',
          nominationsOpenAt: new Date(Date.now() + 3 * 86400000),
          nominationsCloseAt: new Date(Date.now() + 10 * 86400000),
          votingOpenAt: new Date(Date.now() + 10 * 86400000),
          votingCloseAt: new Date(Date.now() + 17 * 86400000),
          termMonths: 12,
        },
      });

      await svc.openNominations();

      const updated = await prisma.election.findUnique({ where: { id: election.id } });
      expect(updated!.status).toBe('PENDING');
    });
  });

  // ─────────────────────────────────────────────
  // nominate
  // ─────────────────────────────────────────────

  describe('nominate', () => {
    it('creates a candidacy and deducts the PR fee', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN', { roleKey: 'LEADER' });
      const prCost = NOMINATION_PR_COST['LEADER'] ?? NOMINATION_PR_COST.DEFAULT;

      const before = await prisma.user.findUnique({
        where: { id: member1Id },
        select: { participationRights: true },
      });

      const { id } = await svc.nominate(member1Id, election.id, 'My platform statement');

      expect(id).toBeDefined();

      const candidate = await prisma.electionCandidate.findUnique({ where: { id } });
      expect(candidate!.userId).toBe(member1Id);
      expect(candidate!.electionId).toBe(election.id);
      expect(candidate!.statement).toBe('My platform statement');
      expect(candidate!.withdrawnAt).toBeNull();

      const after = await prisma.user.findUnique({
        where: { id: member1Id },
        select: { participationRights: true },
      });
      expect(after!.participationRights).toBe(before!.participationRights - prCost);
    });

    it('throws 409 if nominations are not open', async () => {
      const election = await seedElection(groupId, 'PENDING');
      await expect(
        svc.nominate(member1Id, election.id)
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 403 if the user is not a group member', async () => {
      const outsider = await createElectionUser(`outsider-${Date.now()}@test.com`, { participationRights: 200 });
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');

      await expect(
        svc.nominate(outsider.id, election.id)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 402 if the user has insufficient PR', async () => {
      const poorUser = await createElectionUser(`poor-${Date.now()}@test.com`, { participationRights: 5 });
      await prisma.groupMember.create({
        data: { userId: poorUser.id, groupId, role: 'MEMBER', active: true },
      });
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');

      await expect(
        svc.nominate(poorUser.id, election.id)
      ).rejects.toMatchObject({ statusCode: 402 });
    });

    it('throws 409 if the user has already nominated', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      await svc.nominate(member1Id, election.id);

      await expect(
        svc.nominate(member1Id, election.id)
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 404 for an unknown election', async () => {
      await expect(
        svc.nominate(member1Id, '00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─────────────────────────────────────────────
  // withdrawNomination
  // ─────────────────────────────────────────────

  describe('withdrawNomination', () => {
    it('soft-deletes the candidacy (sets withdrawnAt)', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      await svc.nominate(member1Id, election.id);

      await svc.withdrawNomination(member1Id, election.id);

      const candidate = await prisma.electionCandidate.findFirst({
        where: { electionId: election.id, userId: member1Id },
      });
      expect(candidate!.withdrawnAt).not.toBeNull();
    });

    it('throws 404 when no active nomination exists', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      await expect(
        svc.withdrawNomination(member1Id, election.id)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when the election is not in NOMINATIONS_OPEN status', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      await expect(
        svc.withdrawNomination(member1Id, election.id)
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ─────────────────────────────────────────────
  // openVoting
  // ─────────────────────────────────────────────

  describe('openVoting', () => {
    it('transitions to VOTING_OPEN when there are candidates', async () => {
      const election = await prisma.election.create({
        data: {
          groupId,
          scope: 'GROUP',
          roleKey: 'LEADER',
          status: 'NOMINATIONS_OPEN',
          nominationsOpenAt: new Date(Date.now() - 8 * 86400000),
          nominationsCloseAt: new Date(Date.now() - 1000), // closed
          votingOpenAt: new Date(Date.now() - 1000),
          votingCloseAt: new Date(Date.now() + 7 * 86400000),
          termMonths: 12,
        },
      });

      // Add a candidate directly
      await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id, statement: 'Test' },
      });

      const count = await svc.openVoting();
      expect(count).toBeGreaterThanOrEqual(1);

      const updated = await prisma.election.findUnique({ where: { id: election.id } });
      expect(updated!.status).toBe('VOTING_OPEN');
    });

    it('closes the election with quorumReached=false when no candidates', async () => {
      const election = await prisma.election.create({
        data: {
          groupId,
          scope: 'GROUP',
          roleKey: 'LEADER',
          status: 'NOMINATIONS_OPEN',
          nominationsOpenAt: new Date(Date.now() - 8 * 86400000),
          nominationsCloseAt: new Date(Date.now() - 1000),
          votingOpenAt: new Date(Date.now() - 1000),
          votingCloseAt: new Date(Date.now() + 7 * 86400000),
          termMonths: 12,
        },
      });

      await svc.openVoting();

      const updated = await prisma.election.findUnique({ where: { id: election.id } });
      expect(updated!.status).toBe('CLOSED');
      expect(updated!.quorumReached).toBe(false);
      expect(updated!.nextElectionAt).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // castVote
  // ─────────────────────────────────────────────

  describe('castVote', () => {
    it('creates a vote with PR balance as weight', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id, statement: 'Test' },
      });

      const { id: voteId } = await svc.castVote(member1Id, election.id, candidate.id);

      const vote = await prisma.electionVote.findUnique({ where: { id: voteId } });
      expect(vote!.voterId).toBe(member1Id);
      expect(vote!.candidateId).toBe(candidate.id);
      expect(vote!.weight).toBe(200); // member1 has 200 PR
    });

    it('throws 409 if voting is not open', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id },
      });

      await expect(
        svc.castVote(member1Id, election.id, candidate.id)
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 403 if the voter is not a group member', async () => {
      const outsider = await createElectionUser(`outsider-vote-${Date.now()}@test.com`);
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id },
      });

      await expect(
        svc.castVote(outsider.id, election.id, candidate.id)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 409 if the user has already voted', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id },
      });

      await svc.castVote(member1Id, election.id, candidate.id);
      await expect(
        svc.castVote(member1Id, election.id, candidate.id)
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 404 for a withdrawn candidate', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id, withdrawnAt: new Date() },
      });

      await expect(
        svc.castVote(member1Id, election.id, candidate.id)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('assigns minimum weight of 1 for users with 0 PR', async () => {
      const zeroPrUser = await createElectionUser(`zero-pr-${Date.now()}@test.com`, { participationRights: 0 });
      await prisma.groupMember.create({
        data: { userId: zeroPrUser.id, groupId, role: 'MEMBER', active: true },
      });

      const election = await seedElection(groupId, 'VOTING_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id },
      });

      const { id } = await svc.castVote(zeroPrUser.id, election.id, candidate.id);
      const vote = await prisma.electionVote.findUnique({ where: { id } });
      expect(vote!.weight).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // tallyAndClose (full lifecycle)
  // ─────────────────────────────────────────────

  describe('tallyAndClose', () => {
    it('declares the highest-weighted candidate as winner when quorum is reached', async () => {
      // 3 voters in group, quorum requires >1.5 votes → 2 needed
      const election = await seedElection(groupId, 'VOTING_OPEN');

      const c1 = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id },
      });
      const c2 = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id },
      });

      // member1 and member3 both vote for c2 (member2)
      await prisma.electionVote.createMany({
        data: [
          { electionId: election.id, candidateId: c2.id, voterId: member1Id, weight: 200 },
          { electionId: election.id, candidateId: c1.id, voterId: member2Id, weight: 150 },
          { electionId: election.id, candidateId: c2.id, voterId: member3Id, weight: 100 },
        ],
      });

      await svc.tallyAndClose(election.id);

      const closed = await prisma.election.findUnique({ where: { id: election.id } });
      expect(closed!.status).toBe('CLOSED');
      expect(closed!.quorumReached).toBe(true);
      // c2 (member2) has 300 weight (200+100) vs c1 (member1) 150 weight
      expect(closed!.winnerId).toBe(member2Id);
      expect(closed!.totalVoteWeight).toBe(450);
    });

    it('closes with quorumReached=false and no winner when fewer than 50%+1 voters vote', async () => {
      // 3 eligible, need >1.5 votes → 2 needed. Only 1 votes.
      const election = await seedElection(groupId, 'VOTING_OPEN');

      const c1 = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id },
      });

      // Only 1 of 3 eligible voters votes
      await prisma.electionVote.create({
        data: { electionId: election.id, candidateId: c1.id, voterId: member2Id, weight: 150 },
      });

      await svc.tallyAndClose(election.id);

      const closed = await prisma.election.findUnique({ where: { id: election.id } });
      expect(closed!.status).toBe('CLOSED');
      expect(closed!.quorumReached).toBe(false);
      expect(closed!.winnerId).toBeNull();
    });

    it('updates candidate tallies (totalWeight + voteCount)', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const c1 = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id },
      });

      await prisma.electionVote.createMany({
        data: [
          { electionId: election.id, candidateId: c1.id, voterId: member2Id, weight: 150 },
          { electionId: election.id, candidateId: c1.id, voterId: member3Id, weight: 100 },
        ],
      });

      await svc.tallyAndClose(election.id);

      const updatedCandidate = await prisma.electionCandidate.findUnique({ where: { id: c1.id } });
      expect(updatedCandidate!.totalWeight).toBe(250);
      expect(updatedCandidate!.voteCount).toBe(2);
    });

    it('applies winner role to their GroupMember record', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN', { roleKey: 'LEADER' });
      const c1 = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id },
      });

      // All 3 vote for member1 — quorum reached
      await prisma.electionVote.createMany({
        data: [
          { electionId: election.id, candidateId: c1.id, voterId: member1Id, weight: 200 },
          { electionId: election.id, candidateId: c1.id, voterId: member2Id, weight: 150 },
          { electionId: election.id, candidateId: c1.id, voterId: member3Id, weight: 100 },
        ],
      });

      await svc.tallyAndClose(election.id);

      const winnerMembership = await prisma.groupMember.findFirst({
        where: { userId: member1Id, groupId },
      });
      expect(winnerMembership!.role).toBe('LEADER');
    });

    it('throws 404 for an unknown election id', async () => {
      await expect(
        svc.tallyAndClose('00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─────────────────────────────────────────────
  // getElection
  // ─────────────────────────────────────────────

  describe('getElection', () => {
    it('returns election detail including candidates', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id, statement: 'Vote for me' },
      });

      const detail = await svc.getElection(election.id);
      expect(detail.id).toBe(election.id);
      expect(detail.status).toBe('NOMINATIONS_OPEN');
      expect(detail.candidates).toHaveLength(1);
      expect(detail.candidates[0].userId).toBe(member1Id);
      expect(detail.candidates[0].statement).toBe('Vote for me');
    });

    it('includes myVotedCandidateId when viewer has voted', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member2Id },
      });
      await prisma.electionVote.create({
        data: { electionId: election.id, candidateId: candidate.id, voterId: member1Id, weight: 200 },
      });

      const detail = await svc.getElection(election.id, member1Id);
      expect(detail.myVotedCandidateId).toBe(candidate.id);
    });

    it('includes myNominationId when viewer has an active nomination', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id },
      });

      const detail = await svc.getElection(election.id, member1Id);
      expect(detail.myNominationId).toBe(candidate.id);
    });

    it('throws 404 for an unknown election', async () => {
      await expect(
        svc.getElection('00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─────────────────────────────────────────────
  // listElections
  // ─────────────────────────────────────────────

  describe('listElections', () => {
    it('returns all elections with correct total count', async () => {
      await seedElection(groupId, 'PENDING');
      await seedElection(groupId, 'NOMINATIONS_OPEN');

      const result = await svc.listElections({});
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.items.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by status', async () => {
      await seedElection(groupId, 'PENDING');
      await seedElection(groupId, 'NOMINATIONS_OPEN');

      const result = await svc.listElections({ status: 'NOMINATIONS_OPEN', groupId });
      expect(result.items.every((e) => e.status === 'NOMINATIONS_OPEN')).toBe(true);
    });

    it('filters by groupId', async () => {
      const otherGroup = await createGroupWithMembers([member1Id]);
      await seedElection(groupId, 'PENDING');
      await seedElection(otherGroup, 'PENDING');

      const result = await svc.listElections({ groupId });
      expect(result.items.every((e) => e.groupId === groupId)).toBe(true);
    });

    it('paginates results', async () => {
      await seedElection(groupId, 'CLOSED');
      await seedElection(groupId, 'CLOSED');
      await seedElection(groupId, 'CLOSED');

      const page1 = await svc.listElections({ groupId, limit: 2, page: 1 });
      const page2 = await svc.listElections({ groupId, limit: 2, page: 2 });

      expect(page1.items).toHaveLength(2);
      // page2 may have 1 or more depending on what's in DB
      expect(page2.total).toBe(page1.total);
    });
  });
});

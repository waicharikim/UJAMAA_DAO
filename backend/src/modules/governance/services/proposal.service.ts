import { Prisma, ProposalStatus, ProposalScope } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { proposalLifecycleService } from './proposal-lifecycle.service.js';
import { proposalVotingService } from './proposal-voting.service.js';

// ─── Query layer ──────────────────────────────────────────────────────────────

async function getProposal(proposalId: string, currentUserId?: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      creator: { select: { id: true, name: true, avatarUrl: true } },
      group: {
        select: {
          id: true,
          name: true,
          locationScope: true,
          wardId: true,
          constituencyId: true,
          countyId: true,
          voluntaryType: true,
        },
      },
      votes: { select: { vote: true, voteWeight: true } },
      annotations: {
        include: {
          author: { select: { id: true, name: true } },
          reactions: { select: { userId: true, type: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!proposal) throw ApiError.notFound('Proposal');

  const yesWeight = proposal.votes
    .filter((v) => v.vote)
    .reduce((s, v) => s + v.voteWeight, 0);
  const noWeight = proposal.votes
    .filter((v) => !v.vote)
    .reduce((s, v) => s + v.voteWeight, 0);

  const annotations = proposal.annotations.map((a) => {
    const upvotes = a.reactions.filter((r) => r.type === 'UP').length;
    const downvotes = a.reactions.filter((r) => r.type === 'DOWN').length;
    const myReaction = currentUserId
      ? (a.reactions.find((r) => r.userId === currentUserId)?.type ?? null)
      : null;
    const { reactions, ...annotationRest } = a;
    return { ...annotationRest, upvotes, downvotes, myReaction };
  });

  const { votes, annotations: _annotations, ...rest } = proposal;
  return {
    ...rest,
    votesSummary: { total: votes.length, yesWeight, noWeight },
    annotations,
  };
}

async function listProposals(params: {
  groupId?: string;
  status?: ProposalStatus;
  scope?: ProposalScope;
  limit?: number;
  offset?: number;
  callerContext?: { roles: string[]; primaryWardId?: string; userId?: string };
}) {
  const {
    groupId,
    status,
    scope,
    limit = 20,
    offset = 0,
    callerContext,
  } = params;

  // Scope the list when no specific group is requested:
  //  - location admins → their administrative area (existing behaviour);
  //  - a regular member with no explicit `scope` filter → their own communities
  //    (the system groups they're auto-enrolled in across ward/constituency/
  //    county/national + voluntary groups they joined), mirroring how the feed
  //    and projects scope. An explicit `scope` (e.g. the platform-wide
  //    /governance transparency view) opts out and stays global.
  let locationWhere: Prisma.ProposalWhereInput = {};
  if (!groupId && callerContext?.roles) {
    const roles = callerContext.roles;
    const wardId = callerContext.primaryWardId;
    const isSuperAdmin =
      roles.includes('system:super_admin') ||
      roles.includes('system:compliance_officer');

    if (isSuperAdmin) {
      // sees everything
    } else if (wardId && roles.includes('location:ward_admin')) {
      locationWhere = { group: { wardId } };
    } else if (wardId && roles.includes('location:constituency_admin')) {
      const ward = await prisma.ward.findUnique({
        where: { id: wardId },
        select: { constituencyId: true },
      });
      if (ward?.constituencyId)
        locationWhere = { group: { constituencyId: ward.constituencyId } };
    } else if (wardId && roles.includes('location:county_admin')) {
      const ward = await prisma.ward.findUnique({
        where: { id: wardId },
        select: { countyId: true },
      });
      if (ward?.countyId)
        locationWhere = { group: { countyId: ward.countyId } };
    } else if (!scope && callerContext.userId) {
      // Regular member, no explicit scope → their communities only.
      const memberships = await prisma.groupMember.findMany({
        where: { userId: callerContext.userId, active: true },
        select: { groupId: true },
      });
      locationWhere = { groupId: { in: memberships.map((m) => m.groupId) } };
    }
  }

  const where: Prisma.ProposalWhereInput = {
    ...locationWhere,
    ...(groupId ? { groupId } : {}),
    ...(status ? { status } : {}),
    ...(scope ? { proposalScope: scope } : {}),
  };

  const [proposals, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        proposalType: true,
        status: true,
        proposalScope: true,
        groupId: true,
        creatorId: true,
        budget: true,
        groupFundingAmount: true,
        locationFundingRequest: true,
        votingStartsAt: true,
        votingEndsAt: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.proposal.count({ where }),
  ]);

  return { proposals, total, limit, offset };
}

// ─── Facade ───────────────────────────────────────────────────────────────────
// Delegates to lifecycle and voting sub-services. Kept as a single export so
// the controller, jobs, and tests need no import changes.

class ProposalService {
  readonly createProposal = proposalLifecycleService.createProposal.bind(
    proposalLifecycleService
  );
  readonly reviewProposal = proposalLifecycleService.reviewProposal.bind(
    proposalLifecycleService
  );
  readonly startVoting = proposalLifecycleService.startVoting.bind(
    proposalLifecycleService
  );
  readonly cancelProposal = proposalLifecycleService.cancelProposal.bind(
    proposalLifecycleService
  );
  readonly resubmitProposal = proposalLifecycleService.resubmitProposal.bind(
    proposalLifecycleService
  );
  readonly updateProgress = proposalLifecycleService.updateProgress.bind(
    proposalLifecycleService
  );
  readonly updateMemory = proposalLifecycleService.updateMemory.bind(
    proposalLifecycleService
  );
  readonly recordOutcome = proposalLifecycleService.recordOutcome.bind(
    proposalLifecycleService
  );

  readonly castVote = proposalVotingService.castVote.bind(
    proposalVotingService
  );
  readonly tallyVotes = proposalVotingService.tallyVotes.bind(
    proposalVotingService
  );

  readonly getProposal = getProposal;
  readonly listProposals = listProposals;
}

export const proposalService = new ProposalService();

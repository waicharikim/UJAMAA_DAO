import { ProposalScope, ProposalStatus } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason, PR_CONFIG } from '../../economy/types.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { ImpactPointReason } from '../../reputation/types.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { CastVoteDto, VoteOption } from '../types.js';
import { notificationService } from '../../notifications/services/notification.service.js';
import { NotificationType } from '../../notifications/types.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { getGovernanceContract } from '../../../core/blockchain/client.js';
import { ethers } from 'ethers';
import { assertStartVotingAuth } from './proposal-lifecycle.service.js';

type VoteRecord = { vote: boolean | null; voteWeight: number };

function resolveVoteOption(option: VoteOption): boolean | null {
  if (option === VoteOption.YES) return true;
  if (option === VoteOption.NO) return false;
  return null;
}

interface TallyResult {
  quorum: boolean;
  approved: boolean;
  newStatus: ProposalStatus;
  tallyRejectionNote: string | null;
}

interface TallyOutcomeContext {
  creatorId: string;
  proposalId: string;
  title: string;
  newStatus: ProposalStatus;
  quorum: boolean;
}

class ProposalVotingService {
  async castVote(userId: string, dto: CastVoteDto, userPrimaryWardId?: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: dto.proposalId },
      include: {
        group: {
          include: { members: { where: { userId, active: true } } },
        },
      },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== ProposalStatus.VOTING)
      throw ApiError.badRequest('Voting not active');

    const groupId = proposal.groupId!;

    await this.assertVoteEligibility(proposal, userPrimaryWardId);

    const existing = await prisma.groupMemberVote.findUnique({
      where: {
        groupId_memberId_proposalId: {
          groupId,
          memberId: userId,
          proposalId: dto.proposalId,
        },
      },
    });

    if (existing) throw ApiError.conflict('Already voted');

    const weight = await globalImpactPointService.getTotal(userId);

    await participationRightsService
      .award(userId, PR_CONFIG.VOTE_CAST, ParticipationRightsReason.VOTED, {
        proposalId: dto.proposalId,
      })
      .catch(() => {});

    await globalImpactPointService
      .award(userId, 5, ImpactPointReason.VOTE_CAST, {
        proposalId: dto.proposalId,
      })
      .catch(() => {});

    const voteValue = resolveVoteOption(dto.option);

    await prisma.groupMemberVote.create({
      data: {
        groupId,
        memberId: userId,
        proposalId: dto.proposalId,
        vote: voteValue,
        voteWeight: weight,
      },
    });

    await prisma.onboardingProgress
      .updateMany({
        where: { userId, castFirstVote: false },
        data: { castFirstVote: true },
      })
      .catch(() => {
        /* non-critical */
      });

    logger.info(
      { userId, proposalId: dto.proposalId, option: dto.option, weight },
      'Vote cast'
    );

    await auditService.log(
      userId,
      AuditAction.PROPOSAL_VOTE_CAST,
      'Proposal',
      dto.proposalId,
      { option: dto.option, weight }
    );

    // Votes are now cast on-chain by the USER's own smart account (frontend →
    // GovernanceVoting.castVote, gasless) — the platform no longer anchors votes
    // (it cannot forge them). The off-chain DB record above is for tally/quorum
    // UX; the trustless record is the user's on-chain VoteCast event.
    return { weight };
  }

  async tallyVotes(
    proposalId: string,
    callerId?: string,
    callerSystemRoles: string[] = []
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { group: true, votes: true },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== ProposalStatus.VOTING) return;

    // Auth gate — skipped when called by the cron job (no callerId).
    if (callerId) {
      await assertStartVotingAuth(callerId, proposal, callerSystemRoles);
    }

    const totalEligible = await prisma.groupMember.count({
      where: { groupId: proposal.groupId ?? undefined, active: true },
    });

    const { quorum, approved, newStatus, tallyRejectionNote } =
      this.computeTallyResult(proposal.votes, totalEligible);

    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: newStatus,
        ...(tallyRejectionNote ? { reviewNote: tallyRejectionNote } : {}),
      },
    });

    logger.info(
      { proposalId, quorum, approved, newStatus },
      'Proposal tallied'
    );

    await this.executeTallyPost(
      proposal,
      proposalId,
      newStatus,
      quorum,
      approved
    );

    return { newStatus, quorum, approved };
  }

  private computeTallyResult(
    votes: VoteRecord[],
    totalEligible: number
  ): TallyResult {
    const voterCount = votes.length;
    const decidingVotes = votes.filter((v) => v.vote !== null);
    const yesWeight = decidingVotes
      .filter((v) => v.vote === true)
      .reduce((sum, v) => sum + v.voteWeight, 0);
    const decidingWeight = decidingVotes.reduce(
      (sum, v) => sum + v.voteWeight,
      0
    );

    const quorum = totalEligible > 0 && voterCount / totalEligible >= 0.4;
    const approved = decidingWeight > 0 && yesWeight / decidingWeight >= 0.5;
    const newStatus =
      quorum && approved ? ProposalStatus.APPROVED : ProposalStatus.REJECTED;

    const tallyRejectionNote =
      newStatus === ProposalStatus.REJECTED
        ? !quorum
          ? `Voting closed: proposal did not achieve quorum (${Math.round((voterCount / (totalEligible || 1)) * 100)}% turnout, 40% required).`
          : `Voting closed: proposal did not achieve approval majority (${Math.round((yesWeight / (decidingWeight || 1)) * 100)}% yes, 50% required).`
        : null;

    return { quorum, approved, newStatus, tallyRejectionNote };
  }

  private async assertVoteEligibility(
    proposal: {
      proposalScope: ProposalScope;
      targetWardId?: string | null;
      targetConstituencyId?: string | null;
      targetCountyId?: string | null;
      group: {
        voluntaryType?: string | null;
        wardId: string | null;
        constituencyId: string | null;
        countyId: string | null;
        members: unknown[];
      } | null;
    },
    userPrimaryWardId?: string
  ): Promise<void> {
    if (proposal.proposalScope !== ProposalScope.COMMUNITY) {
      if (!proposal.group || !proposal.group.members.length)
        throw ApiError.forbidden('Not a member of this group');
      return;
    }

    const group = proposal.group;

    // Effective target area: the proposal's own target, falling back to the
    // group's location for proposals created before targets existed (legacy).
    const targetWardId = proposal.targetWardId ?? group?.wardId ?? null;
    const targetConstituencyId =
      proposal.targetConstituencyId ?? group?.constituencyId ?? null;
    const targetCountyId = proposal.targetCountyId ?? group?.countyId ?? null;

    // No target at all = a genuine national proposal — only legitimate for
    // system groups. A voluntary group must always be scoped to a real area
    // (defensive: closes the "anyone votes" hole for location-less voluntary
    // public proposals).
    if (!targetWardId && !targetConstituencyId && !targetCountyId) {
      if (group?.voluntaryType)
        throw ApiError.forbidden(
          'This community proposal has no target area and cannot be voted on.'
        );
      return; // national / platform-wide
    }

    if (!userPrimaryWardId)
      throw ApiError.forbidden(
        'You must have a primary ward set to vote on this community proposal'
      );

    if (targetWardId) {
      if (userPrimaryWardId !== targetWardId)
        throw ApiError.forbidden(
          'You must be a ward resident to vote on this proposal'
        );
      return;
    }

    const userWard = await prisma.ward.findUnique({
      where: { id: userPrimaryWardId },
      select: { constituencyId: true, countyId: true },
    });
    if (
      targetConstituencyId &&
      userWard?.constituencyId !== targetConstituencyId
    )
      throw ApiError.forbidden(
        'You must be a constituency resident to vote on this proposal'
      );
    if (targetCountyId && userWard?.countyId !== targetCountyId)
      throw ApiError.forbidden(
        'You must be a county resident to vote on this proposal'
      );
  }

  private async executeTallyPost(
    proposal: { creatorId: string | null; title: string },
    proposalId: string,
    newStatus: ProposalStatus,
    quorum: boolean,
    approved: boolean
  ): Promise<void> {
    if (proposal.creatorId) {
      await auditService
        .log(
          proposal.creatorId,
          AuditAction.PROPOSAL_STATUS_CHANGED,
          'Proposal',
          proposalId,
          {
            newStatus,
            quorum,
            approved,
            tallySource: 'auto',
            title: proposal.title,
          }
        )
        .catch(() => {});
    }
    if (proposal.creatorId && newStatus === ProposalStatus.APPROVED)
      await this.awardTallyCreatorRewards(
        proposal.creatorId,
        proposalId,
        proposal.title
      );
    await this.anchorResultOnChain(proposalId, newStatus);
    if (proposal.creatorId)
      await this.notifyTallyOutcome({
        creatorId: proposal.creatorId,
        proposalId,
        title: proposal.title,
        newStatus,
        quorum,
      });
  }

  private async awardTallyCreatorRewards(
    creatorId: string,
    proposalId: string,
    title: string
  ): Promise<void> {
    await globalImpactPointService
      .award(creatorId, 25, ImpactPointReason.PROPOSAL_PASSED, {
        proposalId,
        title,
      })
      .catch(() => {});
    await participationRightsService
      .award(
        creatorId,
        PR_CONFIG.PROPOSAL_EXECUTED,
        ParticipationRightsReason.PROPOSAL_EXECUTED,
        { proposalId, title }
      )
      .catch(() => {});
  }

  private async anchorResultOnChain(
    proposalId: string,
    newStatus: ProposalStatus
  ): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    const govContract = getGovernanceContract();
    if (!govContract) return;
    try {
      const proposalBytes32 = ethers.keccak256(ethers.toUtf8Bytes(proposalId));

      // The contract requires the voting window CLOSED before a result can be
      // attested. status: 0 = never opened, 1 = open, 2 = closed.
      const status: bigint = await govContract.proposalStatus(proposalBytes32);
      if (status === 0n) {
        logger.info(
          { proposalId },
          '[GOV] Proposal never opened on-chain — skipping result attestation'
        );
        return;
      }
      if (status === 1n) {
        await govContract.closeProposal(proposalBytes32);
        logger.info({ proposalId }, '[GOV] On-chain voting window closed');
      }

      const onChainOutcome = newStatus === ProposalStatus.APPROVED ? 1 : 2;
      await govContract.recordResult(proposalBytes32, onChainOutcome);
      logger.info({ proposalId, newStatus }, '[GOV] On-chain result recorded');
    } catch (err) {
      logger.warn(
        { proposalId, err },
        '[GOV] On-chain result failed — DB record intact'
      );
    }
  }

  private async notifyTallyOutcome(ctx: TallyOutcomeContext): Promise<void> {
    const isPassed = ctx.newStatus === ProposalStatus.APPROVED;
    await notificationService
      .send({
        userId: ctx.creatorId,
        type: isPassed
          ? NotificationType.PROPOSAL_PASSED
          : NotificationType.PROPOSAL_VOTE_CAST,
        title: isPassed ? 'Proposal approved' : 'Proposal rejected',
        message: isPassed
          ? `"${ctx.title}" has passed the vote and is now approved.`
          : `"${ctx.title}" did not pass the vote. ${!ctx.quorum ? 'Quorum was not reached.' : 'The vote was not in favour.'}`,
        data: { proposalId: ctx.proposalId, newStatus: ctx.newStatus },
      })
      .catch(() => {});
  }
}

export const proposalVotingService = new ProposalVotingService();

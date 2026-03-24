/**
 * @file src/modules/governance/services/proposal.service.ts
 * @description
 * Proposal Service — Group-Scoped Governance
 *
 * Version: 2.1 — February 2026
 * Updated: Align with actual Prisma schema (GroupMemberVote, ProposalStatus, budget)
 */

import { ProposalStatus, ProposalType, ProposalScope } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import {
  PR_COST_BY_SCOPE,
  IP_PERCENTILE_THRESHOLD,
  CastVoteDto,
  CreateProposalDto,
  ReviewProposalDto,
  VoteOption,
} from '../types.js';
import { SystemRoles } from '../../../core/rbac/roles.js';
import { notificationService } from '../../notifications/services/notification.service.js';
import { NotificationType } from '../../notifications/types.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';

class ProposalService {
  /**
   * Create proposal — group-scoped, PR cost + IP percentile check
   */
  async createProposal(userId: string, dto: CreateProposalDto) {
    const group = await prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        members: {
          include: { user: { select: { id: true, globalImpactPoints: true } } },
          orderBy: { user: { globalImpactPoints: 'desc' } },
        },
      },
    });

    if (!group) throw ApiError.notFound('Group', dto.groupId);

    const membership = group.members.find((m) => m.userId === userId);
    if (!membership)
      throw ApiError.forbidden('You are not a member of this group');

    const scope = group.locationScope || 'VOLUNTARY';
    const prCost =
      PR_COST_BY_SCOPE[scope as keyof typeof PR_COST_BY_SCOPE] || 50;
    const requiredPercentile =
      IP_PERCENTILE_THRESHOLD[scope as keyof typeof IP_PERCENTILE_THRESHOLD] ||
      1.0;

    const ips = group.members.map((m) => m.user.globalImpactPoints);
    const userRank =
      ips.filter((ip) => ip > membership.user.globalImpactPoints).length + 1;
    const allowedRank = Math.ceil(requiredPercentile * ips.length);

    if (userRank > allowedRank) {
      throw ApiError.forbidden(
        `You need to be in the top ${(requiredPercentile * 100).toFixed(0)}% of IP in this group`
      );
    }

    await participationRightsService.spend(
      userId,
      prCost,
      ParticipationRightsReason.PROPOSAL_CREATED,
      { groupId: dto.groupId, scope, title: dto.title }
    );

    const proposal = await prisma.proposal.create({
      data: {
        groupId: dto.groupId,
        creatorId: userId,
        title: dto.title,
        description: dto.description,
        budget: dto.fundingAmountKes,
        proposalType: dto.isEmergency
          ? ProposalType.EMERGENCY
          : ProposalType.COMMUNITY_INITIATIVE,
        status: ProposalStatus.DRAFT,
        proposalScope:
          (dto.proposalScope as ProposalScope) ?? ProposalScope.COMMUNITY,
        groupFundingAmount: dto.groupFundingAmount,
        locationFundingRequest: dto.locationFundingRequest,
      },
    });

    logger.info(
      { userId, groupId: dto.groupId, scope, prCost, userRank, allowedRank },
      'Proposal created'
    );

    await auditService.log(
      userId,
      AuditAction.PROPOSAL_CREATED,
      'Proposal',
      proposal.id,
      { groupId: dto.groupId, title: dto.title, scope }
    );

    return proposal;
  }

  /**
   * Two-stage proposal review:
   *
   * Stage 1 (DRAFT → PENDING_REVIEW or APPROVED_FOR_VOTING):
   *   - Group LEADER forwards the proposal.
   *   - Voluntary GROUP-scoped proposals jump directly to APPROVED_FOR_VOTING.
   *   - All other proposals go to PENDING_REVIEW for location admin review.
   *
   * Stage 2 (PENDING_REVIEW → APPROVED_FOR_VOTING or REJECTED):
   *   - The appropriate location admin (ward/constituency/county/compliance_officer)
   *     approves or rejects based on which location ID the group has set.
   */
  async reviewProposal(
    userId: string,
    proposalId: string,
    dto: ReviewProposalDto,
    callerSystemRoles: string[]
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { group: true },
    });
    if (!proposal) throw ApiError.notFound('Proposal');

    const group = proposal.group;
    const groupId = proposal.groupId;

    // ── STAGE 1: LEADER forwards DRAFT ──────────────────────────────────────
    if (proposal.status === ProposalStatus.DRAFT) {
      const membership = groupId
        ? await prisma.groupMember.findFirst({
            where: { userId, groupId, active: true },
            select: { role: true },
          })
        : null;
      if (!membership || membership.role !== 'LEADER')
        throw ApiError.forbidden(
          'Only group leaders can forward proposals for review'
        );

      if (dto.decision === 'REJECT') {
        const updated = await prisma.proposal.update({
          where: { id: proposalId },
          data: {
            status: ProposalStatus.REJECTED,
            reviewedById: userId,
            reviewNote: dto.note ?? null,
          },
        });
        await auditService.log(
          userId,
          AuditAction.PROPOSAL_STATUS_CHANGED,
          'Proposal',
          proposalId,
          { newStatus: ProposalStatus.REJECTED, stage: 1 }
        );
        return updated;
      }

      // Voluntary GROUP-scoped proposals skip admin review entirely
      const isVoluntary = !!group?.voluntaryType;
      const isGroupScoped = proposal.proposalScope === ProposalScope.GROUP;
      if (isVoluntary && isGroupScoped) {
        const updated = await prisma.proposal.update({
          where: { id: proposalId },
          data: { status: ProposalStatus.APPROVED_FOR_VOTING },
        });
        await auditService.log(
          userId,
          AuditAction.PROPOSAL_STATUS_CHANGED,
          'Proposal',
          proposalId,
          { newStatus: ProposalStatus.APPROVED_FOR_VOTING, stage: 1 }
        );
        return updated;
      }

      // Voluntary COMMUNITY-scoped must have a location set
      if (
        isVoluntary &&
        !group?.wardId &&
        !group?.constituencyId &&
        !group?.countyId
      ) {
        throw ApiError.badRequest(
          'This voluntary group has no location affiliation. Associate the group with a ward, constituency, or county before creating community proposals.'
        );
      }

      const forwarded = await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: ProposalStatus.PENDING_REVIEW },
      });
      await auditService.log(
        userId,
        AuditAction.PROPOSAL_STATUS_CHANGED,
        'Proposal',
        proposalId,
        { newStatus: ProposalStatus.PENDING_REVIEW, stage: 1 }
      );
      return forwarded;
    }

    // ── STAGE 2: Location admin approves/rejects PENDING_REVIEW ─────────────
    if (proposal.status === ProposalStatus.PENDING_REVIEW) {
      if (!group) throw ApiError.badRequest('Proposal has no associated group');
      if (!canLocationAdminApprove(group, callerSystemRoles))
        throw ApiError.forbidden(
          `Requires ${requiredRoleLabel(group)} to approve this proposal`
        );

      const newStatus =
        dto.decision === 'APPROVE'
          ? ProposalStatus.APPROVED_FOR_VOTING
          : ProposalStatus.REJECTED;
      const updated = await prisma.proposal.update({
        where: { id: proposalId },
        data: {
          status: newStatus,
          reviewedById: userId,
          reviewNote: dto.note ?? null,
        },
      });
      await auditService.log(
        userId,
        AuditAction.PROPOSAL_STATUS_CHANGED,
        'Proposal',
        proposalId,
        { newStatus, stage: 2 }
      );
      return updated;
    }

    throw ApiError.badRequest('Proposal is not in a reviewable state');
  }

  /**
   * Start voting period (group LEADER, requires APPROVED_FOR_VOTING status)
   */
  async startVoting(userId: string, proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { group: true },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== ProposalStatus.APPROVED_FOR_VOTING)
      throw ApiError.badRequest(
        'Proposal must be approved before voting can start'
      );

    const membership = proposal.groupId
      ? await prisma.groupMember.findFirst({
          where: { userId, groupId: proposal.groupId, active: true },
          select: { role: true },
        })
      : null;
    if (!membership || membership.role !== 'LEADER')
      throw ApiError.forbidden('Only group leaders can start voting');

    const isEmergency = proposal.proposalType === ProposalType.EMERGENCY;
    const groupScope = proposal.group?.locationScope;
    const days = isEmergency ? 3 : groupScope === 'NATIONAL' ? 21 : 7;
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.VOTING,
        votingStartsAt: startsAt,
        votingEndsAt: endsAt,
      },
    });

    logger.info({ proposalId, days }, 'Voting started');

    // Notify group members that voting is open (up to 50 most recent members)
    if (proposal.groupId) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: proposal.groupId, active: true },
        select: { userId: true },
        take: 50,
      });
      await Promise.allSettled(
        members.map((m) =>
          notificationService.send({
            userId: m.userId,
            type: NotificationType.PROPOSAL_VOTING_STARTED,
            title: 'Voting open',
            message: `Voting has started on "${proposal.title}". You have ${days} days to cast your vote.`,
            data: { proposalId },
          })
        )
      );
    }

    return { startsAt, endsAt };
  }

  /**
   * Cast vote — 5 PR + IP weight
   */
  async castVote(userId: string, dto: CastVoteDto) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: dto.proposalId },
      include: { group: { include: { members: { where: { userId } } } } },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== ProposalStatus.VOTING)
      throw ApiError.badRequest('Voting not active');
    if (!proposal.group || !proposal.group.members.length)
      throw ApiError.forbidden('Not a member');

    const groupId = proposal.groupId!;

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

    await participationRightsService.spend(
      userId,
      5,
      ParticipationRightsReason.VOTED,
      { proposalId: dto.proposalId }
    );

    const weight = await globalImpactPointService.getTotal(userId);

    await prisma.groupMemberVote.create({
      data: {
        groupId,
        memberId: userId,
        proposalId: dto.proposalId,
        vote: dto.option === VoteOption.YES,
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

    return { weight };
  }

  /**
   * Tally votes (cron or at end)
   */
  async tallyVotes(proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { group: true, votes: true },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== ProposalStatus.VOTING) return;

    const totalEligible = await prisma.groupMember.count({
      where: { groupId: proposal.groupId ?? undefined },
    });
    const totalVoteWeight = proposal.votes.reduce(
      (sum, v) => sum + v.voteWeight,
      0
    );
    const yesWeight = proposal.votes
      .filter((v) => v.vote === true)
      .reduce((sum, v) => sum + v.voteWeight, 0);

    const quorum = totalVoteWeight / totalEligible >= 0.4;
    const approved = totalVoteWeight > 0 && yesWeight / totalVoteWeight >= 0.5;

    const newStatus =
      quorum && approved ? ProposalStatus.APPROVED : ProposalStatus.REJECTED;

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: newStatus },
    });

    logger.info(
      { proposalId, quorum, approved, newStatus },
      'Proposal tallied'
    );

    if (proposal.creatorId) {
      await auditService
        .log(
          proposal.creatorId,
          AuditAction.PROPOSAL_STATUS_CHANGED,
          'Proposal',
          proposalId,
          { newStatus, quorum, approved, tallySource: 'auto' }
        )
        .catch(() => {
          /* non-critical */
        });
    }

    // Notify the proposal creator of the outcome
    if (proposal.creatorId) {
      const isPassed = newStatus === ProposalStatus.APPROVED;
      notificationService
        .send({
          userId: proposal.creatorId,
          type: isPassed
            ? NotificationType.PROPOSAL_PASSED
            : NotificationType.PROPOSAL_VOTE_CAST,
          title: isPassed ? 'Proposal approved' : 'Proposal rejected',
          message: isPassed
            ? `"${proposal.title}" has passed the vote and is now approved.`
            : `"${proposal.title}" did not pass the vote. ${!quorum ? 'Quorum was not reached.' : 'The vote was not in favour.'}`,
          data: { proposalId, newStatus },
        })
        .catch(() => {
          /* non-critical */
        });
    }

    return { newStatus, quorum, approved };
  }

  async getProposal(proposalId: string) {
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
      },
    });
    if (!proposal) throw ApiError.notFound('Proposal');

    const yesWeight = proposal.votes
      .filter((v) => v.vote)
      .reduce((s, v) => s + v.voteWeight, 0);
    const noWeight = proposal.votes
      .filter((v) => !v.vote)
      .reduce((s, v) => s + v.voteWeight, 0);

    const { votes, ...rest } = proposal;
    return {
      ...rest,
      votesSummary: { total: votes.length, yesWeight, noWeight },
    };
  }

  async listProposals(params: {
    groupId?: string;
    status?: ProposalStatus;
    scope?: ProposalScope;
    limit?: number;
    offset?: number;
  }) {
    const { groupId, status, scope, limit = 20, offset = 0 } = params;
    const where = {
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

  /**
   * Update Ward Memory Layer fields (rationale + alternatives).
   * Only the creator can update, and only while the proposal is in DRAFT or PENDING_REVIEW.
   */
  async updateMemory(
    userId: string,
    proposalId: string,
    dto: { rationale?: string; alternatives?: string }
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { creatorId: true, status: true },
    });
    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.creatorId !== userId)
      throw ApiError.forbidden(
        'Only the proposal creator can update memory fields'
      );
    if (!['DRAFT', 'PENDING_REVIEW'].includes(proposal.status as string))
      throw ApiError.badRequest(
        'Memory fields can only be updated before voting begins'
      );

    return prisma.proposal.update({
      where: { id: proposalId },
      data: {
        ...(dto.rationale !== undefined && { rationale: dto.rationale }),
        ...(dto.alternatives !== undefined && {
          alternatives: dto.alternatives,
        }),
      },
      select: { id: true, rationale: true, alternatives: true },
    });
  }

  /**
   * Record the real-world outcome of a passed proposal.
   * Only the creator or group leader can record outcomes, and only after passing.
   */
  async recordOutcome(userId: string, proposalId: string, outcome: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { creatorId: true, status: true, groupId: true },
    });
    if (!proposal) throw ApiError.notFound('Proposal');

    // Check it passed
    const passedStatuses = ['PASSED', 'EXECUTING', 'COMPLETED'];
    if (!passedStatuses.includes(proposal.status as string))
      throw ApiError.badRequest(
        'Outcome can only be recorded for passed proposals'
      );

    // Check caller is creator or group leader
    const isCreator = proposal.creatorId === userId;
    const isLeader = proposal.groupId
      ? !!(await prisma.groupMember.findFirst({
          where: {
            userId,
            groupId: proposal.groupId,
            role: 'LEADER',
            active: true,
          },
        }))
      : false;
    if (!isCreator && !isLeader)
      throw ApiError.forbidden(
        'Only the proposal creator or group leader can record outcomes'
      );

    return prisma.proposal.update({
      where: { id: proposalId },
      data: { outcome, outcomeRecordedAt: new Date() },
      select: { id: true, outcome: true, outcomeRecordedAt: true },
    });
  }
}

export const proposalService = new ProposalService();

// ─── Location admin helpers ────────────────────────────────────────────────

type GroupLocation = {
  wardId: string | null;
  constituencyId: string | null;
  countyId: string | null;
  locationScope: string;
};

function canLocationAdminApprove(
  group: GroupLocation,
  roles: string[]
): boolean {
  if (
    roles.includes(SystemRoles.SUPER_ADMIN) ||
    roles.includes('system:compliance_officer')
  )
    return true;
  if (group.wardId) return roles.includes('location:ward_admin');
  if (group.constituencyId)
    return roles.includes('location:constituency_admin');
  if (group.countyId) return roles.includes('location:county_admin');
  if (group.locationScope === 'NATIONAL')
    return roles.includes('system:compliance_officer');
  return false;
}

function requiredRoleLabel(group: GroupLocation): string {
  if (group.wardId) return 'ward administrator';
  if (group.constituencyId) return 'constituency administrator';
  if (group.countyId) return 'county administrator';
  if (group.locationScope === 'NATIONAL') return 'compliance officer';
  return 'platform administrator';
}

import {
  Prisma,
  ProposalStatus,
  ProposalType,
  ProposalScope,
  ProposalKind,
} from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import {
  PR_COST_BY_SCOPE,
  IP_PERCENTILE_THRESHOLD,
  CreateProposalDto,
  ReviewProposalDto,
} from '../types.js';
import { SystemRoles } from '../../../core/rbac/roles.js';
import { notificationService } from '../../notifications/services/notification.service.js';
import { NotificationType } from '../../notifications/types.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { treasuryService } from '../../treasury/services/treasury.service.js';
import { getGovernanceContract } from '../../../core/blockchain/client.js';
import { ethers } from 'ethers';
import { governanceQueue } from '../../../core/queue/index.js';
import { queueBarazaDeliberation } from '../baraza/baraza.job.js';
import { recordProposalOutcomeInMemory } from '../baraza/baraza-deliberation.service.js';
import {
  GENERATE_DELIBERATION_SUMMARY_JOB,
  OPEN_PROPOSAL_ONCHAIN_JOB,
} from '../jobs/proposal.jobs.js';

/**
 * Anchor a proposal's ward-memory record hash on-chain.
 *
 * Mirrors anchorAnnotationOnChain() but does NOT require the recorder's wallet —
 * ward memory is the ward's institutional record, not a personal opinion; the
 * signer is the platform RECORDER_ROLE minter wallet. The recorder's userId is
 * folded into the hash for provenance instead.
 *
 * Returns the tx hash, or null if the chain is not configured / the call fails
 * (the off-chain record is always intact regardless).
 */
async function anchorMemoryOnChain(
  proposalId: string,
  userId: string,
  memory: {
    rationale: string | null;
    alternatives: string | null;
    outcome: string;
    outcomeRecordedAt: Date;
    deliberationSummary: unknown;
  }
): Promise<string | null> {
  if (process.env.NODE_ENV === 'test') return null;

  const govContract = getGovernanceContract();
  if (!govContract) return null;

  try {
    const proposalBytes32 = ethers.keccak256(ethers.toUtf8Bytes(proposalId));
    const memoryHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        `${proposalId}:${memory.rationale ?? ''}:${memory.alternatives ?? ''}:${memory.outcome}:${JSON.stringify(memory.deliberationSummary ?? null)}:${memory.outcomeRecordedAt.toISOString()}:${userId}`
      )
    );
    const tx = await govContract.recordMemory(proposalBytes32, memoryHash);
    logger.info({ proposalId }, '[GOV] Ward memory anchored on-chain');
    return tx.hash as string;
  } catch (err) {
    logger.warn(
      { proposalId, err },
      '[GOV] On-chain memory anchor failed — off-chain record intact'
    );
    return null;
  }
}

export type ProposalWithGroup = Prisma.ProposalGetPayload<{
  include: { group: true };
}>;

interface ReviewContext {
  userId: string;
  proposalId: string;
  proposal: ProposalWithGroup;
  dto: ReviewProposalDto;
  callerSystemRoles: string[];
}

type GroupLocation = {
  wardId: string | null;
  constituencyId: string | null;
  countyId: string | null;
  locationScope: string;
};

// Minimal shape needed for voting/tally auth checks — both ProposalWithGroup
// and proposals fetched with votes satisfy this structurally.
export type ProposalAuthPayload = {
  group: {
    isSystemGroup: boolean;
    wardId: string | null;
    constituencyId: string | null;
    countyId: string | null;
    locationScope: string;
  } | null;
  groupId: string | null;
};

export function canLocationAdminApprove(
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

export function requiredRoleLabel(group: GroupLocation): string {
  if (group.wardId) return 'ward administrator';
  if (group.constituencyId) return 'constituency administrator';
  if (group.countyId) return 'county administrator';
  if (group.locationScope === 'NATIONAL') return 'compliance officer';
  return 'platform administrator';
}

// Shared auth check used by startVoting (lifecycle) and tallyVotes (voting).
export async function assertStartVotingAuth(
  userId: string,
  proposal: ProposalAuthPayload,
  callerSystemRoles: string[]
): Promise<void> {
  const group = proposal.group;
  if (group?.isSystemGroup) {
    if (!canLocationAdminApprove(group, callerSystemRoles))
      throw ApiError.forbidden(
        `Requires ${requiredRoleLabel(group)} to start voting`
      );
    return;
  }
  const membership = proposal.groupId
    ? await prisma.groupMember.findFirst({
        where: { userId, groupId: proposal.groupId, active: true },
        select: { role: true },
      })
    : null;
  if (!membership || membership.role !== 'LEADER')
    throw ApiError.forbidden('Only the group leader can start voting');
}

class ProposalLifecycleService {
  private assertProposalCreatorEligibility(
    userId: string,
    group: {
      members: Array<{ userId: string; user: { globalImpactPoints: number } }>;
    },
    scope: string
  ): void {
    const membership = group.members.find((m) => m.userId === userId);
    if (!membership)
      throw ApiError.forbidden('You are not a member of this group');

    const requiredPercentile =
      IP_PERCENTILE_THRESHOLD[scope as keyof typeof IP_PERCENTILE_THRESHOLD] ||
      1.0;
    const ips = group.members.map((m) => m.user.globalImpactPoints);
    const userRank =
      ips.filter((ip) => ip > membership.user.globalImpactPoints).length + 1;
    const allowedRank = Math.ceil(requiredPercentile * ips.length);

    if (userRank > allowedRank)
      throw ApiError.forbidden(
        `You need to be in the top ${(requiredPercentile * 100).toFixed(0)}% of IP in this group`
      );
  }

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

    const scope = group.locationScope || 'VOLUNTARY';
    this.assertProposalCreatorEligibility(userId, group, scope);

    const prCost =
      PR_COST_BY_SCOPE[scope as keyof typeof PR_COST_BY_SCOPE] || 50;

    await participationRightsService.spend(
      userId,
      prCost,
      ParticipationRightsReason.PROPOSAL_CREATED,
      { groupId: dto.groupId, scope, title: dto.title }
    );

    const kind = (dto.kind as ProposalKind) ?? ProposalKind.PROJECT;
    const isPolicy = kind === ProposalKind.POLICY;

    const proposalScope =
      (dto.proposalScope as ProposalScope) ??
      (dto.groupId ? ProposalScope.GROUP : ProposalScope.COMMUNITY);

    // For COMMUNITY-scope proposals, resolve the geography whose residents may
    // vote. National/system proposals (no group affiliation) stay unscoped.
    const target = await this.resolveTargetArea(
      group,
      proposalScope,
      dto.targetLevel
    );

    const proposal = await prisma.proposal.create({
      data: {
        groupId: dto.groupId,
        creatorId: userId,
        title: dto.title,
        description: dto.description,
        // Structured narrative — read directly by the Baraza council and shown
        // to voters as fields, rather than parsed back out of the description.
        problem: dto.problem ?? null,
        solution: dto.solution ?? null,
        fundingSource: dto.fundingSource ?? null,
        kind,
        // Policy proposals never carry a budget — they are decisions, not spends.
        budget: isPolicy ? null : dto.fundingAmountKes,
        proposalType: dto.isEmergency
          ? ProposalType.EMERGENCY
          : ProposalType.COMMUNITY_INITIATIVE,
        status: ProposalStatus.DRAFT,
        proposalScope,
        groupFundingAmount: isPolicy ? null : dto.groupFundingAmount,
        locationFundingRequest: isPolicy ? null : dto.locationFundingRequest,
        targetWardId: target.targetWardId,
        targetConstituencyId: target.targetConstituencyId,
        targetCountyId: target.targetCountyId,
      },
    });

    logger.info(
      { userId, groupId: dto.groupId, scope, prCost },
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

    if (proposal.status === ProposalStatus.DRAFT)
      return this.handleDraftStage({
        userId,
        proposalId,
        proposal,
        dto,
        callerSystemRoles,
      });
    if (proposal.status === ProposalStatus.PENDING_REVIEW)
      return this.handlePendingReviewStage({
        userId,
        proposalId,
        proposal,
        dto,
        callerSystemRoles,
      });

    throw ApiError.badRequest('Proposal is not in a reviewable state');
  }

  private async handleDraftStage({
    userId,
    proposalId,
    proposal,
    dto,
    callerSystemRoles,
  }: ReviewContext) {
    await this.assertDraftForwardAuth(
      userId,
      proposal.groupId,
      proposal.group,
      callerSystemRoles
    );

    if (dto.decision === 'REJECT') {
      return this.rejectAtDraftStage(proposalId, proposal, userId, dto.note);
    }

    const fastTrack = await this.tryVoluntaryGroupScopeFastTrack(
      userId,
      proposalId,
      proposal,
      proposal.group
    );
    if (fastTrack) return fastTrack;

    return this.forwardToAdminReview(proposalId, proposal, userId);
  }

  private async rejectAtDraftStage(
    proposalId: string,
    proposal: ProposalWithGroup,
    userId: string,
    note?: string
  ) {
    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.REJECTED,
        reviewedById: userId,
        reviewNote: note ?? null,
      },
    });
    await auditService.log(
      userId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      proposalId,
      { newStatus: ProposalStatus.REJECTED, stage: 1, title: proposal.title }
    );
    if (proposal.creatorId) {
      notificationService
        .send({
          userId: proposal.creatorId,
          type: NotificationType.PROPOSAL_REJECTED,
          title: 'Proposal rejected',
          message: `"${proposal.title}" was rejected at stage 1.${note ? ` Note: ${note}` : ''}`,
          data: { proposalId },
        })
        .catch(() => {});
    }
    return updated;
  }

  private async forwardToAdminReview(
    proposalId: string,
    proposal: ProposalWithGroup,
    userId: string
  ) {
    this.assertVoluntaryLocationAffiliation(proposal.group);
    const forwarded = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.PENDING_REVIEW },
    });
    await auditService.log(
      userId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      proposalId,
      {
        newStatus: ProposalStatus.PENDING_REVIEW,
        stage: 1,
        title: proposal.title,
      }
    );
    if (proposal.creatorId) {
      notificationService
        .send({
          userId: proposal.creatorId,
          type: NotificationType.PROPOSAL_SUBMITTED,
          title: 'Proposal forwarded for review',
          message: `"${proposal.title}" has been forwarded to the location administrator for review.`,
          data: { proposalId },
        })
        .catch(() => {});
    }
    return forwarded;
  }

  private async assertDraftForwardAuth(
    userId: string,
    groupId: string | null,
    group: ProposalWithGroup['group'],
    callerSystemRoles: string[]
  ) {
    if (group?.isSystemGroup) {
      if (!canLocationAdminApprove(group, callerSystemRoles))
        throw ApiError.forbidden(
          `Requires ${requiredRoleLabel(group)} to forward this proposal`
        );
      return;
    }
    const membership = groupId
      ? await prisma.groupMember.findFirst({
          where: { userId, groupId, active: true },
          select: { role: true },
        })
      : null;
    if (!membership || membership.role !== 'LEADER')
      throw ApiError.forbidden(
        'Only the group leader can forward proposals for review'
      );
  }

  private async tryVoluntaryGroupScopeFastTrack(
    userId: string,
    proposalId: string,
    proposal: ProposalWithGroup,
    group: ProposalWithGroup['group']
  ) {
    const isVoluntary = !!group?.voluntaryType;
    const isGroupScoped = proposal.proposalScope === ProposalScope.GROUP;
    if (!isVoluntary || !isGroupScoped) return null;

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.APPROVED_FOR_VOTING },
    });
    await auditService.log(
      userId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      proposalId,
      {
        newStatus: ProposalStatus.APPROVED_FOR_VOTING,
        stage: 1,
        title: proposal.title,
      }
    );
    if (proposal.creatorId) {
      notificationService
        .send({
          userId: proposal.creatorId,
          type: NotificationType.PROPOSAL_APPROVED,
          title: 'Proposal approved for voting',
          message: `"${proposal.title}" is approved — you can now open voting.`,
          data: { proposalId },
        })
        .catch(() => {});
    }
    // HOOK 1 — Baraza deliberation on fast-track approval (best-effort, dormant
    // without DASHSCOPE_API_KEY).
    if (proposal.groupId)
      queueBarazaDeliberation(proposalId, proposal.groupId, 'AUTO').catch(
        () => {}
      );
    return updated;
  }

  // Resolve the concrete target geography for a COMMUNITY-scope proposal.
  // - GROUP scope → no target (internal vote among members).
  // - COMMUNITY scope, group has a location → resolve to the chosen level
  //   (defaults to the group's own anchor level), filling in parent IDs.
  // - COMMUNITY scope, no location:
  //     • voluntary group → reject (must affiliate first)
  //     • system group    → national proposal, no target (anyone may vote).
  private async resolveTargetArea(
    group: ProposalWithGroup['group'],
    proposalScope: ProposalScope,
    targetLevel?: 'WARD' | 'CONSTITUENCY' | 'COUNTY'
  ): Promise<{
    targetWardId: string | null;
    targetConstituencyId: string | null;
    targetCountyId: string | null;
  }> {
    const none = {
      targetWardId: null,
      targetConstituencyId: null,
      targetCountyId: null,
    };
    if (proposalScope !== ProposalScope.COMMUNITY) return none;

    let wardId = group?.wardId ?? null;
    let constituencyId = group?.constituencyId ?? null;
    let countyId = group?.countyId ?? null;

    const hasLocation = !!(wardId || constituencyId || countyId);
    if (!hasLocation) {
      // Voluntary groups must be affiliated; system groups are national.
      this.assertVoluntaryLocationAffiliation(group);
      return none;
    }

    // Fill in the parent hierarchy from whatever anchor the group has.
    if (wardId && (!constituencyId || !countyId)) {
      const ward = await prisma.ward.findUnique({
        where: { id: wardId },
        select: { constituencyId: true, countyId: true },
      });
      constituencyId = constituencyId ?? ward?.constituencyId ?? null;
      countyId = countyId ?? ward?.countyId ?? null;
    } else if (constituencyId && !countyId) {
      const c = await prisma.constituency.findUnique({
        where: { id: constituencyId },
        select: { countyId: true },
      });
      countyId = countyId ?? c?.countyId ?? null;
    }

    const level =
      targetLevel ??
      (wardId ? 'WARD' : constituencyId ? 'CONSTITUENCY' : 'COUNTY');

    if (level === 'WARD') {
      if (!wardId)
        throw ApiError.badRequest(
          'This group is not affiliated with a ward — choose a constituency or county scope.'
        );
      return { ...none, targetWardId: wardId };
    }
    if (level === 'CONSTITUENCY') {
      if (!constituencyId)
        throw ApiError.badRequest(
          'No constituency affiliation could be resolved for this group.'
        );
      return { ...none, targetConstituencyId: constituencyId };
    }
    if (!countyId)
      throw ApiError.badRequest(
        'No county affiliation could be resolved for this group.'
      );
    return { ...none, targetCountyId: countyId };
  }

  private assertVoluntaryLocationAffiliation(
    group: ProposalWithGroup['group']
  ) {
    if (
      group?.voluntaryType &&
      !group.wardId &&
      !group.constituencyId &&
      !group.countyId
    ) {
      throw ApiError.badRequest(
        'This voluntary group has no location affiliation. Associate the group with a ward, constituency, or county before creating community proposals.'
      );
    }
  }

  private async handlePendingReviewStage({
    userId,
    proposalId,
    proposal,
    dto,
    callerSystemRoles,
  }: ReviewContext) {
    const group = proposal.group;
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
      { newStatus, stage: 2, title: proposal.title }
    );
    if (proposal.creatorId)
      this.notifyReviewOutcome(
        proposal.creatorId,
        proposalId,
        proposal.title,
        newStatus,
        dto.note
      );
    // HOOK 2 — Baraza deliberation on admin approval (best-effort, dormant
    // without DASHSCOPE_API_KEY).
    if (newStatus === ProposalStatus.APPROVED_FOR_VOTING && proposal.groupId)
      queueBarazaDeliberation(proposalId, proposal.groupId, 'ADMIN').catch(
        () => {}
      );
    return updated;
  }

  private notifyReviewOutcome(
    creatorId: string,
    proposalId: string,
    title: string,
    newStatus: ProposalStatus,
    note?: string | null
  ): void {
    const approved = newStatus === ProposalStatus.APPROVED_FOR_VOTING;
    notificationService
      .send({
        userId: creatorId,
        type: approved
          ? NotificationType.PROPOSAL_APPROVED
          : NotificationType.PROPOSAL_REJECTED,
        title: approved ? 'Proposal approved for voting' : 'Proposal rejected',
        message: approved
          ? `"${title}" has been approved by the administrator — you can now open voting.`
          : `"${title}" was rejected by the administrator.${note ? ` Note: ${note}` : ''}`,
        data: { proposalId },
      })
      .catch(() => {});
  }

  async startVoting(
    userId: string,
    proposalId: string,
    callerSystemRoles: string[] = []
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { group: true },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== ProposalStatus.APPROVED_FOR_VOTING)
      throw ApiError.badRequest(
        'Proposal must be approved before voting can start'
      );

    await assertStartVotingAuth(userId, proposal, callerSystemRoles);

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

    await auditService.log(
      userId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      proposalId,
      { newStatus: ProposalStatus.VOTING, title: proposal.title }
    );

    // Distil the (now-frozen) community annotations into a neutral deliberation
    // digest, asynchronously. No-op when CLAUDE_API_KEY is unset.
    await governanceQueue.add(
      GENERATE_DELIBERATION_SUMMARY_JOB,
      { proposalId },
      { jobId: `delib-${proposalId}` }
    );

    // Open the on-chain voting window so users can cast self-signed votes.
    // Runs on the worker (which holds the blockchain env); no-op if unconfigured.
    await governanceQueue.add(
      OPEN_PROPOSAL_ONCHAIN_JOB,
      { proposalId },
      { jobId: `open-${proposalId}` }
    );

    await this.notifyGroupVotingStarted(proposalId, proposal, days);

    return { startsAt, endsAt };
  }

  private async notifyGroupVotingStarted(
    proposalId: string,
    proposal: ProposalWithGroup,
    days: number
  ) {
    if (!proposal.groupId) return;
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

  async cancelProposal(userId: string, proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { creatorId: true, status: true, title: true },
    });
    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.creatorId !== userId)
      throw ApiError.forbidden('Only the proposal creator can cancel it');
    if (!['DRAFT', 'PENDING_REVIEW'].includes(proposal.status as string))
      throw ApiError.badRequest(
        'Proposals can only be cancelled while in Draft or Pending Review'
      );

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.CANCELLED },
    });
    await auditService.log(
      userId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      proposalId,
      { newStatus: ProposalStatus.CANCELLED, title: proposal.title }
    );
    return updated;
  }

  async resubmitProposal(userId: string, proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        creatorId: true,
        status: true,
        title: true,
        resubmissionCount: true,
        reviewNote: true,
      },
    });
    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.creatorId !== userId)
      throw ApiError.forbidden('Only the proposal creator can resubmit it');
    if (proposal.status !== ProposalStatus.REJECTED)
      throw ApiError.badRequest('Only rejected proposals can be resubmitted');
    if (proposal.resubmissionCount >= 3)
      throw ApiError.badRequest(
        'This proposal has reached the maximum number of resubmissions (3)'
      );

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.DRAFT,
        resubmissionCount: { increment: 1 },
        votesFor: 0,
        votesAgainst: 0,
        quorum: 0,
        approvalThreshold: 0,
        votingStartsAt: null,
        votingEndsAt: null,
        reviewedById: null,
      },
    });

    await auditService.log(
      userId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      proposalId,
      {
        from: ProposalStatus.REJECTED,
        to: ProposalStatus.DRAFT,
        resubmissionCount: updated.resubmissionCount,
        title: proposal.title,
      }
    );

    return updated;
  }

  async updateProgress(
    userId: string,
    proposalId: string,
    dto: { status: 'EXECUTING' | 'COMPLETED'; note?: string }
  ) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        creatorId: true,
        status: true,
        groupId: true,
        title: true,
        kind: true,
        groupFundingAmount: true,
        project: { select: { id: true } },
      },
    });
    if (!proposal) throw ApiError.notFound('Proposal');

    const isPolicy = proposal.kind === ProposalKind.POLICY;

    // Policy proposals are decisions, not work: they complete straight from
    // APPROVED and are never EXECUTED. Project proposals run APPROVED →
    // EXECUTING → COMPLETED.
    const validTransitions: Record<string, string[]> = isPolicy
      ? { APPROVED: ['COMPLETED'] }
      : { APPROVED: ['EXECUTING'], EXECUTING: ['COMPLETED'] };
    if (!validTransitions[proposal.status as string]?.includes(dto.status))
      throw ApiError.badRequest(
        isPolicy && dto.status === 'EXECUTING'
          ? 'Policy proposals are recorded as decisions, not executed.'
          : `Cannot transition from ${proposal.status} to ${dto.status}`
      );

    // Completing a policy must record what was decided (ward memory).
    if (isPolicy && dto.status === 'COMPLETED' && !dto.note?.trim())
      throw ApiError.badRequest(
        'Recording the decision outcome is required to complete a policy proposal.'
      );

    await this.assertCreatorOrLeaderAuth(userId, proposal, 'update progress');

    // Project proposals must pass through the setup gate (define milestones →
    // a project exists) before execution can start. This also makes the
    // disbursement below the single, coordinated treasury debit.
    if (
      !isPolicy &&
      proposal.status === ProposalStatus.APPROVED &&
      dto.status === 'EXECUTING' &&
      !proposal.project
    )
      throw ApiError.badRequest(
        'Set up the project (define its milestones) before starting execution.'
      );

    const fundAmount =
      dto.status === 'EXECUTING' && proposal.groupId
        ? Number(proposal.groupFundingAmount ?? 0)
        : 0;

    if (fundAmount > 0 && proposal.groupId) {
      await this.assertTreasuryFunds(proposal.groupId, fundAmount);
    }

    const newStatus = dto.status as ProposalStatus;
    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: newStatus,
        ...(dto.note ? { outcome: dto.note } : {}),
      },
    });

    if (fundAmount > 0 && proposal.groupId) {
      await this.disburseTreasury(
        proposal.groupId,
        fundAmount,
        proposalId,
        proposal.title,
        userId
      );
    }

    await auditService.log(
      userId,
      AuditAction.PROPOSAL_STATUS_CHANGED,
      'Proposal',
      proposalId,
      { newStatus, title: proposal.title }
    );
    if (proposal.creatorId)
      this.notifyProgressUpdate(
        proposal.creatorId,
        proposalId,
        proposal.title,
        newStatus
      );
    return updated;
  }

  private notifyProgressUpdate(
    creatorId: string,
    proposalId: string,
    title: string,
    newStatus: string
  ): void {
    const executing = newStatus === 'EXECUTING';
    notificationService
      .send({
        userId: creatorId,
        type: NotificationType.PROPOSAL_APPROVED,
        title: executing ? 'Proposal execution started' : 'Proposal completed',
        message: executing
          ? `"${title}" has been marked as in progress.`
          : `"${title}" has been marked as completed.`,
        data: { proposalId },
      })
      .catch(() => {});
  }

  private async assertTreasuryFunds(
    groupId: string,
    amount: number
  ): Promise<void> {
    const treasury = await prisma.groupTreasury.findUnique({
      where: { groupId },
    });
    if (!treasury)
      throw ApiError.badRequest(
        'Group treasury does not exist — fund the treasury before executing this proposal'
      );
    if (Number(treasury.balance) < amount)
      throw ApiError.badRequest(
        `Insufficient treasury balance for proposal disbursement (required: ${amount}, available: ${Number(treasury.balance)})`
      );
  }

  private async disburseTreasury(
    groupId: string,
    amount: number,
    proposalId: string,
    title: string,
    userId: string
  ): Promise<void> {
    await treasuryService.withdraw(
      groupId,
      {
        amount,
        description: `Proposal disbursement: ${title}`,
        referenceType: 'PROPOSAL',
        proposalId,
      },
      userId
    );
    logger.info(
      { proposalId, groupId, fundAmount: amount },
      '[TREASURY] Proposal disbursement debited on EXECUTING transition'
    );
  }

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

  async recordOutcome(userId: string, proposalId: string, outcome: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        creatorId: true,
        status: true,
        groupId: true,
        rationale: true,
        alternatives: true,
        deliberationSummary: true,
      },
    });
    if (!proposal) throw ApiError.notFound('Proposal');

    const passedStatuses = ['APPROVED', 'EXECUTING', 'COMPLETED'];
    if (!passedStatuses.includes(proposal.status as string))
      throw ApiError.badRequest(
        'Outcome can only be recorded for passed proposals'
      );

    await this.assertCreatorOrLeaderAuth(userId, proposal, 'record outcomes');

    const outcomeRecordedAt = new Date();
    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { outcome, outcomeRecordedAt },
      select: {
        id: true,
        outcome: true,
        outcomeRecordedAt: true,
        memoryAnchorTxHash: true,
      },
    });

    // Close the deliberation memory loop: teach the 7 agents how this proposal
    // actually turned out, against what each of them argued. Best-effort.
    await recordProposalOutcomeInMemory(proposalId, outcome);

    // Anchor the complete ward-memory record on-chain. No-op until the chain is
    // configured; the off-chain record above is authoritative regardless.
    const anchorTxHash = await anchorMemoryOnChain(proposalId, userId, {
      rationale: proposal.rationale,
      alternatives: proposal.alternatives,
      outcome,
      outcomeRecordedAt,
      deliberationSummary: proposal.deliberationSummary,
    });
    if (anchorTxHash) {
      const patched = await prisma.proposal.update({
        where: { id: proposalId },
        data: { memoryAnchorTxHash: anchorTxHash },
        select: {
          id: true,
          outcome: true,
          outcomeRecordedAt: true,
          memoryAnchorTxHash: true,
        },
      });
      return patched;
    }

    return updated;
  }

  private async assertCreatorOrLeaderAuth(
    userId: string,
    proposal: { creatorId: string | null; groupId: string | null },
    action: string
  ): Promise<void> {
    if (proposal.creatorId === userId) return;
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
    if (!isLeader)
      throw ApiError.forbidden(
        `Only the proposal creator or group leader can ${action}`
      );
  }
}

export const proposalLifecycleService = new ProposalLifecycleService();

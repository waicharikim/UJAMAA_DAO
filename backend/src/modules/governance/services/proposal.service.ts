/**
 * @file src/modules/governance/services/proposal.service.ts
 * @description
 * Proposal Service — Group-Scoped Governance
 *
 * Version: 2.1 — February 2026
 * Updated: Align with actual Prisma schema (GroupMemberVote, ProposalStatus, budget)
 */

import { ProposalStatus, ProposalType } from "@prisma/client";
import { prisma } from "../../../core/database/client.js";
import { participationRightsService } from "../../economy/services/participationRights.service.js";
import { ParticipationRightsReason } from "../../economy/types.js";
import { globalImpactPointService } from "../../reputation/service/impactPoint.service.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { PR_COST_BY_SCOPE, IP_PERCENTILE_THRESHOLD, CastVoteDto, CreateProposalDto, VoteOption } from "../types.js";

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
          orderBy: { user: { globalImpactPoints: "desc" } },
        },
      },
    });

    if (!group) throw ApiError.notFound("Group", dto.groupId);

    const membership = group.members.find(m => m.userId === userId);
    if (!membership) throw ApiError.forbidden("You are not a member of this group");

    const scope = group.locationScope || "VOLUNTARY";
    const prCost = PR_COST_BY_SCOPE[scope as keyof typeof PR_COST_BY_SCOPE] || 50;
    const requiredPercentile = IP_PERCENTILE_THRESHOLD[scope as keyof typeof IP_PERCENTILE_THRESHOLD] || 1.0;

    const ips = group.members.map(m => m.user.globalImpactPoints);
    const userRank = ips.filter(ip => ip > membership.user.globalImpactPoints).length + 1;
    const percentile = userRank / ips.length;

    if (percentile > requiredPercentile) {
      throw ApiError.forbidden(`You need to be in the top ${(requiredPercentile * 100).toFixed(0)}% of IP in this group`);
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
        proposalType: dto.isEmergency ? ProposalType.EMERGENCY : ProposalType.COMMUNITY_INITIATIVE,
        status: ProposalStatus.DRAFT,
      },
    });

    logger.info({ userId, groupId: dto.groupId, scope, prCost, percentile }, "Proposal created");

    return proposal;
  }

  /**
   * Start voting period
   */
  async startVoting(userId: string, proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { group: true },
    });

    if (!proposal) throw ApiError.notFound("Proposal");
    if (proposal.creatorId !== userId) throw ApiError.forbidden("Only creator can start voting");
    if (proposal.status !== ProposalStatus.DRAFT) throw ApiError.badRequest("Proposal not in draft");

    const isEmergency = proposal.proposalType === ProposalType.EMERGENCY;
    const groupScope = proposal.group?.locationScope;
    const days = isEmergency ? 3 : groupScope === "NATIONAL" ? 21 : 7;
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

    logger.info({ proposalId, days }, "Voting started");

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

    if (!proposal) throw ApiError.notFound("Proposal");
    if (proposal.status !== ProposalStatus.VOTING) throw ApiError.badRequest("Voting not active");
    if (!proposal.group || !proposal.group.members.length) throw ApiError.forbidden("Not a member");

    const groupId = proposal.groupId!;

    const existing = await prisma.groupMemberVote.findUnique({
      where: { groupId_memberId_proposalId: { groupId, memberId: userId, proposalId: dto.proposalId } },
    });

    if (existing) throw ApiError.conflict("Already voted");

    await participationRightsService.spend(userId, 5, ParticipationRightsReason.VOTED, { proposalId: dto.proposalId });

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

    logger.info({ userId, proposalId: dto.proposalId, option: dto.option, weight }, "Vote cast");

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

    if (!proposal) throw ApiError.notFound("Proposal");
    if (proposal.status !== ProposalStatus.VOTING) return;

    const totalEligible = await prisma.groupMember.count({ where: { groupId: proposal.groupId ?? undefined } });
    const totalVoteWeight = proposal.votes.reduce((sum, v) => sum + v.voteWeight, 0);
    const yesWeight = proposal.votes.filter(v => v.vote === true).reduce((sum, v) => sum + v.voteWeight, 0);

    const quorum = totalVoteWeight / totalEligible >= 0.4;
    const approved = totalVoteWeight > 0 && yesWeight / totalVoteWeight >= 0.5;

    const newStatus = quorum && approved ? ProposalStatus.APPROVED : ProposalStatus.REJECTED;

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: newStatus },
    });

    logger.info({ proposalId, quorum, approved, newStatus }, "Proposal tallied");

    return { newStatus, quorum, approved };
  }
}

export const proposalService = new ProposalService();

import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import * as ImpactPointService from './impactPoint.service.js';
import * as TokenService from './token.service.js';
import { GroupVoteService } from './groupVote.service.js'; // Correct import

export class VoteService {
  static async castIndividualVote(
    proposalId: string,
    userId: string,
    vote: boolean,
    tokensSpent: number
  ) {
    await this.validateIndividualVotingEligibility(userId, proposalId);

    const tokenBalance = await TokenService.getTokenBalance('USER', userId);
    if (tokenBalance < tokensSpent) {
      throw new ApiError('Insufficient tokens to cast vote', 403);
    }

    await TokenService.updateTokenBalance({
      holderType: 'USER',
      holderId: userId,
      amount: -tokensSpent,
    });

    const existingVote = await prisma.vote.findFirst({
      where: { proposalId, voterId: userId, isGroup: false },
    });
    if (existingVote) {
      throw new ApiError('User has already voted on this proposal', 409);
    }

    return prisma.vote.create({
      data: {
        proposalId,
        voterId: userId,
        isGroup: false,
        vote,
        tokensSpent,
      },
    });
  }

  static async castGroupVote(proposalId: string, groupId: string, vote: boolean) {
    const quorumPassed = await GroupVoteService.checkGroupQuorum(proposalId, groupId);
    if (!quorumPassed) {
      throw new ApiError('Group vote quorum or consensus not met', 403);
    }

    const existingVote = await prisma.vote.findFirst({
      where: { proposalId, voterId: groupId, isGroup: true },
    });
    if (existingVote) {
      throw new ApiError('Group has already voted on this proposal', 409);
    }

    // Get count of members voting yes for potential weighting
    const memberCountAgreeing = await GroupVoteService.countGroupMembersVotingYes(proposalId, groupId);

    return prisma.vote.create({
      data: {
        proposalId,
        voterId: groupId,
        isGroup: true,
        vote,
        tokensSpent: 0,
        // weight: memberCountAgreeing, // Add if your schema supports it
      },
    });
  }

  static async validateIndividualVotingEligibility(userId: string, proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });
    if (!proposal) {
      throw new ApiError('Proposal not found', 404);
    }

    const points = await ImpactPointService.getImpactPoints(
      'USER',
      userId,
      proposal.locationScope,
      proposal.constituency || undefined,
      proposal.county || undefined
    );

    if (points < 100) {
      throw new ApiError('User does not meet the minimum impact points required to vote', 403);
    }
  }

  static async getVoteTally(proposalId: string) {
    const individualVotes = await prisma.vote.findMany({
      where: { proposalId, isGroup: false },
    });

    const groupVotes = await prisma.vote.findMany({
      where: { proposalId, isGroup: true },
    });

    const individualYes = individualVotes.filter(v => v.vote).length;
    const individualNo = individualVotes.length - individualYes;
    const groupYes = groupVotes.filter(v => v.vote).length;
    const groupNo = groupVotes.length - groupYes;

    return {
      individualYes,
      individualNo,
      groupYes,
      groupNo,
      totalYes: individualYes + groupYes,
      totalNo: individualNo + groupNo,
      totalVotes: individualVotes.length + groupVotes.length,
    };
  }
}
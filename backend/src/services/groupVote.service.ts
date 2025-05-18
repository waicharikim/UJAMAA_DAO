import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';

export class GroupVoteService {
  /**
   * Records a member's internal vote within a group for a proposal.
   */
  static async castMemberVote(proposalId: string, groupId: string, userId: string, vote: boolean) {
    // Verify user is active member of group
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId, active: true },
    });
    if (!member) {
      throw new ApiError('User is not an active member of the group', 403);
    }

    // Check if user already voted
    const existing = await prisma.groupMemberVote.findUnique({
      where: {
        proposalId_groupId_userId: {
          proposalId,
          groupId,
          userId,
        },
      },
    });
    if (existing) {
      throw new ApiError('User has already voted in this group for this proposal', 409);
    }

    return prisma.groupMemberVote.create({
      data: { proposalId, groupId, userId, vote },
    });
  }

  /**
   * Checks if group internal votes meet quorum and consensus.
   */
  static async checkGroupQuorum(proposalId: string, groupId: string): Promise<boolean> {
    const memberCount = await prisma.groupMember.count({
      where: { groupId, active: true },
    });
    if (memberCount === 0) return false;

    const votes = await prisma.groupMemberVote.findMany({
      where: { proposalId, groupId },
    });
    const totalVotes = votes.length;

    if (totalVotes / memberCount < 0.75) return false; // Quorum

    const yesVotes = votes.filter(v => v.vote).length;
    const noVotes = totalVotes - yesVotes;
    const majority = yesVotes > noVotes ? yesVotes : noVotes;

    return majority / totalVotes >= 0.68; // Consensus
  }

  /**
   * Counts how many members voted yes in the group for the proposal.
   */
  static async countGroupMembersVotingYes(proposalId: string, groupId: string): Promise<number> {
    return prisma.groupMemberVote.count({
      where: { proposalId, groupId, vote: true },
    });
  }
}
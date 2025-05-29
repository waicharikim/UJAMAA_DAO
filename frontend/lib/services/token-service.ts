import type { User, Group, Proposal } from "../types/governance"

export class TokenService {
  // Token earning mechanisms
  static calculateTokenReward(
    action: "vote" | "propose" | "milestone" | "invite" | "course",
    level?: "LOCAL" | "CONSTITUENCY" | "COUNTY" | "NATIONAL",
  ): number {
    const rewards = {
      vote: {
        LOCAL: 1,
        CONSTITUENCY: 2,
        COUNTY: 5,
        NATIONAL: 10,
      },
      propose: {
        LOCAL: 5,
        CONSTITUENCY: 10,
        COUNTY: 25,
        NATIONAL: 50,
      },
      milestone: {
        LOCAL: 10,
        CONSTITUENCY: 20,
        COUNTY: 50,
        NATIONAL: 100,
      },
      invite: 5, // Global reward
      course: 10, // Global reward
    }

    if (level && rewards[action] && typeof rewards[action] === "object") {
      return (rewards[action] as any)[level] || 0
    }

    return typeof rewards[action] === "number" ? rewards[action] : 0
  }

  // Token spending for voting
  static calculateVotingCost(proposal: Proposal): number {
    const baseCosts = {
      LOCAL: 1,
      CONSTITUENCY: 2,
      COUNTY: 5,
      NATIONAL: 10,
    }

    const typeMultipliers = {
      BUSINESS: 1.5,
      NON_PROFIT: 1.0,
      BILL: 2.0,
    }

    const baseCost = baseCosts[proposal.locationScope as keyof typeof baseCosts] || 1
    const multiplier = typeMultipliers[proposal.proposalType as keyof typeof typeMultipliers] || 1

    return Math.ceil(baseCost * multiplier)
  }

  // Check if user has sufficient tokens for action
  static checkTokenSufficiency(
    user: User,
    action: "vote" | "fund",
    amount: number,
  ): { sufficient: boolean; shortfall?: number } {
    const sufficient = user.tokenBalance >= amount

    return {
      sufficient,
      shortfall: sufficient ? undefined : amount - user.tokenBalance,
    }
  }

  // Token transfer validation
  static validateTransfer(from: User | Group, to: User | Group, amount: number): { valid: boolean; reason?: string } {
    if (amount <= 0) {
      return { valid: false, reason: "Transfer amount must be positive" }
    }

    if (from.tokenBalance < amount) {
      return { valid: false, reason: "Insufficient token balance" }
    }

    // Additional business rules can be added here
    return { valid: true }
  }

  // Token staking (future feature)
  static calculateStakingRewards(
    stakedAmount: number,
    stakingPeriod: number, // in days
    level: string,
  ): number {
    const baseRate = 0.05 // 5% annual rate
    const levelMultipliers = {
      LOCAL: 1.0,
      CONSTITUENCY: 1.2,
      COUNTY: 1.5,
      NATIONAL: 2.0,
    }

    const multiplier = levelMultipliers[level as keyof typeof levelMultipliers] || 1.0
    const annualReward = stakedAmount * baseRate * multiplier

    return (annualReward * stakingPeriod) / 365
  }

  // Group token management
  static checkGroupSpendingApproval(
    group: Group,
    amount: number,
    votes: { userId: string; approved: boolean }[],
  ): { approved: boolean; quorumMet: boolean; consensusAchieved: boolean } {
    const activeMembers = group.members.filter((m) => m.active).length
    const requiredQuorum = Math.ceil(activeMembers * 0.75) // 75%
    const requiredConsensus = Math.ceil(votes.length * 0.68) // 68%

    const quorumMet = votes.length >= requiredQuorum
    const approvalVotes = votes.filter((v) => v.approved).length
    const consensusAchieved = approvalVotes >= requiredConsensus

    return {
      approved: quorumMet && consensusAchieved,
      quorumMet,
      consensusAchieved,
    }
  }

  // Token burning for deflationary mechanics
  static calculateBurnAmount(totalSupply: number, transactionVolume: number): number {
    // Burn 0.1% of transaction volume
    return Math.floor(transactionVolume * 0.001)
  }
}

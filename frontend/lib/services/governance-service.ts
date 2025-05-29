import type { User, Proposal, Group } from "../types/governance"

export class GovernanceService {
  // Impact Points & Eligibility
  static calculateCombinedImpactPoints(user: User, locationScope: string): number {
    const globalPoints = user.impactPoints.global || 0
    const locationPoints = user.impactPoints.byLocation[locationScope] || 0
    return globalPoints + locationPoints
  }

  static checkProposalEligibility(
    user: User,
    locationScope: string,
  ): {
    canPropose: boolean
    reason?: string
    requiredPercentile: number
  } {
    const thresholds = {
      CONSTITUENCY: 95, // Top 5%
      COUNTY: 85, // Top 15%
      NATIONAL: 75, // Top 25%
    }

    const requiredPercentile = thresholds[locationScope as keyof typeof thresholds] || 100
    const userPoints = this.calculateCombinedImpactPoints(user, locationScope)

    // This would need actual percentile calculation from backend
    const userPercentile = this.calculateUserPercentile(userPoints, locationScope)

    const canPropose = userPercentile >= requiredPercentile

    return {
      canPropose,
      reason: canPropose
        ? undefined
        : `You need to be in the top ${100 - requiredPercentile}% of impact point holders in this ${locationScope.toLowerCase()}.`,
      requiredPercentile,
    }
  }

  static checkVotingEligibility(
    user: User,
    proposal: Proposal,
  ): {
    canVote: boolean
    reason?: string
    tokenCost: number
  } {
    const participationThresholds = {
      CONSTITUENCY: 1,
      COUNTY: 2,
      NATIONAL: 3,
    }

    const requiredParticipation =
      participationThresholds[proposal.locationScope as keyof typeof participationThresholds] || 0
    const userParticipation =
      user.participationHistory[proposal.locationScope.toLowerCase() as keyof typeof user.participationHistory] || 0

    const hasParticipation = userParticipation >= requiredParticipation
    const tokenCost = this.calculateVotingCost(proposal)
    const hasTokens = user.tokenBalance >= tokenCost

    const canVote = hasParticipation && hasTokens

    let reason: string | undefined
    if (!hasParticipation) {
      reason = `You need to participate in at least ${requiredParticipation} project(s) at the ${proposal.locationScope.toLowerCase()} level.`
    } else if (!hasTokens) {
      reason = `You need ${tokenCost} tokens to vote on this proposal.`
    }

    return { canVote, reason, tokenCost }
  }

  static calculateVotingCost(proposal: Proposal): number {
    // Base cost varies by proposal level and type
    const baseCosts = {
      LOCAL: 1,
      CONSTITUENCY: 2,
      COUNTY: 5,
      NATIONAL: 10,
    }

    const multipliers = {
      BUSINESS: 1.5,
      NON_PROFIT: 1.0,
      BILL: 2.0,
    }

    const baseCost = baseCosts[proposal.locationScope as keyof typeof baseCosts] || 1
    const multiplier = multipliers[proposal.proposalType as keyof typeof multipliers] || 1

    return Math.ceil(baseCost * multiplier)
  }

  static calculateGroupQuorum(group: Group): {
    required: number
    current: number
    met: boolean
  } {
    const totalMembers = group.members.filter((m) => m.active).length
    const required = Math.ceil(totalMembers * 0.75) // 75% quorum

    return {
      required,
      current: 0, // Would be calculated based on actual votes
      met: false,
    }
  }

  static calculateGroupConsensus(votes: { vote: boolean }[]): {
    required: number
    current: number
    achieved: boolean
  } {
    const totalVotes = votes.length
    const yesVotes = votes.filter((v) => v.vote).length
    const required = Math.ceil(totalVotes * 0.68) // 68% consensus

    return {
      required,
      current: yesVotes,
      achieved: yesVotes >= required,
    }
  }

  private static calculateUserPercentile(userPoints: number, locationScope: string): number {
    // This would make an API call to get actual percentile ranking
    // For now, return a mock value
    return Math.random() * 100
  }

  // County Group Management
  static checkCountyGroupEligibility(user: User, county: string): boolean {
    // User can only be member of county groups for their registered counties
    return user.countyLive === county || user.countyOrigin === county
  }

  // Token Economics
  static calculateTokenRewards(action: string, level: string): number {
    const baseRewards = {
      vote: { LOCAL: 1, CONSTITUENCY: 2, COUNTY: 5, NATIONAL: 10 },
      propose: { LOCAL: 5, CONSTITUENCY: 10, COUNTY: 25, NATIONAL: 50 },
      milestone: { LOCAL: 10, CONSTITUENCY: 20, COUNTY: 50, NATIONAL: 100 },
    }

    return baseRewards[action as keyof typeof baseRewards]?.[level as keyof typeof baseRewards.vote] || 0
  }

  // Privacy & Visibility
  static filterUserDataByPrivacy(user: User, requesterRoles: string[]): Partial<User> {
    const isSuperAdmin = requesterRoles.includes("system:super_admin")
    const isGroupMember = requesterRoles.some((r) => r.startsWith("group:"))

    const result: Partial<User> = {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
    }

    interface PrivacySettings {
      email: string
      phoneNumber: string
      walletAddress: string
      countyLive: string
      constituencyLive: string
      countyOrigin: string
      constituencyOrigin: string
    }

    const canViewField = (field: keyof PrivacySettings): boolean => {
      if (isSuperAdmin) return true
      const setting = user.privacySettings[field]

      switch (setting) {
        case "public":
          return true
        case "group":
          return isGroupMember
        case "private":
          return false
        default:
          return false
      }
    }

    if (canViewField("email")) result.email = user.email
    if (canViewField("phoneNumber")) result.phoneNumber = user.phoneNumber
    if (canViewField("walletAddress")) result.walletAddress = user.walletAddress
    if (canViewField("countyLive")) result.countyLive = user.countyLive
    if (canViewField("constituencyLive")) result.constituencyLive = user.constituencyLive
    if (canViewField("countyOrigin")) result.countyOrigin = user.countyOrigin
    if (canViewField("constituencyOrigin")) result.constituencyOrigin = user.constituencyOrigin

    return result
  }
}

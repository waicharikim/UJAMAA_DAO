import type { User, Group } from "../types/governance"

export class ImpactPointsService {
  // Award impact points based on activity and level
  static awardPoints(
    userId: string,
    activity: string,
    level: "LOCAL" | "CONSTITUENCY" | "COUNTY" | "NATIONAL",
    projectId?: string,
  ): number {
    const pointValues = {
      LOCAL: {
        project_participation: 10,
        milestone_completion: 15,
        vote_cast: 2,
        proposal_created: 25,
      },
      CONSTITUENCY: {
        project_participation: 20,
        milestone_completion: 30,
        vote_cast: 5,
        proposal_created: 50,
      },
      COUNTY: {
        project_participation: 50,
        milestone_completion: 75,
        vote_cast: 10,
        proposal_created: 100,
      },
      NATIONAL: {
        project_participation: 100,
        milestone_completion: 150,
        vote_cast: 20,
        proposal_created: 200,
      },
    }

    // Global activities (not tied to location)
    const globalActivities = {
      invite_member: 5,
      complete_course: 10,
      community_moderation: 15,
      bug_report: 8,
      platform_improvement: 20,
    }

    if (globalActivities[activity as keyof typeof globalActivities]) {
      return globalActivities[activity as keyof typeof globalActivities]
    }

    return pointValues[level]?.[activity as keyof typeof pointValues.LOCAL] || 0
  }

  // Calculate percentile ranking for proposal eligibility
  static async calculatePercentileRanking(
    userPoints: number,
    locationScope: string,
    allUsersPoints: number[],
  ): Promise<number> {
    const sortedPoints = allUsersPoints.sort((a, b) => b - a)
    const userRank = sortedPoints.findIndex((points) => points <= userPoints) + 1
    const percentile = ((sortedPoints.length - userRank + 1) / sortedPoints.length) * 100

    return Math.round(percentile)
  }

  // Check if user meets minimum thresholds for actions
  static checkActionEligibility(
    user: User,
    action: "propose" | "vote" | "admin_election",
    locationScope: string,
  ): { eligible: boolean; reason?: string } {
    const combinedPoints = this.getCombinedPoints(user, locationScope)

    const thresholds = {
      propose: {
        CONSTITUENCY: 95,
        COUNTY: 85,
        NATIONAL: 75,
      },
      vote: {
        CONSTITUENCY: 0, // No threshold for voting
        COUNTY: 0,
        NATIONAL: 0,
      },
      admin_election: {
        COUNTY: 99, // Top 1% for county admin eligibility
      },
    }

    const requiredPercentile = thresholds[action]?.[locationScope as keyof typeof thresholds.propose]

    if (requiredPercentile === undefined) {
      return { eligible: true }
    }

    // This would need actual percentile calculation from backend
    const userPercentile = 85 // Mock value

    const eligible = userPercentile >= requiredPercentile

    return {
      eligible,
      reason: eligible
        ? undefined
        : `You need to be in the top ${100 - requiredPercentile}% of impact point holders for this action.`,
    }
  }

  private static getCombinedPoints(user: User, locationScope: string): number {
    const globalPoints = user.impactPoints.global || 0
    const locationPoints = user.impactPoints.byLocation[locationScope] || 0
    return globalPoints + locationPoints
  }

  // Group impact points aggregation
  static calculateGroupImpactPoints(group: Group): number {
    return group.members.reduce((total, member) => {
      // This would fetch actual member impact points
      return total + 0 // Mock implementation
    }, 0)
  }

  // Impact points decay (for future implementation)
  static calculateDecay(points: number, lastActivity: Date): number {
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

    // Decay 1% per month of inactivity
    const monthsInactive = daysSinceActivity / 30
    const decayRate = Math.min(monthsInactive * 0.01, 0.5) // Max 50% decay

    return Math.floor(points * (1 - decayRate))
  }
}

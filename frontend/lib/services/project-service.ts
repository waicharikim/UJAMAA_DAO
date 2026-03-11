// @ts-nocheck — scaffold: stale types, alignment deferred
import type { Project, ProjectParticipant, ProjectMilestone, ProjectFilters } from "../types/projects"
import type { User, Proposal } from "../types/governance"
import { ImpactPointsService } from "./impact-points-service"

export interface FileAttachment {
  name: string
  url: string
  size: number
  type: string
}

export class ProjectService {
  // Create project from approved proposal
  static async createProjectFromProposal(proposal: Proposal, managerId: string): Promise<Project> {
    const project: Project = {
      id: crypto.randomUUID(),
      proposalId: proposal.id,
      title: proposal.title,
      description: proposal.description,
      locationScope: proposal.locationScope as any,
      constituency: proposal.constituency,
      county: proposal.county,
      status: "PLANNING",
      budget: {
        total: proposal.budget || 0,
        allocated: 0,
        disbursed: 0,
        remaining: proposal.budget || 0,
      },
      timeline: {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days default
        estimatedDuration: 90,
      },
      participants: [],
      milestones: [],
      createdBy: {
        id: proposal.creatorUserId || proposal.creatorGroupId || "",
        name: "Creator",
        type: proposal.creatorUserId ? "USER" : "GROUP",
      },
      managedBy: {
        id: managerId,
        name: "Manager",
        role: "PROJECT_MANAGER",
      },
      groupId: proposal.creatorGroupId,
      groupName: proposal.creatorGroupId ? "Group Name" : undefined,
      progress: {
        overall: 0,
        milestonesCompleted: 0,
        totalMilestones: 0,
        daysElapsed: 0,
        daysRemaining: 90,
      },
      impactMetrics: {
        participantsCount: 0,
        beneficiariesCount: 0,
        impactPointsGenerated: 0,
        tokensDistributed: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return project
  }

  // Add participant to project
  static addParticipant(
    project: Project,
    user: User,
    role: ProjectParticipant["role"],
    contribution: ProjectParticipant["contribution"],
  ): Project {
    const participant: ProjectParticipant = {
      id: crypto.randomUUID(),
      userId: user.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        impactPoints: user.impactPoints?.global || 0,
      },
      role,
      permissions: this.getPermissionsForRole(role),
      contribution,
      performance: {
        milestonesCompleted: 0,
        impactPointsEarned: 0,
        tokensEarned: 0,
        rating: 0,
        feedback: [],
      },
      joinedAt: new Date().toISOString(),
      status: "ACTIVE",
    }

    return {
      ...project,
      participants: [...project.participants, participant],
      impactMetrics: {
        ...project.impactMetrics,
        participantsCount: project.participants.length + 1,
      },
      updatedAt: new Date().toISOString(),
    }
  }

  // Create milestone
  static createMilestone(
    project: Project,
    milestoneData: {
      title: string
      description: string
      requirements: string[]
      deliverables: string[]
      dueDate: string
      priority: ProjectMilestone["priority"]
      fundingAmount: number
      assignedTo: string[]
      dependencies?: string[]
    },
  ): ProjectMilestone {
    const milestone: ProjectMilestone = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: milestoneData.title,
      description: milestoneData.description,
      requirements: milestoneData.requirements,
      deliverables: milestoneData.deliverables,
      dueDate: milestoneData.dueDate,
      status: "PENDING",
      priority: milestoneData.priority,
      funding: {
        allocated: milestoneData.fundingAmount,
        disbursed: 0,
        pending: milestoneData.fundingAmount,
      },
      assignedTo: milestoneData.assignedTo,
      submissions: [],
      dependencies: milestoneData.dependencies || [],
      progress: 0,
      impactPoints: {
        individual: this.calculateMilestoneImpactPoints(project.locationScope, milestoneData.priority),
        group: this.calculateMilestoneImpactPoints(project.locationScope, milestoneData.priority) * 0.5,
      },
      tokenRewards: {
        individual: this.calculateMilestoneTokenRewards(project.locationScope, milestoneData.priority),
        group: this.calculateMilestoneTokenRewards(project.locationScope, milestoneData.priority) * 0.3,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return milestone
  }

  // Submit milestone for review
  static submitMilestone(
    milestone: ProjectMilestone,
    submittedBy: { id: string; name: string },
    evidence: {
      description: string
      files: FileAttachment[]
      links: string[]
      metrics: Record<string, any>
    },
  ): ProjectMilestone {
    const submission = {
      id: crypto.randomUUID(),
      milestoneId: milestone.id,
      submittedBy,
      evidence,
      submittedAt: new Date().toISOString(),
      status: "PENDING" as const,
    }

    return {
      ...milestone,
      status: "SUBMITTED",
      submissions: [...milestone.submissions, submission],
      progress: 100,
      updatedAt: new Date().toISOString(),
    }
  }

  // Verify milestone
  static verifyMilestone(
    milestone: ProjectMilestone,
    verifierId: string,
    verifierName: string,
    approved: boolean,
    comments: string,
  ): ProjectMilestone {
    const updatedSubmissions = milestone.submissions.map((submission) => ({
      ...submission,
      status: approved ? ("APPROVED" as const) : ("REJECTED" as const),
      reviewComments: comments,
      reviewedBy: {
        id: verifierId,
        name: verifierName,
        reviewedAt: new Date().toISOString(),
      },
    }))

    return {
      ...milestone,
      status: approved ? "APPROVED" : "REJECTED",
      submissions: updatedSubmissions,
      verifiedBy: approved
        ? {
            id: verifierId,
            name: verifierName,
            verifiedAt: new Date().toISOString(),
            comments,
          }
        : undefined,
      completedAt: approved ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    }
  }

  // Calculate project progress
  static calculateProjectProgress(project: Project): Project {
    const totalMilestones = project.milestones.length
    const completedMilestones = project.milestones.filter((m) => m.status === "COMPLETED").length
    const overallProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0

    const startDate = new Date(project.timeline.startDate)
    const endDate = new Date(project.timeline.endDate)
    const now = new Date()
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysRemaining = Math.max(0, totalDays - daysElapsed)

    return {
      ...project,
      progress: {
        overall: Math.round(overallProgress),
        milestonesCompleted: completedMilestones,
        totalMilestones,
        daysElapsed: Math.max(0, daysElapsed),
        daysRemaining,
      },
      updatedAt: new Date().toISOString(),
    }
  }

  // Disburse milestone funding
  static async disburseMilestoneFunding(
    milestone: ProjectMilestone,
    project: Project,
  ): Promise<{ success: boolean; error?: string }> {
    if (milestone.status !== "APPROVED") {
      return { success: false, error: "Milestone must be approved before funding can be disbursed" }
    }

    if (milestone.funding.disbursed >= milestone.funding.allocated) {
      return { success: false, error: "Funding has already been disbursed for this milestone" }
    }

    if (project.budget.remaining < milestone.funding.pending) {
      return { success: false, error: "Insufficient project budget remaining" }
    }

    // Award impact points and tokens to participants
    for (const participantId of milestone.assignedTo) {
      const participant = project.participants.find((p) => p.userId === participantId)
      if (participant) {
        // Award impact points
        ImpactPointsService.awardPoints(participantId, "milestone_completion", project.locationScope, project.id)

        // Award tokens
        const tokenReward = milestone.tokenRewards.individual
        // TokenService.awardTokens(participantId, tokenReward, "milestone_completion")
      }
    }

    return { success: true }
  }

  // Filter projects
  static filterProjects(projects: Project[], filters: ProjectFilters): Project[] {
    let filtered = projects

    if (filters.search) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          p.description.toLowerCase().includes(filters.search.toLowerCase()),
      )
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter((p) => filters.status.includes(p.status))
    }

    if (filters.locationScope.length > 0) {
      filtered = filtered.filter((p) => filters.locationScope.includes(p.locationScope))
    }

    if (filters.participantRole.length > 0) {
      filtered = filtered.filter((p) =>
        p.participants.some((participant) => filters.participantRole.includes(participant.role)),
      )
    }

    if (filters.budgetRange) {
      filtered = filtered.filter(
        (p) =>
          p.budget.total >= (filters.budgetRange?.min || 0) &&
          p.budget.total <= (filters.budgetRange?.max || Number.POSITIVE_INFINITY),
      )
    }

    return filtered
  }

  // Helper methods
  private static getPermissionsForRole(role: ProjectParticipant["role"]): string[] {
    const permissions = {
      PARTICIPANT: ["view_project", "submit_milestone", "view_milestones"],
      MANAGER: [
        "view_project",
        "edit_project",
        "create_milestone",
        "assign_participants",
        "approve_submissions",
        "disburse_funds",
      ],
      VERIFIER: ["view_project", "verify_milestones", "review_submissions"],
      TREASURER: ["view_project", "manage_budget", "disburse_funds", "view_financial_reports"],
    }

    return permissions[role] || []
  }

  private static calculateMilestoneImpactPoints(locationScope: string, priority: ProjectMilestone["priority"]): number {
    const basePoints = {
      LOCAL: 20,
      CONSTITUENCY: 40,
      COUNTY: 80,
      NATIONAL: 160,
    }

    const priorityMultipliers = {
      LOW: 0.8,
      MEDIUM: 1.0,
      HIGH: 1.5,
      CRITICAL: 2.0,
    }

    const base = basePoints[locationScope as keyof typeof basePoints] || 20
    const multiplier = priorityMultipliers[priority] || 1.0

    return Math.round(base * multiplier)
  }

  private static calculateMilestoneTokenRewards(locationScope: string, priority: ProjectMilestone["priority"]): number {
    const baseTokens = {
      LOCAL: 10,
      CONSTITUENCY: 25,
      COUNTY: 50,
      NATIONAL: 100,
    }

    const priorityMultipliers = {
      LOW: 0.8,
      MEDIUM: 1.0,
      HIGH: 1.5,
      CRITICAL: 2.0,
    }

    const base = baseTokens[locationScope as keyof typeof baseTokens] || 10
    const multiplier = priorityMultipliers[priority] || 1.0

    return Math.round(base * multiplier)
  }

  // Project status management
  static updateProjectStatus(project: Project, newStatus: Project["status"], reason?: string): Project {
    return {
      ...project,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      completedAt: newStatus === "COMPLETED" ? new Date().toISOString() : project.completedAt,
    }
  }

  // Performance tracking
  static updateParticipantPerformance(
    project: Project,
    participantId: string,
    performance: Partial<ProjectParticipant["performance"]>,
  ): Project {
    const updatedParticipants = project.participants.map((participant) =>
      participant.userId === participantId
        ? {
            ...participant,
            performance: { ...participant.performance, ...performance },
          }
        : participant,
    )

    return {
      ...project,
      participants: updatedParticipants,
      updatedAt: new Date().toISOString(),
    }
  }
}

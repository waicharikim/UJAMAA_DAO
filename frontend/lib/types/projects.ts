export interface Project {
  id: string
  proposalId: string
  title: string
  description: string
  locationScope: "LOCAL" | "CONSTITUENCY" | "COUNTY" | "NATIONAL"
  constituency?: string
  county?: string
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ON_HOLD" | "CANCELLED"
  budget: {
    total: number
    allocated: number
    disbursed: number
    remaining: number
  }
  timeline: {
    startDate: string
    endDate: string
    estimatedDuration: number // in days
  }
  participants: ProjectParticipant[]
  milestones: ProjectMilestone[]
  createdBy: {
    id: string
    name: string
    type: "USER" | "GROUP"
  }
  managedBy: {
    id: string
    name: string
    role: "PROJECT_MANAGER" | "GROUP_ADMIN"
  }
  groupId?: string
  groupName?: string
  progress: {
    overall: number // 0-100
    milestonesCompleted: number
    totalMilestones: number
    daysElapsed: number
    daysRemaining: number
  }
  impactMetrics: {
    participantsCount: number
    beneficiariesCount: number
    impactPointsGenerated: number
    tokensDistributed: number
  }
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ProjectParticipant {
  id: string
  userId: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string
    impactPoints: number
  }
  role: "PARTICIPANT" | "MANAGER" | "VERIFIER" | "TREASURER"
  permissions: string[]
  contribution: {
    description: string
    hoursCommitted: number
    skillsOffered: string[]
    availability: "FULL_TIME" | "PART_TIME" | "VOLUNTEER"
  }
  performance: {
    milestonesCompleted: number
    impactPointsEarned: number
    tokensEarned: number
    rating: number // 1-5
    feedback: string[]
  }
  joinedAt: string
  status: "ACTIVE" | "INACTIVE" | "COMPLETED"
}

export interface ProjectMilestone {
  id: string
  projectId: string
  title: string
  description: string
  requirements: string[]
  deliverables: string[]
  dueDate: string
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  funding: {
    allocated: number
    disbursed: number
    pending: number
  }
  assignedTo: string[] // participant IDs
  verifiedBy?: {
    id: string
    name: string
    verifiedAt: string
    comments: string
  }
  submissions: MilestoneSubmission[]
  dependencies: string[] // other milestone IDs
  progress: number // 0-100
  impactPoints: {
    individual: number
    group: number
  }
  tokenRewards: {
    individual: number
    group: number
  }
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface MilestoneSubmission {
  id: string
  milestoneId: string
  submittedBy: {
    id: string
    name: string
  }
  evidence: {
    description: string
    files: FileAttachment[]
    links: string[]
    metrics: Record<string, any>
  }
  submittedAt: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVISION"
  reviewComments?: string
  reviewedBy?: {
    id: string
    name: string
    reviewedAt: string
  }
}

export interface FileAttachment {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedAt: string
}

export interface ProjectFilters {
  search: string
  status: string[]
  locationScope: string[]
  participantRole: string[]
  dateRange?: {
    start: string
    end: string
  }
  budgetRange?: {
    min: number
    max: number
  }
}

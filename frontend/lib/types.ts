// Enhanced types reflecting the comprehensive governance system
export interface User {
  id: string
  walletAddress: string
  username?: string
  email?: string
  phone?: string
  avatar?: string
  bio?: string  // NOTE: not in backend schema — always undefined from server

  // Verification — from backend verificationLevel field
  verificationLevel?: "UNVERIFIED" | "EMAIL_VERIFIED" | "PHONE_VERIFIED" | "COMMUNITY_VERIFIED" | "FULL_VERIFIED"

  // Dual location system (populated from geographic hierarchy in getMe response)
  primaryWardId?: string
  primaryWardName?: string
  primaryConstituencyId?: string
  primaryConstituencyName?: string
  primaryCountyId?: string
  primaryCountyName?: string
  secondaryWardId?: string
  secondaryWardName?: string
  residenceCounty: string
  residenceConstituency: string
  originCounty: string  // not in backend — always empty
  originConstituency: string  // not in backend — always empty

  // Professional information
  industry: string
  goodsServices: string[]

  // Governance metrics
  impactPoints: {
    global: number
    byLocation: Record<string, number>
  }
  tokenBalance: number
  utBalance: number

  // Privacy and preferences
  privacySettings: PrivacySettings
  notificationPreferences: NotificationPreferences

  // Participation tracking
  projectParticipation: {
    constituency: number
    county: number
    national: number
  }

  roles: Role[]
  createdAt: string
  updatedAt: string
}

export interface Group {
  id: string
  name: string
  description: string
  type: "community" | "company" | "county"
  avatar?: string

  // Geographic registration
  constituency: string
  county: string

  // Membership and governance
  memberCount: number
  members: GroupMember[]
  adminId: string

  // Financial
  fiatBalance: number
  tokenBalance: number

  // Governance metrics
  impactPoints: number // Aggregate of members

  // Legal and backing (for companies)
  legalDocuments?: string[]
  backingGroupId?: string // For companies requiring community backing

  isPrivate: boolean
  createdAt: string
  updatedAt: string
}

export interface GroupMember {
  id: string
  userId: string
  user: User
  groupId: string
  role: "member" | "admin" | "treasurer" | "project_manager"
  joinedAt: string
  isActive: boolean
}

export interface Proposal {
  id: string
  title: string
  description: string

  // Classification
  purpose: "business" | "nonprofit" | "social_cause" | "bill"
  locationScope: "local" | "constituency" | "county" | "national"
  isPrivate: boolean

  // Creator information
  createdBy: {
    id: string
    type: "individual" | "group"
    name: string
  }

  // Group association
  groupId?: string
  groupName?: string

  // Funding
  isFunded: boolean
  requestedAmount?: number
  tokenCost: number

  // Governance
  status: "draft" | "active" | "passed" | "rejected" | "expired"
  votingDeadline: string

  // Voting statistics
  votingStats: {
    individualVotes: {
      yes: number
      no: number
      abstain: number
    }
    groupVotes: {
      yes: number
      no: number
      abstain: number
      totalWeight: number
    }
    quorumRequired: number
    consensusRequired: number
    currentQuorum: number
    currentConsensus: number
  }

  // User interaction
  userVote?: "yes" | "no" | "abstain"
  userVoteType?: "individual" | "group"
  canVote: boolean
  canEdit: boolean

  createdAt: string
  updatedAt: string
}

export interface Vote {
  id: string
  proposalId: string
  voterId: string
  voterType: "individual" | "group"
  vote: "yes" | "no" | "abstain"
  weight: number
  tokensCost: number
  timestamp: string
}

export interface Project {
  id: string
  proposalId: string
  title: string
  description: string

  // Geographic and classification
  locationScope: "local" | "constituency" | "county" | "national"
  purpose: string

  // Management
  managerId: string
  participants: ProjectParticipant[]

  // Financial
  totalBudget: number
  disbursedAmount: number
  remainingBudget: number

  // Progress tracking
  milestones: ProjectMilestone[]
  status: "planning" | "active" | "completed" | "cancelled" | "on_hold"
  progress: number // 0-100

  // Governance
  groupId?: string

  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ProjectMilestone {
  id: string
  projectId: string
  title: string
  description: string

  // Scheduling
  dueDate: string

  // Status and validation
  status: "pending" | "under_review" | "approved" | "rejected"
  submittedAt?: string
  reviewedAt?: string
  reviewerId?: string
  reviewComments?: string

  // Financial
  fundingAmount: number
  isDisbursed: boolean

  // Evidence and deliverables
  deliverables: string[]
  evidenceUrls: string[]

  createdAt: string
  updatedAt: string
}

export interface ProjectParticipant {
  id: string
  projectId: string
  userId: string
  user: User
  role: "participant" | "manager" | "verifier"
  contribution: string
  impactPointsEarned: number
  joinedAt: string
}

export interface CountyGroup {
  id: string
  county: string

  // Dynamic membership based on impact points
  members: CountyGroupMember[]
  adminId: string // Top 1% impact holder

  // Governance metrics
  totalImpactPoints: number
  membershipThreshold: number

  // Administrative
  lastMembershipUpdate: string
  nextElection: string

  createdAt: string
  updatedAt: string
}

export interface CountyGroupMember {
  id: string
  userId: string
  user: User
  countyGroupId: string
  impactPointsAtJoin: number
  isEligibleForAdmin: boolean
  joinedAt: string
  lastActive: string
}

export interface Delegation {
  id: string
  delegatorId: string
  delegateeId: string
  level: "constituency" | "county" | "national" | "all"
  isActive: boolean
  createdAt: string
  revokedAt?: string
}

export interface ImpactPointTransaction {
  id: string
  userId?: string
  groupId?: string
  points: number
  type: "earned" | "spent" | "penalty"
  source: "project" | "voting" | "system" | "milestone" | "community"
  locationScope?: "constituency" | "county" | "national" | "global"
  description: string
  relatedEntityId?: string // Project, proposal, etc.
  timestamp: string
}

export interface TokenTransaction {
  id: string
  userId?: string
  groupId?: string
  amount: number
  type: "earned" | "spent" | "transfer" | "mint" | "burn"
  source: "voting" | "funding" | "reward" | "transfer" | "system"
  description: string
  relatedEntityId?: string
  fromAddress?: string
  toAddress?: string
  transactionHash?: string
  timestamp: string
}

export interface FinancialAccount {
  id: string
  ownerId: string
  ownerType: "user" | "group"

  // Balances
  fiatBalance: number
  tokenBalance: number
  lockedFunds: number

  // Transaction history
  transactions: FinancialTransaction[]

  // Governance
  spendingRequiresVote: boolean
  lastAudit: string

  createdAt: string
  updatedAt: string
}

export interface FinancialTransaction {
  id: string
  accountId: string
  amount: number
  type: "deposit" | "withdrawal" | "transfer" | "project_funding" | "milestone_disbursement"
  currency: "fiat" | "token"
  description: string

  // Governance approval
  approvedByVote?: string // Vote ID if required
  approvedAt?: string

  // External references
  externalTransactionId?: string
  relatedEntityId?: string

  timestamp: string
}

export interface NotificationPreferences {
  email: boolean
  sms: boolean
  inApp: boolean
  push: boolean

  // Event types
  votingReminders: boolean
  proposalUpdates: boolean
  projectMilestones: boolean
  groupInvitations: boolean
  roleChanges: boolean
  adminElections: boolean
  fundingUpdates: boolean
  systemAnnouncements: boolean

  // Frequency settings
  digestFrequency: "immediate" | "daily" | "weekly"
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
}

export interface Notification {
  id: string
  userId: string
  type: "info" | "success" | "warning" | "error" | "urgent"
  category: "governance" | "project" | "financial" | "system" | "social"
  title: string
  message: string

  // Delivery
  channels: ("email" | "sms" | "inApp" | "push")[]
  deliveryStatus: Record<string, "pending" | "sent" | "delivered" | "failed">

  // Interaction
  read: boolean
  actionUrl?: string
  actionLabel?: string

  // Context
  relatedEntityId?: string
  relatedEntityType?: string

  createdAt: string
  readAt?: string
  expiresAt?: string
}

export interface AuditLog {
  id: string
  userId?: string
  action: string
  entityType: string
  entityId: string
  changes: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: string

  // Context
  sessionId?: string
  requestId?: string

  // Governance specific
  voteId?: string
  proposalId?: string
  projectId?: string
}

export interface Role {
  id: string
  name: string
  description: string
  level: "system" | "group" | "county" | "project"
  scopes: string[]

  // Constraints
  maxHolders?: number
  requiresElection: boolean
  termLength?: number // in days

  createdAt: string
  updatedAt: string
}

export interface UserRole {
  id: string
  userId: string
  roleId: string
  role: Role

  // Context
  contextType?: "group" | "county" | "project"
  contextId?: string

  // Governance
  assignedBy?: string
  assignedAt: string
  expiresAt?: string
  isActive: boolean

  // Election context
  electionId?: string
  voteCount?: number
}

// Enhanced auth state
export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // Enhanced context
  activeRoles: UserRole[]
  permissions: string[]
  currentLocation?: {
    county: string
    constituency: string
  }
}

// Governance eligibility and thresholds
export interface GovernanceThresholds {
  voting: {
    constituency: { minProjects: number }
    county: { minProjects: number }
    national: { minProjects: number }
  }
  proposalCreation: {
    constituency: { percentileRequired: number } // top 5%
    county: { percentileRequired: number } // top 15%
    national: { percentileRequired: number } // top 25%
  }
  tokenCosts: {
    voting: {
      base: number
      byLevel: Record<string, number>
    }
    proposalCreation: {
      base: number
      byLevel: Record<string, number>
    }
  }
}

// Enhanced privacy settings
export interface PrivacySettings {
  profileVisibility: "public" | "constituency" | "county" | "private"
  emailVisibility: "public" | "constituency" | "county" | "private"
  phoneVisibility: "public" | "constituency" | "county" | "private"
  walletVisibility: "public" | "constituency" | "county" | "private"
  locationVisibility: "public" | "constituency" | "county" | "private"
  participationVisibility: "public" | "constituency" | "county" | "private"

  // Governance privacy
  voteHistory: "public" | "anonymous" | "private"
  proposalHistory: "public" | "constituency" | "county" | "private"
  projectParticipation: "public" | "constituency" | "county" | "private"
}

// Filter and search interfaces
export interface ProposalFilters {
  search: string
  locationScope: string[]
  purpose: string[]
  status: string[]
  isPrivate?: boolean
  createdBy?: string
  dateRange?: {
    start: string
    end: string
  }
  fundingRange?: {
    min: number
    max: number
  }
}

export interface ProjectFilters {
  search: string
  status: string[]
  locationScope: string[]
  purpose: string[]
  participantId?: string
  managerId?: string
  dateRange?: {
    start: string
    end: string
  }
  budgetRange?: {
    min: number
    max: number
  }
}

export interface GroupFilters {
  search: string
  type: string[]
  county: string[]
  constituency: string[]
  membershipStatus?: "member" | "admin" | "invited" | "none"
  impactPointsRange?: {
    min: number
    max: number
  }
}

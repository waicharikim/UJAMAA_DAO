export interface User {
  id: string
  walletAddress: string
  email: string
  name: string
  phoneNumber?: string
  constituencyOrigin: string
  countyOrigin: string
  constituencyLive: string
  countyLive: string
  industryId?: string
  avatarUrl?: string
  emailVerified: boolean
  impactPoints: {
    global: number
    byLocation: Record<string, number>
  }
  tokenBalance: number
  participationHistory: {
    constituency: number
    county: number
    national: number
  }
  roles: UserRole[]
  privacySettings: PrivacySettings
  notificationPreferences: NotificationPreference[]
}

export interface Group {
  id: string
  name: string
  description?: string
  walletAddress: string
  constituency: string
  county: string
  groupType: "COMMUNITY" | "COMPANY" | "COUNTY"
  status: "PENDING" | "ACTIVE" | "REJECTED"
  members: GroupMember[]
  impactPoints: number
  tokenBalance: number
  financialAccount: {
    fiatBalance: number
    pendingTransactions: Transaction[]
  }
}

export interface ProposalParticipant {
  id: string
  userId: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string
    impactPoints: number
    roles: string[]
  }
  role: "CREATOR" | "CO_SPONSOR" | "EXPERT" | "IMPLEMENTER" | "VERIFIER" | "BENEFICIARY" | "VOTER"
  joinedAt: string
  contribution?: {
    type: "EXPERTISE" | "FUNDING" | "IMPLEMENTATION" | "VERIFICATION" | "ENDORSEMENT"
    description: string
    commitment?: string
  }
  status: "ACTIVE" | "PENDING" | "DECLINED"
  permissions: string[]
}

export interface Proposal {
  id: string
  title: string
  description: string
  proposalType: "BUSINESS" | "NON_PROFIT" | "BILL"
  funded: boolean
  budget?: number
  locationScope: "LOCAL" | "CONSTITUENCY" | "COUNTY" | "NATIONAL"
  isPrivate: boolean
  status: "DRAFT" | "VOTING" | "APPROVED" | "REJECTED" | "EXECUTING" | "COMPLETED"
  creatorUserId?: string
  creatorGroupId?: string
  participants: ProposalParticipant[]
  votes: {
    individual: Vote[]
    group: GroupVote[]
    quorum: {
      required: number
      achieved: number
    }
    consensus: {
      required: number
      achieved: number
    }
  }
  eligibility: {
    canVote: boolean
    canPropose: boolean
    reason?: string
  }
  implementation?: {
    timeline: string
    budget: number
    team: string[]
    milestones: string[]
  }
  createdAt: string
  updatedAt: string
}

export interface Vote {
  id: string
  proposalId: string
  voterId: string
  vote: boolean
  tokensSpent: number
  timestamp: Date
}

export interface GroupVote {
  id: string
  proposalId: string
  groupId: string
  vote: boolean
  memberVotes: {
    userId: string
    vote: boolean
  }[]
  quorumMet: boolean
  consensusAchieved: boolean
}

export interface Project {
  id: string
  proposalId: string
  title: string
  description: string
  budget?: number
  status: "ACTIVE" | "COMPLETED" | "ON_HOLD" | "CANCELLED"
  locationScope: string
  milestones: Milestone[]
  participants: ProjectParticipant[]
}

export interface Milestone {
  id: string
  projectId: string
  title: string
  description: string
  dueDate?: Date
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"
  fundingAmount: number
}

export interface UserRole {
  role: string
  scope?: string
}

export interface PrivacySettings {
  email: "public" | "group" | "private"
  phoneNumber: "public" | "group" | "private"
  walletAddress: "public" | "group" | "private"
  countyLive: "public" | "group" | "private"
  constituencyLive: "public" | "group" | "private"
  countyOrigin: "public" | "group" | "private"
  constituencyOrigin: "public" | "group" | "private"
}

export interface NotificationPreference {
  channel: "email" | "sms" | "in-app" | "push"
  eventType: string
  enabled: boolean
}

export interface GroupMember {
  id: string
  userId: string
  groupId: string
  role: "MEMBER" | "ADMIN" | "TREASURER" | "AUDITOR"
  joinedAt: Date
  active: boolean
}

export interface ProjectParticipant {
  id: string
  projectId: string
  userId: string
  role: "MEMBER" | "ADMIN" | "MILESTONE_VERIFIER"
  joinedAt: Date
}

export interface Transaction {
  id: string
  amount: number
  type: "DEPOSIT" | "WITHDRAWAL" | "SPEND" | "REWARD"
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED"
  description: string
  timestamp: Date
}

export interface County {
  id: string
  name: string
  code: string
  constituencies: Constituency[]
}

export interface Constituency {
  id: string
  name: string
  countyId: string
}

export interface Industry {
  id: string
  name: string
}

export interface GoodsService {
  id: string
  name: string
}

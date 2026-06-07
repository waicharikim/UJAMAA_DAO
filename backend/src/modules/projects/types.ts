/**
 * @file src/modules/projects/types.ts
 * @description
 * Projects & Milestones Types — aligned to Prisma schema
 */

// ── Enums (must match prisma/schema.prisma exactly) ──────────────────────────

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_VERIFICATION = 'AWAITING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

// Who may participate (join/claim/contribute) in a project. MEMBERS_ONLY = owning
// group members only; WARD/CONSTITUENCY/COUNTY open it to anyone resident within
// the owning group's geography at that tier (voluntary-group projects).
export enum ProjectParticipation {
  MEMBERS_ONLY = 'MEMBERS_ONLY',
  WARD = 'WARD',
  CONSTITUENCY = 'CONSTITUENCY',
  COUNTY = 'COUNTY',
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

export interface CreateProjectFromProposalDto {
  proposalId: string;
}

export interface StartMilestoneDto {
  milestoneId: string;
}

export interface SubmitMilestoneDto {
  milestoneId: string;
  proofUrl: string;
  description: string;
}

export interface VerifyMilestoneDto {
  milestoneId: string;
  approved: boolean;
  feedback?: string;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export interface MilestoneResponseDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  dueDate: string | null;
  orderIndex: number;
  proposalMilestoneId: string | null;
  submittedById: string | null;
  tasks: TaskDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberResponseDto {
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
}

export interface ProjectDto {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  ownerGroupId: string | null;
  ownerUserId: string | null;
  proposalId: string | null;
  participationScope: ProjectParticipation;
  milestonesCount: number;
  completedMilestonesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailDto extends ProjectDto {
  milestones: MilestoneResponseDto[];
  members: ProjectMemberResponseDto[];
  ownerGroup: { id: string; name: string; isSystemGroup: boolean } | null;
  ownerUser: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  proposal: { id: string; title: string; status: string } | null;
}

export interface ListProjectsDto {
  projects: ProjectDto[];
  total: number;
  limit: number;
  offset: number;
}

// ── Work Logging DTOs ─────────────────────────────────────────────────────────

export type WorkType = 'MANUAL_LABOR' | 'SKILLED_WORK' | 'SUPERVISION';
export type WorkLogStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LogWorkDto {
  milestoneId: string;
  workType: WorkType;
  description: string;
  hours: number;
  photoUrls?: string[];
  witnessIds?: string[];
}

export interface VerifyWorkDto {
  workLogId: string;
  approved: boolean;
  feedback?: string;
}

export interface WorkLogResponseDto {
  id: string;
  milestoneId: string;
  projectId: string;
  userId: string;
  worker: { id: string; name: string | null; avatarUrl: string | null };
  workType: WorkType;
  description: string;
  hours: number;
  photoUrls: string[];
  status: WorkLogStatus;
  totalIPEarned: number;
  verifiedAt: string | null;
  createdAt: string;
}

export interface WorkLogListDto {
  workLogs: WorkLogResponseDto[];
  total: number;
}

// ── Contribution DTOs ─────────────────────────────────────────────────────────

export interface ContributeToProjectDto {
  amount: number; // UT amount (1 UT = 1 KES)
}

export interface ContributionResponseDto {
  projectId: string;
  amount: number;
  newBalance: number;
  transactionId: string;
}

// ── Task DTOs ─────────────────────────────────────────────────────────────────

export const SKILL_CATEGORIES = [
  'GENERAL',
  'CONSTRUCTION',
  'MASONRY',
  'ELECTRICAL',
  'PLUMBING',
  'CARPENTRY',
  'PAINTING',
  'FARMING',
  'TRANSPORT',
  'ADMINISTRATION',
  'TECHNOLOGY',
  'HEALTH',
  'EDUCATION',
  'FINANCE',
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export interface CreateTaskDto {
  milestoneId: string;
  title: string;
  description?: string;
  skillCategory?: SkillCategory;
  maxAssignees?: number;
  dueDate?: string;
}

export interface TaskDto {
  id: string;
  projectId: string | null;
  milestoneId: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  skillCategory: string | null;
  maxAssignees: number;
  dueDate: string | null;
  assignedTo: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListDto {
  tasks: TaskDto[];
  total: number;
}

export interface MemberContributionDto {
  userId: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
  role: string;
  tasksCompleted: number;
  tasksInProgress: number;
  hoursLogged: number;
  sessionsAttended: number;
  impactPointsEarned: number;
}

export interface ClaimTaskResponseDto {
  taskId: string;
  projectId: string;
  milestoneId: string;
  status: string;
}

export interface CompleteTaskResponseDto {
  taskId: string;
  status: 'DONE';
  ipAwarded: number;
}

// ── Work Session (QR presence chain) DTOs ─────────────────────────────────────

export type WorkSessionStatus = 'OPEN' | 'APPROVED' | 'FLAGGED';

export interface CreateWorkSessionDto {
  milestoneId: string;
  durationMinutes: number; // 30–480
}

export interface WorkSessionDto {
  id: string;
  milestoneId: string;
  projectId: string;
  qrSecret: string;
  expiresAt: string;
  status: WorkSessionStatus;
  closedAt: string | null;
  presenceCount: number;
  createdAt: string;
}

export interface WorkPresenceDto {
  id: string;
  sessionId: string;
  userId: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
  attestedById: string | null;
  depth: number;
  ipAwarded: number;
  awardedAt: string | null;
  createdAt: string;
}

export interface AttestPresenceDto {
  sessionId: string;
  targetUserId: string;
}

export interface ScanQrResponseDto {
  sessionId: string;
  depth: number;
  expiresAt: string;
  attestationsRemaining: number;
}

export interface AttestResponseDto {
  presenceId: string;
  targetUserId: string;
  depth: number;
  attestationsRemaining: number;
}

// ── Job names ─────────────────────────────────────────────────────────────────

export const ProjectJobName = {
  WORK_SESSION_CLOSE: 'WORK_SESSION_CLOSE',
} as const;

export interface WorkSessionCloseJobData {
  sessionId: string;
}

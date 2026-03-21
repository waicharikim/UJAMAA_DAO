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
  milestonesCount: number;
  completedMilestonesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailDto extends ProjectDto {
  milestones: MilestoneResponseDto[];
  members: ProjectMemberResponseDto[];
  ownerGroup: { id: string; name: string } | null;
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

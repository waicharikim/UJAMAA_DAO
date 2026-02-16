/**
 * @file src/modules/projects/types.ts
 * @description
 * Projects & Milestones Types
 * Version: 2.0 — December 2025
 */

export enum ProjectStatus {
  PLANNING = "PLANNING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum MilestoneStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

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
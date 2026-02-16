/**
 * @file src/modules/governance/types.ts
 * @description
 * Governance Module Types
 * Version: 2.0 — December 2025
 */

export enum ProposalStatus {
  DRAFT = "DRAFT",
  VOTING = "VOTING",
  PASSED = "PASSED",
  FAILED = "FAILED",
  EXECUTING = "EXECUTING",
  COMPLETED = "COMPLETED",
}

export enum VoteOption {
  YES = "YES",
  NO = "NO",
  ABSTAIN = "ABSTAIN",
}

export interface CreateProposalDto {
  groupId: string;
  title: string;
  description: string;
  fundingAmountKes?: number;
  isEmergency?: boolean;
}

export interface CastVoteDto {
  proposalId: string;
  option: VoteOption;
}

export interface StartVotingDto {
  proposalId: string;
}

export const PR_COST_BY_SCOPE = {
  WARD: 50,
  CONSTITUENCY: 100,
  COUNTY: 150,
  NATIONAL: 200,
  VOLUNTARY: 50,
} as const;

export const IP_PERCENTILE_THRESHOLD = {
  WARD: 0.90,
  CONSTITUENCY: 0.80,
  COUNTY: 0.70,
  NATIONAL: 0.60,
  VOLUNTARY: 1.00, // all members
} as const;
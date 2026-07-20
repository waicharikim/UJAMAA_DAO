/**
 * @file src/modules/governance/types.ts
 * @description
 * Governance Module Types
 * Version: 2.0 — December 2025
 */

// ProposalStatus is the Prisma-generated enum — import from @prisma/client, not here.

export enum VoteOption {
  YES = 'YES',
  NO = 'NO',
  ABSTAIN = 'ABSTAIN',
}

/**
 * Where the money for a proposal primarily comes from. Aligned with the
 * platform's money-flow rules (Rule 2: real money via M-Pesa to platform
 * accounts) — LOCATION_REQUEST routes through the location treasury and admin
 * approval; there is no P2P option.
 */
export type ProposalFundingSource =
  | 'GROUP_TREASURY'
  | 'MEMBER_CONTRIBUTIONS'
  | 'EXTERNAL_GRANT'
  | 'LOCATION_REQUEST';

export const PROPOSAL_FUNDING_SOURCES: ProposalFundingSource[] = [
  'GROUP_TREASURY',
  'MEMBER_CONTRIBUTIONS',
  'EXTERNAL_GRANT',
  'LOCATION_REQUEST',
];

export interface CreateProposalDto {
  groupId: string;
  title: string;
  description: string;
  // Structured narrative — captured directly instead of being buried in the
  // description blob, so the Baraza council and voters can read them as fields.
  problem?: string;
  solution?: string;
  fundingSource?: ProposalFundingSource;
  kind?: 'POLICY' | 'PROJECT';
  fundingAmountKes?: number;
  isEmergency?: boolean;
  proposalScope?: 'GROUP' | 'COMMUNITY';
  targetLevel?: 'WARD' | 'CONSTITUENCY' | 'COUNTY';
  groupFundingAmount?: number;
  locationFundingRequest?: number;
}

export interface CastVoteDto {
  proposalId: string;
  option: VoteOption;
}

export interface StartVotingDto {
  proposalId: string;
}

export interface ReviewProposalDto {
  decision: 'APPROVE' | 'REJECT';
  note?: string;
}

export const PR_COST_BY_SCOPE = {
  WARD: 50,
  CONSTITUENCY: 100,
  COUNTY: 150,
  NATIONAL: 200,
  VOLUNTARY: 50,
} as const;

export const IP_PERCENTILE_THRESHOLD = {
  WARD: 0.9,
  CONSTITUENCY: 0.8,
  COUNTY: 0.7,
  NATIONAL: 0.6,
  VOLUNTARY: 1.0, // all members
} as const;

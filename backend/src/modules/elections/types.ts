/**
 * @file src/modules/elections/types.ts
 * @description
 * Elections module constants, DTOs, and configuration.
 * Version: 1.0 — March 2026
 */

// ── Election timing windows ────────────────────────────────────────────────

export const ELECTION_WINDOWS = {
  NOMINATIONS_LEAD_DAYS: 3, // nominations open 3 days after election is created
  NOMINATIONS_DURATION_DAYS: 7, // nomination window is 7 days
  VOTING_DURATION_DAYS: 7, // voting window is 7 days
  RETRY_ON_NO_QUORUM_DAYS: 30, // retry election in 30 days if quorum not reached
  RETRY_ON_NO_CANDIDATES_DAYS: 14, // retry election in 14 days if no candidates
  GROUP_TERM_MONTHS: 12, // group role holders serve 12 months
  SYSTEM_TERM_MONTHS: 24, // system role holders serve 24 months
} as const;

// ── Nomination PR cost (non-refundable, deters spam) ──────────────────────

export const NOMINATION_PR_COST: Record<string, number> = {
  LEADER: 50,
  COUNTY_COORDINATOR: 50,
  TREASURER: 25,
  AUDITOR: 25,
  DEFAULT: 25,
};

// ── Which roles are electable ──────────────────────────────────────────────

/** Group roles that require elections (maps GroupRoleAssignment.ELECTED values) */
export const ELECTABLE_GROUP_ROLES = [
  'LEADER',
  'TREASURER',
  'AUDITOR',
] as const;

/** System roles that require elections (maps SystemRoleAssignment.ELECTED values) */
export const ELECTABLE_SYSTEM_ROLES = ['COUNTY_COORDINATOR'] as const;

// ── Input types ────────────────────────────────────────────────────────────

export interface CreateElectionInput {
  scope: 'GROUP' | 'SYSTEM';
  roleKey: string;
  groupId?: string;
  countyId?: string;
  termMonths?: number;
}

export interface ElectionFilters {
  groupId?: string;
  countyId?: string;
  scope?: 'GROUP' | 'SYSTEM';
  status?: 'PENDING' | 'NOMINATIONS_OPEN' | 'VOTING_OPEN' | 'CLOSED';
  page?: number;
  limit?: number;
}

// ── DTO types (returned to frontend) ──────────────────────────────────────

export interface ElectionCandidateDto {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  statement?: string;
  totalWeight: number;
  voteCount: number;
  withdrawnAt?: string;
}

export interface ElectionSummaryDto {
  id: string;
  roleKey: string;
  scope: 'GROUP' | 'SYSTEM';
  groupId?: string;
  groupName?: string;
  countyId?: string;
  status: 'PENDING' | 'NOMINATIONS_OPEN' | 'VOTING_OPEN' | 'CLOSED';
  nominationsOpenAt: string;
  nominationsCloseAt: string;
  votingOpenAt: string;
  votingCloseAt: string;
  candidateCount: number;
  totalVoteWeight: number;
  quorumReached: boolean;
  winnerId?: string;
  winnerName?: string;
  myVotedCandidateId?: string;
  myNominationId?: string;
}

export interface ElectionDetailDto extends ElectionSummaryDto {
  candidates: ElectionCandidateDto[];
}

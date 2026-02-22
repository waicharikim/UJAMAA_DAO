/**
 * @file src/modules/economy/types.ts
 * @description
 * Participation Rights Types & Constants
 * Version: 2.3 — January 2026
 * Updated: Removed automatic dues penalties (dues optional), added commitment tracking enums/constants
 */

export enum ParticipationRightsReason {
  // Onboarding & Verification
  EMAIL_VERIFIED = "EMAIL_VERIFIED",
  ONBOARDING_COMPLETE = "ONBOARDING_COMPLETE",
  
  // Dues (voluntary, no automatic penalty)
  DUES_ORDINARY = "DUES_ORDINARY",
  DUES_SUPPORTER = "DUES_SUPPORTER",
  DUES_SPONSOR = "DUES_SPONSOR",
  DUES_PENALTY = "DUES_PENALTY",  // Only for explicit opt-in commitment breaches
  
  // Verification & Engagement
  WALLET_CONNECTED = "WALLET_CONNECTED",
  COMMUNITY_VERIFIED = "COMMUNITY_VERIFIED",
  LOCATION_VERIFIED = "LOCATION_VERIFIED",
  PHONE_VERIFIED = "PHONE_VERIFIED",
  WARD_MEETING_ATTENDED = "WARD_MEETING_ATTENDED",
  EDUCATION_MODULE_COMPLETED = "EDUCATION_MODULE_COMPLETED",
  MILESTONE_VERIFIED = "MILESTONE_VERIFIED",
  PROJECT_SUCCESS = "PROJECT_SUCCESS",
  MONTHLY_REGENERATION = "MONTHLY_REGENERATION",
  
  // Emergency
  EMERGENCY_REPORTED = "EMERGENCY_REPORTED",

  // Governance
  VOTED = "VOTED",
  PROPOSAL_CREATED = "PROPOSAL_CREATED",
  PROPOSAL_EXECUTED = "PROPOSAL_EXECUTED",
  GROUP_CREATED = "GROUP_CREATED",
  
  // Administrative & Location
  RESIDENCE_CHANGE = "RESIDENCE_CHANGE",
  RESIDENCE_CHANGE_APPROVED = "RESIDENCE_CHANGE_APPROVED",
  DISPUTE_FILED = "DISPUTE_FILED",
  MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT",
}

export enum DuesTier {
  ORDINARY = "ORDINARY",   // 60 KES → +100 PR + UT
  SUPPORTER = "SUPPORTER", // 200 KES → +200 PR + UT
  SPONSOR = "SPONSOR",     // 1000 KES → +500 PR + UT
}

export const DUES_CONFIG = {
  TIERS: {
    [DuesTier.ORDINARY]: { amountKes: 60, prReward: 100 },
    [DuesTier.SUPPORTER]: { amountKes: 200, prReward: 200 },
    [DuesTier.SPONSOR]: { amountKes: 1000, prReward: 500 },
  },
  GRACE_DAYS: 30,
  // No automatic penalties — dues are fully optional
  // Penalties only apply to explicit opt-in commitments (e.g. role/group agreements)
} as const;

export enum PRTransactionType {
  CREDIT = "CREDIT",
  DEBIT = "DEBIT",
}

export const PR_CONFIG = {
  MAX_BALANCE: 500,
  MONTHLY_REGEN_BASE: 25,
  ACTIVE_USER_DAYS_THRESHOLD: 30,
  LOW_WARNING_THRESHOLD: 20,
  
  // Onboarding rewards (staged)
  EMAIL_VERIFIED: 50,
  ONBOARDING_BONUS: 100,
  
  // Other rewards
  WALLET_CONNECTED: 25,
  PHONE_VERIFIED: 50,
  COMMUNITY_VERIFIED: 50,
  LOCATION_VERIFIED: 75,

  // Milestone rewards
  MILESTONE_VERIFIED_BASE: 100,
  MILESTONE_VERIFIED_MAX: 500,

  // Governance
  VOTE_CAST: 10,
  PROPOSAL_CREATED: 50,
  PROPOSAL_EXECUTED: 200,
} as const;

/**
 * Commitment Types (opt-in only — penalties only on breach)
 */
export enum CommitmentType {
  DUES = "DUES",                      // Voluntary dues agreement (e.g. monthly supporter)
  PROJECT_CONTRIBUTION = "PROJECT_CONTRIBUTION",  // PR or time commitment to project
  GROUP_ROLE = "GROUP_ROLE",          // Role-based (e.g. treasurer pays monthly)
  EVENT_ATTENDANCE = "EVENT_ATTENDANCE",  // Commit to attend meetings
}

export enum CommitmentStatus {
  ACTIVE = "ACTIVE",
  BREACHED = "BREACHED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export const COMMITMENT_CONFIG = {
  MAX_MISSED_BEFORE_BREACH: 2,
  PENALTY_ON_BREACH: [50, 100, "ROLE_SUSPENSION"], // PR reduction steps
  NOTIFICATION_GRACE_DAYS: 7,
  DEFAULT_FREQUENCY: "MONTHLY",
} as const;

/**
 * Utility to get fixed PR reward for a reason
 * Returns 0 if reason not configured
 */
export function getPRRewardForReason(reason: ParticipationRightsReason): number {
  const key = reason as keyof typeof PR_CONFIG;
  return PR_CONFIG[key] || 0;
}
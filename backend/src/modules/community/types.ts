/**
 * @file src/modules/community/types.ts
 * @description
 * Community Module Types — Groups & Membership
 * Version: 2.0 — December 2025
 */

export enum SystemGroupLevel {
  WARD = 'WARD',
  CONSTITUENCY = 'CONSTITUENCY',
  COUNTY = 'COUNTY',
  NATIONAL = 'NATIONAL',
}

export interface CreateVoluntaryGroupDto {
  name: string;
  voluntaryType: string; // BUSINESS_COLLECTIVE, SAVINGS_CREDIT, etc.
  description?: string;
  avatarUrl?: string;
}

export interface JoinGroupDto {
  groupId: string;
}

export const VOLUNTARY_GROUP_PR_COST = 100; // From spec

export const ONBOARDING_PR_BONUS = 50; // PR reward for joining system groups

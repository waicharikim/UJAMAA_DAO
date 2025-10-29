/**
 * @file userSerialization.ts
 *
 * @description
 * UJAMAADAO Enhanced User Serialization
 * * Serialize Prisma User objects into privacy-aware JSON objects with comprehensive
 * UJAMAADAO platform context. Enhanced to include:
 * - Geographic hierarchy context (ward → constituency → county)
 * - Progressive verification status and levels (NOW INCLUDING EMAIL)
 * - Three-tier economic system data (IP, UT, PR)
 * - Voting weight calculations based on impact points
 * - Community governance role assignments
 * - Enhanced privacy controls for community platform
 * * Serialization Rules:
 * - PUBLIC: Basic profile, geographic hierarchy, verification level, economic tiers
 * - GROUP: Extended profile data for community members
 * - PRIVATE: Sensitive personal data (email, phone, wallet address)
 * - OWNER/ADMIN: Full access including verification status and economic details
 */

import type { 
  User, 
  UserPrivacySettings, 
  UserRole,
  Ward,
  Constituency,
  County
} from '@prisma/client';

/**
 * UJAMAADAO Enhanced User Serialization Interface
 * * Comprehensive user representation for the community governance platform
 * including geographic, verification, and economic context.
 */
interface UjamaadaoSerializedUser {
  // Public Fields (Always Visible)
  id: string;
  name: string;
  avatarUrl?: string;
  industryId?: string;
  
  // UJAMAADAO Geographic Identity (Public)
  geographicHierarchy: {
    primaryWard?: {
      id: string;
      name: string;
    };
    constituency?: {
      id: string;
      name: string;
    };
    county?: {
      id: string;
      name: string;
    };
    locationScope: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';
  };
  
  // UJAMAADAO Verification Status (Public)
  verificationLevel: 'UNVERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULL_VERIFIED';
  verificationProgress: {
    stepsCompleted: number;
    totalSteps: number;
    nextStep?: 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION' | 'COMMUNITY_VERIFICATION' | 'LOCATION_VERIFICATION';
  };
  
  // UJAMAADAO Economic System (Public)
  economicSummary: {
    globalImpactPoints: number;
    utilityTokens: number;
    participationRights: number;
    votingWeight: number;
    economicTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
    canParticipateEconomically: boolean;
    canParticipateGovernance: boolean;
  };
  
  // Group-Scoped Fields (Visible to Community Members)
  roles?: string[];
  groups?: Array<{
    id: string;
    name: string;
    role: string;
    groupType: string;
  }>;
  
  // Private Fields (Owner/Admin Only)
  email?: string;
  phoneNumber?: string;
  walletAddress?: string;
  
  // Owner/Admin Only Fields
  verificationDetails?: {
    emailVerified: boolean; // <--- ADDED: Email Verification Status
    phoneVerified: boolean;
    communityVerified: boolean;
    locationVerified: boolean;
    lastVerificationUpdate: Date;
  };
  accountStatus?: {
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * UJAMAADAO Privacy Settings Configuration
 */
export function getUjamaadaoPrivacySettings(): Record<string, 'public' | 'group' | 'private'> {
  return {
    // Basic Profile Information
    name: 'public',
    avatarUrl: 'public',
    industryId: 'public',
    
    // UJAMAADAO Geographic Identity
    geographicHierarchy: 'public',
    primaryWardId: 'public',
    constituencyId: 'public', 
    countyId: 'public',
    
    // UJAMAADAO Verification Status
    verificationLevel: 'public',
    verificationProgress: 'public',
    
    // UJAMAADAO Economic System
    economicSummary: 'public',
    globalImpactPoints: 'public',
    utilityTokens: 'public',
    participationRights: 'public',
    votingWeight: 'public',
    
    // Community Participation
    roles: 'group',
    groups: 'group',
    
    // Personal Information
    email: 'private',
    phoneNumber: 'private', 
    walletAddress: 'private',
    
    // Verification Details
    verificationDetails: 'private',
    accountStatus: 'private',
  };
}

/**
 * Calculate UJAMAADAO Verification Level
 * * CRITICAL UPDATE: Requires emailVerified for any level > UNVERIFIED.
 */
function calculateVerificationLevel(user: User): 'UNVERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULL_VERIFIED' {
  // Fully Verified: All four steps complete
  if (user.locationVerified && user.communityVerified && user.phoneVerified && user.emailVerified) {
    return 'FULL_VERIFIED';
  } 
  // Community Verified: Requires Email + Phone + Community
  else if (user.communityVerified && user.phoneVerified && user.emailVerified) {
    return 'COMMUNITY_VERIFIED';
  } 
  // Phone Verified: Requires Email + Phone
  else if (user.phoneVerified && user.emailVerified) {
    return 'PHONE_VERIFIED';
  } 
  // All other states (including only email verified) are UNVERIFIED
  else {
    return 'UNVERIFIED';
  }
}

/**
 * Calculate UJAMAADAO Verification Progress
 * * CRITICAL UPDATE: Added EMAIL_VERIFICATION as the first tracked step.
 */
function calculateVerificationProgress(user: User): { stepsCompleted: number; totalSteps: number; nextStep?: string } {
  const steps = [
    { key: 'emailVerified', step: 'EMAIL_VERIFICATION' }, // <--- ADDED
    { key: 'phoneVerified', step: 'PHONE_VERIFICATION' },
    { key: 'communityVerified', step: 'COMMUNITY_VERIFICATION' },
    { key: 'locationVerified', step: 'LOCATION_VERIFICATION' }
  ];
  
  const completed = steps.filter(step => user[step.key as keyof User] === true).length;
  const nextStep = steps.find(step => user[step.key as keyof User] === false)?.step;
  
  return {
    stepsCompleted: completed,
    totalSteps: steps.length, // Now 4
    nextStep
  };
}

/**
 * Calculate UJAMAADAO Voting Weight
 */
function calculateVotingWeight(globalImpactPoints: number): number {
  if (globalImpactPoints >= 501) {
    return 2.0; // Tier 3: 2x voting weight
  } else if (globalImpactPoints >= 101) {
    return 1.5; // Tier 2: 1.5x voting weight  
  } else if (globalImpactPoints >= 1) {
    return 1.0; // Tier 1: 1x voting weight
  }
  
  return 1.0; // Default weight
}

/**
 * Determine UJAMAADAO Economic Tier
 */
function determineEconomicTier(globalImpactPoints: number): 'TIER_1' | 'TIER_2' | 'TIER_3' {
  if (globalImpactPoints >= 501) {
    return 'TIER_3';
  } else if (globalImpactPoints >= 101) {
    return 'TIER_2';
  } else {
    return 'TIER_1';
  }
}

/**
 * Build UJAMAADAO Geographic Hierarchy
 */
function buildGeographicHierarchy(user: any): any {
  if (!user.primaryWard) {
    return {
      locationScope: 'NATIONAL' as const
    };
  }

  return {
    primaryWard: user.primaryWard ? {
      id: user.primaryWard.id,
      name: user.primaryWard.name
    } : undefined,
    constituency: user.primaryWard?.constituency ? {
      id: user.primaryWard.constituency.id,
      name: user.primaryWard.constituency.name
    } : undefined,
    county: user.primaryWard?.constituency?.county ? {
      id: user.primaryWard.constituency.county.id,
      name: user.primaryWard.constituency.county.name
    } : undefined,
    locationScope: 'WARD' as const
  };
}

/**
 * Extract UJAMAADAO Roles
 */
function extractUjamaadaoRoles(userRoles: UserRole[]): string[] {
  return userRoles
    .filter(ur => ur.active)
    .map(ur => {
      if (typeof ur.role === 'object' && ur.role.name) {
        return ur.role.name;
      }
      return String(ur.role);
    })
    .sort();
}

/**
 * Extract UJAMAADAO Group Memberships
 */
function extractUjamaadaoGroups(user: any): Array<{id: string; name: string; role: string; groupType: string}> {
  if (!user.groups || !Array.isArray(user.groups)) {
    return [];
  }

  return user.groups.map((groupMember: any) => ({
    id: groupMember.group.id,
    name: groupMember.group.name,
    role: groupMember.role,
    groupType: groupMember.group.groupType
  }));
}

/**
 * UJAMAADAO Enhanced User Serialization
 */
export function serializeUser(
  user: User & {
    privacySettings?: UserPrivacySettings | null;
    userRoles?: UserRole[];
    primaryWard?: (Ward & {
      constituency?: (Constituency & {
        county?: County;
      }) | null;
    }) | null;
    groups?: Array<{
      role: string;
      group: {
        id: string;
        name: string;
        groupType: string;
      };
    }>;
  },
  requesterRoles: string[] = [],
  opts: { isOwner?: boolean } = {}
): UjamaadaoSerializedUser {
  const isSuperAdmin = requesterRoles.includes('system:super_admin');
  const isOwner = !!opts.isOwner;
  const isGroupMember = requesterRoles.some(role => role.startsWith('group:'));

  // Resolve privacy settings with UJAMAADAO defaults
  const privacy = user.privacySettings?.settings ?? getUjamaadaoPrivacySettings();

  // Calculate dynamic UJAMAADAO properties
  const verificationLevel = calculateVerificationLevel(user);
  const verificationProgress = calculateVerificationProgress(user);
  const votingWeight = calculateVotingWeight(user.globalImpactPoints);
  const economicTier = determineEconomicTier(user.globalImpactPoints);
  const geographicHierarchy = buildGeographicHierarchy(user);

  // Helper to compute field visibility based on UJAMAADAO privacy rules
  const canViewField = (field: string): boolean => {
    // Owner or super-admin can always view
    if (isSuperAdmin || isOwner) return true;

    const visibility = privacy[field] ?? 'private';
    switch (visibility) {
      case 'public':
        return true;
      case 'group':
        return isGroupMember;
      case 'private':
      default:
        return false;
    }
  };

  // Build the serialized user object
  const result: UjamaadaoSerializedUser = {
    // Public Fields (Always Visible)
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? undefined,
    industryId: user.industryId ?? undefined,
    
    // UJAMAADAO Geographic Identity (Public)
    geographicHierarchy,
    
    // UJAMAADAO Verification Status (Public)
    verificationLevel,
    verificationProgress,
    
    // UJAMAADAO Economic System (Public)
    economicSummary: {
      globalImpactPoints: user.globalImpactPoints,
      utilityTokens: user.utilityTokens,
      participationRights: user.participationRights,
      votingWeight,
      economicTier,
      canParticipateEconomically: verificationLevel === 'COMMUNITY_VERIFIED' || verificationLevel === 'FULL_VERIFIED',
      canParticipateGovernance: verificationLevel !== 'UNVERIFIED',
    },
  };

  // Group-Scoped Fields (Community Members)
  if (canViewField('roles') && user.userRoles) {
    result.roles = extractUjamaadaoRoles(user.userRoles);
  }

  if (canViewField('groups') && user.groups) {
    result.groups = extractUjamaadaoGroups(user);
  }

  // Private Fields (Owner/Admin Only)
  if (canViewField('email')) {
    result.email = user.email;
  }

  if (canViewField('phoneNumber')) {
    result.phoneNumber = user.phoneNumber;
  }

  if (canViewField('walletAddress')) {
    result.walletAddress = user.walletAddress;
  }

  // Owner/Admin Only Fields
  if (isOwner || isSuperAdmin) {
    result.verificationDetails = {
      emailVerified: user.emailVerified, // <--- ADDED
      phoneVerified: user.phoneVerified,
      communityVerified: user.communityVerified,
      locationVerified: user.locationVerified,
      lastVerificationUpdate: user.updatedAt,
    };

    result.accountStatus = {
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  return result;
}

/**
 * UJAMAADAO Minimal User Serialization
 */
export function serializeUserMinimal(
  user: User & {
    primaryWard?: (Ward & {
      constituency?: (Constituency & {
        county?: County;
      }) | null;
    }) | null;
  }
): any {
  const verificationLevel = calculateVerificationLevel(user);
  const votingWeight = calculateVotingWeight(user.globalImpactPoints);

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    verificationLevel,
    geographicContext: user.primaryWard ? {
      wardName: user.primaryWard.name,
      constituencyName: user.primaryWard.constituency?.name,
      countyName: user.primaryWard.constituency?.county?.name,
    } : undefined,
    economicSummary: {
      globalImpactPoints: user.globalImpactPoints,
      votingWeight,
    },
  };
}

/**
 * UJAMAADAO Economic Profile Serialization
 */
export function serializeUserEconomic(
  user: User
): any {
  const verificationLevel = calculateVerificationLevel(user);
  const votingWeight = calculateVotingWeight(user.globalImpactPoints);
  const economicTier = determineEconomicTier(user.globalImpactPoints);

  return {
    id: user.id,
    name: user.name,
    verificationLevel,
    economicProfile: {
      globalImpactPoints: user.globalImpactPoints,
      utilityTokens: user.utilityTokens,
      participationRights: user.participationRights,
      votingWeight,
      economicTier,
      canParticipateEconomically: verificationLevel === 'COMMUNITY_VERIFIED' || verificationLevel === 'FULL_VERIFIED',
      lastPRReset: user.lastPRReset,
    },
  };
}
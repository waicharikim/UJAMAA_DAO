// src/core/rbac/roles.ts
// Values must match role names seeded in backend/src/core/database/seed.ts

export const SystemRoles = {
  SUPER_ADMIN: 'system:super_admin',
  AUDITOR: 'system:auditor',
  SUPPORT: 'system:support',
  COMPLIANCE_OFFICER: 'system:compliance_officer',    // verification, disputes, rule enforcement
  COUNTY_COORDINATOR: 'system:county_coordinator',    // 47 county-level elected observers
  BLOCKCHAIN_ADMIN: 'system:blockchain_admin',        // manages smart contracts, deploys, emergency pauses
  CONTRACT_DEPLOYER: 'system:contract_deployer',      // can deploy new contracts
  MULTISIG_SIGNER: 'system:multisig_signer',          // signs critical on-chain transactions
  WARD_ADMIN: 'location:ward_admin',
  CONSTITUENCY_ADMIN: 'location:constituency_admin',
  COUNTY_ADMIN: 'location:county_admin',
  GROUP_LEADER: 'group:leader',
  GROUP_TREASURER: 'group:treasurer',
  GROUP_ADMIN: 'group:admin',
  GROUP_AUDITOR: 'group:auditor',
  PROJECT_MANAGER: 'project:manager',
  PROJECT_VERIFIER: 'project:verifier',
} as const;

// GroupRoles maps to the GroupMember.role Prisma enum (not the roles table).
// Must stay in sync with the GroupRole enum in prisma/schema.prisma.
export const GroupRoles = {
  MEMBER: 'MEMBER',
  LEADER: 'LEADER',
  TREASURER: 'TREASURER',
  AUDITOR: 'AUDITOR',
  FACILITATOR: 'FACILITATOR',
  MENTOR: 'MENTOR',
  SECRETARY: 'SECRETARY',    // In Prisma enum — included for completeness
  MODERATOR: 'MODERATOR',   // In Prisma enum — included for completeness
} as const;

export type SystemRole = keyof typeof SystemRoles;
export type GroupRole = keyof typeof GroupRoles;
export type AnyRole = SystemRole | GroupRole;

// Role hierarchy: LEADER has all lower permissions.
// Used by roleIncludes() — a permission check passes if the user's role
// inherits the required role.
export const RoleHierarchy: Partial<Record<GroupRole, GroupRole[]>> = {
  LEADER:      ['LEADER', 'FACILITATOR', 'MODERATOR', 'SECRETARY', 'MENTOR', 'MEMBER'],
  TREASURER:   ['TREASURER', 'MEMBER'],
  AUDITOR:     ['AUDITOR', 'MEMBER'],
  FACILITATOR: ['FACILITATOR', 'MEMBER'],
  MENTOR:      ['MENTOR', 'MEMBER'],
  MODERATOR:   ['MODERATOR', 'MEMBER'],
  SECRETARY:   ['SECRETARY', 'MEMBER'],
  MEMBER:      ['MEMBER'],
};

// Check if a user's actual role satisfies a required role via hierarchy.
// e.g. roleIncludes('LEADER', 'MEMBER') === true
export function roleIncludes(userRole: GroupRole, requiredRole: GroupRole): boolean {
  return RoleHierarchy[userRole]?.includes(requiredRole) ?? false;
}

// Runtime type guards
export function isValidSystemRole(role: string): role is (typeof SystemRoles)[SystemRole] {
  return Object.values(SystemRoles).includes(role as (typeof SystemRoles)[SystemRole]);
}

export function isValidGroupRole(role: string): role is GroupRole {
  return Object.keys(GroupRoles).includes(role);
}

// Display names for UI rendering
export const RoleDisplayNames: Record<string, string> = {
  'system:super_admin': 'Super Administrator',
  'system:auditor': 'Platform Auditor',
  'system:support': 'Support Staff',
  'system:compliance_officer': 'Compliance Officer',
  'system:county_coordinator': 'County Coordinator',
  'system:blockchain_admin': 'Blockchain Administrator',
  'system:contract_deployer': 'Contract Deployer',
  'system:multisig_signer': 'Multisig Signer',
  'location:ward_admin': 'Ward Administrator',
  'location:constituency_admin': 'Constituency Administrator',
  'location:county_admin': 'County Administrator',
  'group:leader': 'Group Leader',
  'group:treasurer': 'Group Treasurer',
  'group:admin': 'Group Administrator',
  'group:auditor': 'Group Auditor',
  'project:manager': 'Project Manager',
  'project:verifier': 'Project Verifier',
  MEMBER: 'Member',
  LEADER: 'Leader',
  TREASURER: 'Treasurer',
  AUDITOR: 'Group Auditor',
  FACILITATOR: 'Facilitator',
  MENTOR: 'Mentor',
  SECRETARY: 'Secretary',
  MODERATOR: 'Moderator',
};

// Descriptions for onboarding and help text
export const GroupRoleDescriptions: Record<GroupRole, string> = {
  LEADER:      'Group leader with full administrative and governance permissions',
  TREASURER:   'Manages group finances, dues, and budget allocations',
  AUDITOR:     'Reviews and audits group financial activities for accountability',
  FACILITATOR: 'Coordinates meetings, discussions, and group activities',
  MENTOR:      'Provides guidance and support to group members',
  SECRETARY:   'Maintains group records, minutes, and correspondence',
  MODERATOR:   'Moderates discussions and maintains community standards',
  MEMBER:      'Standard group member with participation and voting rights',
};

// How each role is assigned. Used by governance module to validate assignment paths.
// ELECTED = democratic vote required
// APPOINTED = assigned by a higher authority (LEADER or SUPER_ADMIN)
// DEFAULT = auto-assigned on join (no action required)
export const AssignmentMethod = {
  ELECTED:   'ELECTED',
  APPOINTED: 'APPOINTED',
  DEFAULT:   'DEFAULT',
} as const;
export type AssignmentMethodType = (typeof AssignmentMethod)[keyof typeof AssignmentMethod];

// Which method applies to each group role (system group leaders are always ELECTED)
export const GroupRoleAssignment: Record<GroupRole, AssignmentMethodType> = {
  LEADER:      AssignmentMethod.ELECTED,    // Ward/Constituency/County leaders — democratic vote
  TREASURER:   AssignmentMethod.ELECTED,    // Elected at system group level
  AUDITOR:     AssignmentMethod.ELECTED,    // Elected at system group level
  FACILITATOR: AssignmentMethod.APPOINTED,  // Appointed by group LEADER
  MENTOR:      AssignmentMethod.APPOINTED,  // Appointed by group LEADER
  SECRETARY:   AssignmentMethod.APPOINTED,  // Appointed by group LEADER
  MODERATOR:   AssignmentMethod.APPOINTED,  // Appointed by group LEADER
  MEMBER:      AssignmentMethod.DEFAULT,    // Auto-assigned on group join / verification
};

// Which system roles require SUPER_ADMIN appointment vs are purely platform-internal
export const SystemRoleAssignment: Partial<Record<SystemRole, AssignmentMethodType>> = {
  SUPER_ADMIN:          AssignmentMethod.APPOINTED,  // Platform only
  AUDITOR:              AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN
  SUPPORT:              AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN
  COMPLIANCE_OFFICER:   AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN
  COUNTY_COORDINATOR:   AssignmentMethod.ELECTED,    // Elected by county members
  BLOCKCHAIN_ADMIN:     AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN (technical)
  CONTRACT_DEPLOYER:    AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN (technical)
  MULTISIG_SIGNER:      AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN (technical)
  WARD_ADMIN:           AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN
  CONSTITUENCY_ADMIN:   AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN
  COUNTY_ADMIN:         AssignmentMethod.APPOINTED,  // Appointed by SUPER_ADMIN
  GROUP_LEADER:         AssignmentMethod.APPOINTED,  // System role reflecting group leader status
  GROUP_TREASURER:      AssignmentMethod.APPOINTED,
  GROUP_ADMIN:          AssignmentMethod.APPOINTED,
  GROUP_AUDITOR:        AssignmentMethod.APPOINTED,
  PROJECT_MANAGER:      AssignmentMethod.APPOINTED,
  PROJECT_VERIFIER:     AssignmentMethod.APPOINTED,
};

// Minimum verified member count before a first election can be triggered.
// Appointed roles (BLOCKCHAIN_ADMIN, COMPLIANCE_OFFICER, etc.) have no threshold —
// they can be assigned by SUPER_ADMIN at any time.
// Enforcement lives in the governance module — these are the source-of-truth constants.
export const ElectionThresholds = {
  // Geographic system group elections
  WARD_LEADER:             10,  // Ward group needs >= 10 verified members
  WARD_TREASURER:          10,  // Same ward threshold
  WARD_AUDITOR:            10,  // Same ward threshold
  CONSTITUENCY_LEADER:     30,  // Constituency group needs >= 30 verified members
  COUNTY_LEADER:           50,  // County group needs >= 50 verified members
  COUNTY_COORDINATOR:      50,  // Same county threshold as county leader

  // Voluntary group elections — lower bar, community decides when ready
  VOLUNTARY_GROUP_LEADER:   5,  // Voluntary groups can elect once >= 5 members
} as const;

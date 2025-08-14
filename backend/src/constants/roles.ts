/**
 * @file src/constants/roles.js
 * @description
 * Canonical role names and helpers for the system.
 *
 * Roles are namespaced and lowercase:
 *  - group:<role>
 *  - project:<role>
 *  - system:<role>
 *  - wallet:<role>
 *  - payment:<role>
 *  - chain:<role>
 *
 * Exported items:
 *  - arrays (for route definitions/documentation)
 *  - Sets (for fast membership checks)
 *  - helper functions (normalizeRole, isValidRole, isGroupRole, etc.)
 */

export const GROUP_ROLES = [
  'group:member',
  'group:admin',
  'group:treasurer',
  'group:auditor',
];

export const PROJECT_ROLES = [
  'project:member',
  'project:admin',
  'project:milestone_verifier',
];

export const SYSTEM_ROLES = [
  'system:super_admin',
  'system:auditor',
  'system:compliance_officer',
  'system:support_staff',
  'system:general_user',
];

// Wallet and payment related roles (added)
export const WALLET_ROLES = [
  'wallet:user',
  'wallet:group_admin',
  'wallet:admin',
];

export const PAYMENT_ROLES = [
  'payment:processor', // service role that can call payout endpoints
];

export const CHAIN_ROLES = [
  'chain:token_minter',
  'chain:governor_admin',
];

// Common role lists used in route guards
export const USER_ACCESS_ROLES = [
  'group:member',
  'group:admin',
  'project:member',
  'project:admin',
  'system:general_user',
  'system:super_admin',
];

export const ADMIN_ACCESS_ROLES = [
  'system:super_admin',
  'system:auditor',
  'system:compliance_officer',
];

// Combined lists
export const ALL_ROLES = [
  ...GROUP_ROLES,
  ...PROJECT_ROLES,
  ...SYSTEM_ROLES,
  ...WALLET_ROLES,
  ...PAYMENT_ROLES,
  ...CHAIN_ROLES,
];

// Sets for fast contains checks (lowercased keys)
const allLower = ALL_ROLES.map(r => r.toLowerCase());
export const ALL_ROLES_SET = new Set(allLower);
export const GROUP_ROLES_SET = new Set(GROUP_ROLES.map(r => r.toLowerCase()));
export const PROJECT_ROLES_SET = new Set(PROJECT_ROLES.map(r => r.toLowerCase()));
export const SYSTEM_ROLES_SET = new Set(SYSTEM_ROLES.map(r => r.toLowerCase()));
export const WALLET_ROLES_SET = new Set(WALLET_ROLES.map(r => r.toLowerCase()));
export const PAYMENT_ROLES_SET = new Set(PAYMENT_ROLES.map(r => r.toLowerCase()));
export const CHAIN_ROLES_SET = new Set(CHAIN_ROLES.map(r => r.toLowerCase()));
export const USER_ACCESS_ROLES_SET = new Set(USER_ACCESS_ROLES.map(r => r.toLowerCase()));
export const ADMIN_ACCESS_ROLES_SET = new Set(ADMIN_ACCESS_ROLES.map(r => r.toLowerCase()));

/**
 * normalizeRole
 * Ensures a role string is trimmed and lowercased for deterministic comparison.
 */
export function normalizeRole(role) {
  return String(role ?? '').trim().toLowerCase();
}

/**
 * isValidRole
 * Returns true if role is one of the known roles.
 */
export function isValidRole(role) {
  return ALL_ROLES_SET.has(normalizeRole(role));
}

export function isGroupRole(role) {
  return GROUP_ROLES_SET.has(normalizeRole(role));
}

export function isProjectRole(role) {
  return PROJECT_ROLES_SET.has(normalizeRole(role));
}

export function isSystemRole(role) {
  return SYSTEM_ROLES_SET.has(normalizeRole(role));
}

export function isWalletRole(role) {
  return WALLET_ROLES_SET.has(normalizeRole(role));
}

export function isPaymentRole(role) {
  return PAYMENT_ROLES_SET.has(normalizeRole(role));
}

export function isChainRole(role) {
  return CHAIN_ROLES_SET.has(normalizeRole(role));
}

// Export canonical arrays and sets for convenience
export {
  GROUP_ROLES,
  PROJECT_ROLES,
  SYSTEM_ROLES,
  WALLET_ROLES,
  PAYMENT_ROLES,
  CHAIN_ROLES,
  USER_ACCESS_ROLES,
  ADMIN_ACCESS_ROLES,
};
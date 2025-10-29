/**
 * @file roles.ts
 * 
 * @description
 * UJAMAADAO Role Definition and Management Constants
 * 
 * Centralized role management system for the UJAMAADAO platform that defines:
 * - All platform roles with clear namespacing and hierarchy
 * - Geographic role system for location-based governance
 * - Role validation and normalization utilities
 * - Dynamic role loading from database for extensibility
 * 
 * UJAMAADAO ROLE NAMESPACING CONVENTION:
 * - system:    Platform-wide administration and system operations
 * - location:  Geographic hierarchy roles (ward → constituency → county → national)
 * - group:     Community organization and group management
 * - project:   Project-specific responsibilities and permissions
 * - economic:  Economic system and impact point management
 * - wallet:    Wallet and financial transaction permissions
 * - chain:     Blockchain and smart contract operations
 * - payment:   Payment processing and financial operations
 * 
 * Role Hierarchy in UJAMAADAO:
 * - Geographic roles are automatically assigned based on user's primary ward
 * - System roles provide platform-wide administrative capabilities
 * - Group roles manage community organizations and initiatives
 * - Economic roles enable participation in the dual-token system
 */

import type { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * RoleScope Interface
 * 
 * Defines the structure for roles with optional geographic or resource scoping.
 * Scopes are essential for UJAMAADAO's location-based governance model.
 */
export type RoleScope = { role: string; scope?: string };

/* ============================================================================
 * UJAMAADAO ROLE CATEGORIES
 * ============================================================================
 */

/**
 * GROUP ROLES - Community Organization Management
 * 
 * Roles for managing ward communities, constituency projects, and county initiatives.
 * These roles enable community-led governance and project execution.
 */
export const GROUP_ROLES = [
  'group:member',        // Basic group membership
  'group:admin',         // Group administration and management
  'group:treasurer',     // Financial management and treasury oversight
  'group:auditor',       // Financial auditing and compliance
  'group:facilitator',   // Community facilitation and coordination
  'group:mentor',        // Member guidance and skill development
  'group:leader',        // Group leadership and strategic direction
];

/**
 * PROJECT ROLES - Project Execution and Management
 * 
 * Roles for participating in and managing community development projects.
 * Project roles are typically temporary and tied to specific initiatives.
 */
export const PROJECT_ROLES = [
  'project:member',              // Basic project participation
  'project:admin',               // Project administration and management
  'project:milestone_verifier',  // Milestone completion verification
  'project:quality_controller',  // Quality assurance and standards
  'project:expert_advisor',      // Technical and domain expertise
  'project:coordinator',         // Project coordination and logistics
];

/**
 * SYSTEM ROLES - Platform Administration
 * 
 * Platform-wide administrative roles for system management, compliance,
 * and user support. These roles have broad permissions across the platform.
 */
export const SYSTEM_ROLES = [
  'system:super_admin',          // Full platform administration
  'system:auditor',              // System-wide auditing and compliance
  'system:compliance_officer',   // Regulatory and policy compliance
  'system:support_staff',        // User support and assistance
  'system:general_user',         // Base user role (all authenticated users)
  'system:data_analyst',         // Analytics and reporting access
  'system:content_moderator',    // Content moderation and review
];

/**
 * WALLET ROLES - Financial and Wallet Management
 * 
 * Roles for managing wallet operations, transactions, and financial security.
 * Critical for the UJAMAADAO economic system and token management.
 */
export const WALLET_ROLES = [
  'wallet:user',                 // Basic wallet operations
  'wallet:group_admin',          // Group wallet management
  'wallet:admin',                // Platform wallet administration
  'wallet:multi_sig_approver',   // Multi-signature transaction approval
];

/**
 * PAYMENT ROLES - Payment Processing
 * 
 * Roles for handling payment operations, escrow management, and financial
 * transactions within the marketplace and economic system.
 */
export const PAYMENT_ROLES = [
  'payment:processor',           // Payment processing operations
  'payment:escrow_manager',      // Escrow account management
  'payment:dispute_resolver',    // Payment dispute resolution
];

/**
 * CHAIN ROLES - Blockchain Operations
 * 
 * Roles for managing blockchain interactions, smart contract operations,
 * and token management on the underlying blockchain infrastructure.
 */
export const CHAIN_ROLES = [
  'chain:token_minter',          // Token minting and issuance
  'chain:governor_admin',        // Governance contract administration
  'chain:bridge_operator',       // Cross-chain bridge operations
  'chain:validator',             // Network validation and consensus
];

/**
 * LOCATION ROLES - Geographic Hierarchy Management
 * 
 * UJAMAADAO CORE FEATURE: Automatic geographic role assignment based on
 * the ward → constituency → county → national hierarchy.
 * 
 * These roles enable location-based governance, voting rights, and
 * community participation at different geographic levels.
 */
export const LOCATION_ROLES = [
  // WARD LEVEL - Hyper-local community participation
  'location:ward_member',        // Basic ward membership (all ward residents)
  'location:ward_admin',         // Ward administration and management
  'location:ward_treasurer',     // Ward treasury management
  'location:ward_auditor',       // Ward financial auditing
  
  // CONSTITUENCY LEVEL - Intermediate governance
  'location:constituency_member', // Automatic constituency membership via ward
  'location:constituency_admin',  // Constituency administration
  'location:constituency_leader', // Constituency leadership
  
  // COUNTY LEVEL - Regional administration
  'location:county_member',      // Automatic county membership via constituency
  'location:county_admin',       // County administration
  'location:county_leader',      // County leadership
  
  // NATIONAL LEVEL - Platform-wide coordination
  'location:national_member',    // National platform membership
  'location:national_admin',     // National administration
  'location:national_leader',    // National leadership
];

/**
 * ECONOMIC ROLES - Impact Point and Token System
 * 
 * UJAMAADAO CORE FEATURE: Roles related to the dual-token economic system,
 * impact point management, and economic participation.
 */
export const ECONOMIC_ROLES = [
  'economic:contributor',        // Basic economic participation
  'economic:high_contributor',   // Significant impact point accumulation
  'economic:expert',             // Verified domain expertise
  'economic:validator',          // Work and contribution validation
  'economic:auditor',            // Economic system auditing
  'economic:treasury_manager',   // Community treasury management
];

/**
 * USER ACCESS ROLES - General Platform Access
 * 
 * Roles that grant basic platform access and participation capabilities.
 * These roles are typically assigned to all verified users.
 */
export const USER_ACCESS_ROLES = [
  'group:member',
  'group:admin', 
  'project:member',
  'project:admin',
  'system:general_user',
  'economic:contributor',
  ...LOCATION_ROLES.filter(role => role.includes('_member')), // All location member roles
];

/**
 * ADMIN ACCESS ROLES - Administrative Privileges
 * 
 * Roles with elevated permissions for platform administration, compliance,
 * and system management. These roles require careful assignment and auditing.
 */
export const ADMIN_ACCESS_ROLES = [
  'system:super_admin',
  'system:auditor', 
  'system:compliance_officer',
  'location:national_admin',
  'location:national_leader',
  'economic:auditor',
];

/**
 * ALL ROLES - Comprehensive Role List
 * 
 * Complete enumeration of all roles in the UJAMAADAO platform.
 * Used for validation, normalization, and dynamic role management.
 */
export const ALL_ROLES = [
  ...GROUP_ROLES,
  ...PROJECT_ROLES,
  ...SYSTEM_ROLES,
  ...WALLET_ROLES,
  ...PAYMENT_ROLES,
  ...CHAIN_ROLES,
  ...LOCATION_ROLES,
  ...ECONOMIC_ROLES,
];

/* ============================================================================
 * ROLE NORMALIZATION AND VALIDATION UTILITIES
 * ============================================================================
 */

/**
 * Normalize Role String
 * 
 * Converts any role input to a standardized lowercase format for consistent
 * comparison and validation. Handles null/undefined inputs safely.
 * 
 * @param role - Raw role input (string, null, undefined, or other)
 * @returns Normalized role string in lowercase
 */
export function normalizeRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

/**
 * Role Validation Sets
 * 
 * Pre-computed sets for efficient role validation and categorization.
 * These sets enable O(1) lookups for role validation and filtering.
 */

// Comprehensive role sets for validation
const allLower = ALL_ROLES.map(normalizeRole);
export const ALL_ROLES_SET = new Set(allLower);
export const GROUP_ROLES_SET = new Set(GROUP_ROLES.map(normalizeRole));
export const PROJECT_ROLES_SET = new Set(PROJECT_ROLES.map(normalizeRole));
export const SYSTEM_ROLES_SET = new Set(SYSTEM_ROLES.map(normalizeRole));
export const WALLET_ROLES_SET = new Set(WALLET_ROLES.map(normalizeRole));
export const PAYMENT_ROLES_SET = new Set(PAYMENT_ROLES.map(normalizeRole));
export const CHAIN_ROLES_SET = new Set(CHAIN_ROLES.map(normalizeRole));
export const LOCATION_ROLES_SET = new Set(LOCATION_ROLES.map(normalizeRole));
export const ECONOMIC_ROLES_SET = new Set(ECONOMIC_ROLES.map(normalizeRole));
export const USER_ACCESS_ROLES_SET = new Set(USER_ACCESS_ROLES.map(normalizeRole));
export const ADMIN_ACCESS_ROLES_SET = new Set(ADMIN_ACCESS_ROLES.map(normalizeRole));

/**
 * Dynamic Role Allowlist
 * 
 * Extensible role validation system that starts with the canonical role set
 * but can be extended with custom roles from the database or environment.
 * This enables role customization without code changes.
 */
const dynamicAllowed = new Set<string>(allLower);

/**
 * Load Dynamic Roles from Database
 * 
 * UJAMAADAO EXTENSIBILITY: Loads custom roles from the database Role registry
 * during application startup. This allows for dynamic role management
 * and custom role definitions without redeployment.
 * 
 * @param prisma - Prisma client for database access
 * @throws Error if database connection fails during startup
 */
export async function loadDynamicRoles(prisma: PrismaClient) {
  try {
    const rows = await prisma.role.findMany({ select: { name: true } });
    for (const role of rows) {
      const normalizedRole = normalizeRole(role.name);
      if (normalizedRole) {
        dynamicAllowed.add(normalizedRole);
        logger.info(`UJAMAADAO Roles: Loaded dynamic role from database`, { role: normalizedRole });
      }
    }
    logger.info(`UJAMAADAO Roles: Loaded ${rows.length} dynamic roles from database`);
  } catch (error) {
    // Critical failure - cannot proceed without role validation
    logger.error('UJAMAADAO Roles: Failed to load dynamic roles from database', { error });
    throw error;
  }
}

/**
 * Add Extra Allowed Roles
 * 
 * Programmatically add roles from environment variables or configuration.
 * Used for deployment-specific roles and temporary role assignments.
 * 
 * @param names - Array of role names to add to the allowlist
 */
export function addExtraAllowedRoles(names: string[]) {
  for (const name of names) {
    const normalizedName = normalizeRole(name);
    if (normalizedName) {
      dynamicAllowed.add(normalizedName);
      logger.debug(`UJAMAADAO Roles: Added extra allowed role`, { role: normalizedName });
    }
  }
}

/**
 * Reset Dynamic Allowed Roles for Testing
 * 
 * TESTING UTILITY: Resets the dynamic role allowlist to the canonical set.
 * Used in test suites to ensure consistent role validation across tests.
 */
export function resetDynamicAllowedForTests() {
  dynamicAllowed.clear();
  for (const role of allLower) {
    dynamicAllowed.add(role);
  }
  logger.debug('UJAMAADAO Roles: Reset dynamic allowed roles for testing');
}

/* ============================================================================
 * ROLE PARSING AND INPUT VALIDATION
 * ============================================================================
 */

/**
 * Parse Role String into RoleScope Object
 * 
 * Converts string role representations into structured RoleScope objects.
 * Supports multiple formats for flexibility in role specification.
 * 
 * Supported Formats:
 * - "role" → { role: "role" }
 * - "namespace:role" → { role: "namespace:role" }
 * - "namespace:role:scope" → { role: "namespace:role", scope: "scope" }
 * 
 * @param input - Raw role string input
 * @returns Structured RoleScope object or null if invalid
 */
export function parseRoleString(input: unknown): RoleScope | null {
  if (typeof input !== 'string') return null;
  const trimmedInput = input.trim();
  if (!trimmedInput) return null;
  
  const parts = trimmedInput.split(':').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  
  // Single part: role only
  if (parts.length === 1) {
    return { role: normalizeRole(parts[0]) };
  }
  
  // Two parts: namespace:role
  if (parts.length === 2) {
    return { role: normalizeRole(parts.join(':')) };
  }
  
  // Three or more parts: namespace:role:scope
  const scope = parts[parts.length - 1];
  const role = parts.slice(0, parts.length - 1).join(':');
  return { 
    role: normalizeRole(role), 
    scope: scope || undefined 
  };
}

/**
 * Parse Role Input into RoleScope Object
 * 
 * Universal role parser that handles both string and object inputs.
 * Used throughout the UJAMAADAO platform for consistent role processing.
 * 
 * @param input - Role input (string or object)
 * @returns Structured RoleScope object or null if invalid
 */
export function parseRoleInput(input: unknown): RoleScope | null {
  if (!input) return null;
  
  // Handle string inputs
  if (typeof input === 'string') {
    return parseRoleString(input);
  }
  
  // Handle object inputs
  if (typeof input === 'object') {
    const roleObject = input as any;
    const roleValue = roleObject.role;
    const scopeValue = roleObject.scope;
    
    const normalizedRole = normalizeRole(roleValue ?? '');
    if (!normalizedRole) return null;
    
    return { 
      role: normalizedRole, 
      scope: scopeValue ?? undefined 
    };
  }
  
  return null;
}

/* ============================================================================
 * ROLE VALIDATION AND CATEGORIZATION FUNCTIONS
 * ============================================================================
 */

/**
 * Check if Role is Valid
 * 
 * Validates that a role exists in the dynamic allowlist, which includes
 * both canonical roles and dynamically loaded custom roles.
 * 
 * @param role - Role to validate
 * @returns True if role is valid and allowed
 */
export function isValidRole(role: unknown): boolean {
  return dynamicAllowed.has(normalizeRole(role));
}

/**
 * Role Category Validators
 * 
 * Specialized validators for checking role categories and permissions.
 * Used for role-based access control and permission filtering.
 */

export function isGroupRole(role: unknown): boolean {
  return GROUP_ROLES_SET.has(normalizeRole(role));
}

export function isProjectRole(role: unknown): boolean {
  return PROJECT_ROLES_SET.has(normalizeRole(role));
}

export function isSystemRole(role: unknown): boolean {
  return SYSTEM_ROLES_SET.has(normalizeRole(role));
}

export function isWalletRole(role: unknown): boolean {
  return WALLET_ROLES_SET.has(normalizeRole(role));
}

export function isPaymentRole(role: unknown): boolean {
  return PAYMENT_ROLES_SET.has(normalizeRole(role));
}

export function isChainRole(role: unknown): boolean {
  return CHAIN_ROLES_SET.has(normalizeRole(role));
}

/**
 * UJAMAADAO LOCATION ROLE VALIDATORS
 * 
 * Specialized validators for geographic hierarchy roles.
 * Essential for location-based governance and community participation.
 */
export function isLocationRole(role: unknown): boolean {
  return LOCATION_ROLES_SET.has(normalizeRole(role));
}

export function isLocationMemberRole(role: unknown): boolean {
  const normalizedRole = normalizeRole(role);
  return LOCATION_ROLES_SET.has(normalizedRole) && normalizedRole.includes('_member');
}

export function isLocationAdminRole(role: unknown): boolean {
  const normalizedRole = normalizeRole(role);
  return LOCATION_ROLES_SET.has(normalizedRole) && normalizedRole.includes('_admin');
}

export function isLocationLeaderRole(role: unknown): boolean {
  const normalizedRole = normalizeRole(role);
  return LOCATION_ROLES_SET.has(normalizedRole) && normalizedRole.includes('_leader');
}

/**
 * UJAMAADAO ECONOMIC ROLE VALIDATORS
 * 
 * Validators for economic system roles related to impact points and tokens.
 */
export function isEconomicRole(role: unknown): boolean {
  return ECONOMIC_ROLES_SET.has(normalizeRole(role));
}

export function isHighContributorRole(role: unknown): boolean {
  return normalizeRole(role) === 'economic:high_contributor';
}

export function isExpertRole(role: unknown): boolean {
  return normalizeRole(role) === 'economic:expert';
}

/**
 * Role Key Generator
 * 
 * Creates a unique key for role+scope combinations used in role deduplication
 * and caching. Essential for the role attachment middleware.
 * 
 * @param roleScope - RoleScope object with role and optional scope
 * @returns Unique string key for the role-scope combination
 */
export function roleKey(roleScope: RoleScope): string {
  return roleScope.scope 
    ? `${roleScope.role}:${roleScope.scope}`
    : roleScope.role;
}

/**
 * Get Geographic Level from Location Role
 * 
 * UJAMAADAO UTILITY: Extracts the geographic level from a location role.
 * Used for geographic hierarchy processing and permission escalation.
 * 
 * @param role - Location role string
 * @returns Geographic level (ward, constituency, county, national) or null
 */
export function getGeographicLevelFromRole(role: string): 'ward' | 'constituency' | 'county' | 'national' | null {
  const normalized = normalizeRole(role);
  
  if (normalized.includes('ward')) return 'ward';
  if (normalized.includes('constituency')) return 'constituency';
  if (normalized.includes('county')) return 'county';
  if (normalized.includes('national')) return 'national';
  
  return null;
}
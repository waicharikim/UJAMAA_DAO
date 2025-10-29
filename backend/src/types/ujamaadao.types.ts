/**
 * @file ujamaadao.types.ts
 *
 * @description
 * Centralized Type Definitions for the UJAMAADAO Platform, using native TypeScript interfaces.
 * These types encompass core context, extended request objects, and middleware options.
 *
 * This file fully supersedes ujamaadao.types.js.
 */

import { Request } from 'express';
import { IncomingHttpHeaders } from 'http'; // Needed for explicit req.headers type
import { ZodSchema } from 'zod'; // Added ZodSchema import for validation types

// ============================================================================
// CORE CANONICAL TYPES
// ============================================================================

/**
 * Canonical set of geographic hierarchy scopes for the platform.
 */
export type LocationScope = 'WARD'|'CONSTITUENCY'|'COUNTY'|'NATIONAL';

/**
 * Canonical set of verification statuses.
 * NOTE: Aligned to specific access gates, including the correct 'FULL_VERIFIED' state.
 */
export type VerificationLevel = 'UNVERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULL_VERIFIED';

/**
 * Canonical Role Structure used in JWT and attached to AuthRequest.
 * Represents a role combined with its geographic or resource scope.
 */
export interface RoleScope {
  role: string; // e.g., 'member', 'admin', 'council'
  scope?: string; // The ID of the resource or geographic area (e.g., 'ward:123', 'project:ABC', 'system')
}

// ============================================================================
// CORE CONTEXT INTERFACES
// ============================================================================

/**
 * Geographic Context
 * Details the user's current or assigned location based on profile or GeoIP lookup.
 */
export interface GeographicContext {
  primaryWardId?: string;
  constituencyId?: string;
  countyId?: string;
  locationScope?: LocationScope; // Use canonical LocationScope type
  latitude?: number;
  longitude?: number;
}

/**
 * Economic Context
 * Details the user's current economic standing and metrics.
 */
export interface EconomicContext {
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights: number;
  economicTier?: string; // e.g., 'TIER_1', 'TIER_2'
}

/**
 * Auth User
 * Represents the essential authenticated user details attached by the Auth middleware.
 */
export interface AuthUser {
   // Core identity
  userId: string;
  email: string;
  phoneNumber?: string;
  walletAddress: string;
  
  // Geographic identity
  primaryWardId?: string;
  secondaryWardId?: string;
  
  // Verification status
  verificationLevel: VerificationLevel;
  emailVerified: boolean;
  phoneVerified: boolean;
  communityVerified: boolean;
  locationVerified: boolean;
  
  // Roles
  roles: string[]; // Simple string array as used in JWT
  
  // Economic system
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights: number;
  
  // Geographic context (full object)
  profileGeographicContext?: GeographicContext;
}

// ============================================================================
// EXTENDED REQUEST TYPE
// ============================================================================

/**
 * Auth Request
 * Extended Express Request object carrying UJAMAADAO-specific context data
 * attached by the middleware pipeline (auth, geographic, economic).
 */
export interface AuthRequest extends Request {
  originalUrl: any;
  url: any;
  ip: any;
  path: any;
  user?: AuthUser;
  // userRoles is used by the RBAC middleware to store the final, calculated role list.
  userRoles?: RoleScope[];
  // Geographic context determined by the middleware, based on profile or GeoIP
  geographicContext?: GeographicContext;
  // Economic context attached by the economic middleware
  economicContext?: EconomicContext;
  // Headers are often needed in custom middleware for security checks
  headers: IncomingHttpHeaders;
}

// ============================================================================
// LOGGING AND MONITORING TYPES
// ============================================================================

/**
 * UJAMAADAO Log Context Interface
 * Enhanced log context that includes platform-specific data for comprehensive
 * monitoring and debugging. This structure is used by logger.ts.
 */
export interface UjamaadaoLogContext {
  // --- Core Platform Context ---
  operationType?: 'AUTH' | 'GEOGRAPHIC' | 'ECONOMIC' | 'GOVERNANCE' | 'SECURITY' | 'PERFORMANCE' | 'GENERAL';
  verificationLevel?: 'UNVERIFIED'|'PHONE_VERIFIED'|'COMMUNITY_VERIFIED'|'FULL_VERIFIED';
  geographicContext?: GeographicContext; // Detailed geographic context
  economicContext?: EconomicContext; // Detailed economic context

  // --- Security Event Tracking (for `securityEvent` logs) ---
  securityEvent?: {
    type: 'AUTH_FAILURE' | 'GEOGRAPHIC_VIOLATION' | 'ECONOMIC_FRAUD' | 'ROLE_VIOLATION' | 'SYSTEM_ANOMALY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: string;
    resource?: string; // e.g., 'API_ENDPOINT', 'USER_ID'
  };

  // --- Performance/Audit Tracking (for `debug` or `trace` logs) ---
  operation?: string; // Specific operation name (e.g., 'WARD_LOOKUP', 'TOKEN_TRANSFER')
  duration?: number; // Duration in ms
  userId?: string; // User ID if available

  // --- Exhaustive Catch-All ---
  /**
   * Universal container for ad-hoc, temporary, or future non-standard log properties.
   * This property ensures type safety across all logger calls.
   */
  metadata?: Record<string, any>;
}

// ============================================================================
// MIDDLEWARE OPTIONS TYPES
// ============================================================================

/**
 * Options used by the validateRequest middleware.
 */
export interface UjamaadaoValidationOptions {
  schema: ZodSchema; // Changed type to ZodSchema to match implementation
  target: 'body'|'params'|'query' | 'context'; // Added 'context' target
  verificationLevel?: VerificationLevel; // Use canonical VerificationLevel type
  validateGeographicContext?: boolean;
  logValidationFailures?: boolean;
  geographicScope?: LocationScope; // Use canonical LocationScope type
  customErrorMessages?: Record<string, string>; // Added for customization
}

/**
 * Options used by the authorize middleware for role/permission checking.
 */
export interface UjamaadaoAuthorizeOptions {
  allowedRoles: string[]; // Array of roles permitted (e.g., ['system:admin', 'ward:council', '*']).
  verificationLevel?: VerificationLevel; // Use canonical VerificationLevel type
  minImpactPoints?: number;
  scopeCheck?: (req: AuthRequest) => boolean; // Custom scope check function
  resourceOwnerCheck?: (req: AuthRequest) => boolean; // Custom resource owner check function
}

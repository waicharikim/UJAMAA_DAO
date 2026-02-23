/**
 * @file src/core/types/Ujamaadao.types.ts
 * Centralized Type Definitions for the UJAMAADAO Platform
 *
 * Version: 2.1 — January 2026
 * Updated: Uses centralized SecurityEventType from security-event-types.ts
 * Security Hardened: January 2026
 */

import { Request } from 'express';
import { IncomingHttpHeaders } from 'http';
import { ZodSchema } from 'zod';

// Import centralized security event types
export type { SecurityEventType } from './security-event.types.js';

// ============================================================================
// CORE ENUMS & CANONICAL TYPES
// ============================================================================

export type LocationScope = 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';

export type VerificationLevel =
  | 'UNVERIFIED'
  | 'EMAIL_VERIFIED'
  | 'PHONE_VERIFIED'
  | 'COMMUNITY_VERIFIED'
  | 'FULL_VERIFIED';

export interface RoleScope {
  role: string;
  scope?: string;
}

// ============================================================================
// GEOGRAPHIC CONTEXT
// ============================================================================

/**
 * Full geographic identity context:
 * - secondaryWardId: Permanent origin ("where you come from") — immutable
 * - primaryWardId: Current residence — changeable with review + cooldown
 * - currentLocationId/until: Temporary travel check-in — no governance rights
 */
export interface GeographicContext {
  primaryWardId?: string;
  secondaryWardId?: string; // Permanent origin ward (set once at onboarding)
  currentLocationId?: string; // Temporary travel check-in
  currentLocationUntil?: string; // ISO date string when temporary location expires
  constituencyId?: string;
  countyId?: string;
  locationScope?: LocationScope;
  broaderScopes?: LocationScope[]; // Array for cleaner multi-scope handling
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// ECONOMIC CONTEXT
// ============================================================================

export interface EconomicContext {
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights?: number;
  economicTier?: string;
}

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

export interface AuthUser {
  userId: string;
  email?: string;
  phoneNumber?: string;
  walletAddress?: string;
  primaryWardId?: string;
  secondaryWardId?: string;
  verificationLevel: VerificationLevel;
  emailVerified: boolean;
  phoneVerified: boolean;
  communityVerified: boolean;
  roles: string[];
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights: number;
  profileGeographicContext?: GeographicContext;
}

/**
 * Extended Express Request with UjamaaDAO context
 *
 * SECURITY NOTE: PII fields (email, phoneNumber, walletAddress) should be
 * redacted before logging. Use log-sanitizer utilities.
 */
export interface AuthRequest extends Request {
  // Core Express types preserved
  method: string;
  originalUrl: string;
  url: string;
  ip: string | undefined;
  path: string;
  headers: IncomingHttpHeaders;

  // UjamaaDAO-specific context
  user?: AuthUser;
  walletAddress?: string;
  isWalletAuthenticated?: boolean;
  userId?: string;
  userRoles?: RoleScope[];
  geographicContext?: GeographicContext;
  economicContext?: EconomicContext;

  // Request tracking
  correlationId?: string;
  sessionId?: string;
  requestStartTime?: number;

  // Rate limit info (from rate limiter)
  rateLimit?: {
    limit: number;
    current: number;
    remaining: number;
    resetTime: Date;
  };
}

// ============================================================================
// WALLET AUTHENTICATION
// ============================================================================

/**
 * Context passed to wallet authentication methods
 * Contains device and network information for security tracking
 */
export interface WalletAuthContext {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

/**
 * Stored nonce for wallet signature verification
 * Includes expiry for time-bound security
 */
export interface WalletNonce {
  walletAddress: string;
  nonce: string;
  expiresAt: Date;
}

/**
 * Result of wallet authentication
 */
export interface WalletAuthResult {
  user: any; // Full User object from Prisma
  sessionToken: string;
  session?: SessionInfo;
  needsProfileCompletion: boolean;
  missingFields?: OnboardingMissingFields;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Session information returned from authentication
 */
export interface SessionInfo {
  id: string;
  token: string;
  expiresAt: Date;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActive?: Date;
  revoked?: boolean;
}

// ============================================================================
// ONBOARDING
// ============================================================================

/**
 * Onboarding status for incomplete profiles
 */
export interface OnboardingStatus {
  needsProfileCompletion: boolean;
  currentStep?: string;
  completedSteps?: string[];
  missingFields?: OnboardingMissingFields;
}

/**
 * Fields required to complete user profile
 */
export interface OnboardingMissingFields {
  email?: boolean;
  phoneNumber?: boolean;
  name?: boolean;
  primaryWard?: boolean;
  secondaryWard?: boolean;
  industries?: boolean;
  goodsServices?: boolean;
}

// ============================================================================
// SECURITY EVENTS
// ============================================================================

/**
 * Security event severity levels
 */
export type SecurityEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Note: SecurityEventType is imported from security-event-types.ts above
// This provides a single source of truth for all security event types

// ============================================================================
// LOGGING CONTEXT
// ============================================================================

/**
 * Logging context for UjamaaDAO operations
 *
 * SECURITY: Fields marked with PII should be redacted before logging:
 * - email, phoneNumber, walletAddress, ipAddress
 */
export interface UjamaadaoLogContext {
  operationType?:
    | 'AUTH'
    | 'GEOGRAPHIC'
    | 'ECONOMIC'
    | 'GOVERNANCE'
    | 'SECURITY'
    | 'PERFORMANCE'
    | 'GENERAL'
    | 'PARTICIPATION_RIGHTS'
    | 'VALIDATION'
    | 'DATABASE';
  verificationLevel?: VerificationLevel;
  geographicContext?: GeographicContext;
  economicContext?: EconomicContext;
  economicTier?: string; // Preferred over full economic context (privacy)

  securityEvent?: {
    type: import('./security-event.types.js').SecurityEventType; // Use imported type
    severity: SecurityEventSeverity;
    details: string;
    resource?: string;
  };

  operation?: string;
  duration?: number;

  // User identifiers (userId safe to log, others should be redacted)
  userId?: string;
  email?: string; // ⚠️ PII - Must be redacted
  phoneNumber?: string; // ⚠️ PII - Must be redacted
  walletAddress?: string; // ⚠️ PII - Must be redacted
  recoveredAddress?: string; // ⚠️ PII - Must be redacted
  correlationId?: string;

  roleScopes?: RoleScope[];
  roles?: string[];

  // Network/session (should be redacted/hashed)
  ipAddress?: string; // ⚠️ PII - Must be redacted
  deviceFingerprint?: string;
  sessionId?: string; // Should be hashed

  // Flow tracking
  flowId?: string; // for onboarding flows
  step?: string; // for onboarding steps

  // Additional metadata
  metadata?: Record<string, any>;

  // Log retention
  logRetentionDays?: number;

  // Error context
  error?: any;
}

// ============================================================================
// MIDDLEWARE OPTIONS
// ============================================================================

/**
 * Validation middleware options
 */
export interface UjamaadaoValidationOptions {
  schema: ZodSchema;
  target: 'body' | 'params' | 'query' | 'context';
  verificationLevel?: VerificationLevel;
  validateGeographicContext?: boolean;
  logValidationFailures?: boolean;
  geographicScope?: LocationScope;
  customErrorMessages?: Record<string, string>;
}

/**
 * Authorization middleware options
 *
 * SECURITY: scopeCheck and resourceOwnerCheck now support async operations
 */
export interface UjamaadaoAuthorizeOptions {
  allowedRoles?: string[];
  verificationLevel?: VerificationLevel;
  minImpactPoints?: number;
  minParticipationRights?: number; // Enforce PR threshold

  // Async support for database lookups
  scopeCheck?: boolean | ((req: AuthRequest) => boolean | Promise<boolean>);
  resourceOwnerCheck?:
    | boolean
    | ((req: AuthRequest) => boolean | Promise<boolean>);

  requiresWalletAuth?: boolean;
  skipAdmin?: boolean; // Allow admins to bypass (use carefully)
}

/**
 * Rate limiter options
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skipAdmin?: boolean;
  keyGenerator?: (req: AuthRequest) => string;
  onLimitReached?: (req: AuthRequest) => void;
}

// ============================================================================
// API RESPONSES
// ============================================================================

/**
 * API Error details
 */
export interface ApiErrorDetails {
  [key: string]: any;
  errors?: Record<string, string>;
  required?: any;
  allowed?: any;
  provided?: any;
}

/**
 * Standardized API response
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  details?: ApiErrorDetails;
  correlationId?: string;
  timestamp?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// ============================================================================
// AUTH MODULE SPECIFIC TYPES (Shared across auth flows)
// ============================================================================

/**
 * Magic link authentication result
 */
export interface MagicLinkAuthResult {
  user: any;
  sessionToken: string;
  session: SessionInfo;
  needsProfileCompletion: boolean;
  missingFields?: OnboardingMissingFields;
}

/**
 * Send magic link response
 */
export interface SendMagicLinkResponse {
  newUser: boolean;
  sentVerification?: boolean;
  sentLogin?: boolean;
}

/**
 * User response (safe for client)
 */
export interface UserResponse {
  id: string;
  email?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
  walletAddress?: string | null;
  verificationLevel: VerificationLevel;
  primaryWardId?: string | null;
  secondaryWardId?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  communityVerified: boolean;
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights: number;
  roles?: string[];
}

// ============================================================================
// NOTE: All types are exported individually above
// No default export needed - import types directly:
// import { AuthUser, GeographicContext } from './Ujamaadao.types.js'
// ============================================================================

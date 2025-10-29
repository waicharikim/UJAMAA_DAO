/**
 * @file src/core/types.ts
 * Centralized Type Definitions for the UJAMAADAO Platform
 */

import { Request } from 'express';
import { IncomingHttpHeaders } from 'http';
import { ZodSchema } from 'zod';

// Canonical scopes & verification levels
export type LocationScope = 'WARD'|'CONSTITUENCY'|'COUNTY'|'NATIONAL';
export type VerificationLevel = 'UNVERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULL_VERIFIED';

export interface RoleScope {
  role: string;
  scope?: string;
}

export interface GeographicContext {
  primaryWardId?: string;
  constituencyId?: string;
  countyId?: string;
  locationScope?: LocationScope;
  latitude?: number;
  longitude?: number;
}

export interface EconomicContext {
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights: number;
  economicTier?: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  phoneNumber?: string;
  walletAddress: string;
  primaryWardId?: string;
  secondaryWardId?: string;
  verificationLevel: VerificationLevel;
  emailVerified: boolean;
  phoneVerified: boolean;
  communityVerified: boolean;
  locationVerified: boolean;
  roles: string[];
  globalImpactPoints: number;
  utilityTokens: number;
  participationRights: number;
  profileGeographicContext?: GeographicContext;
}

export interface AuthRequest extends Request {
  originalUrl: any;
  url: any;
  ip: any;
  path: any;
  user?: AuthUser;
  userRoles?: RoleScope[];
  geographicContext?: GeographicContext;
  economicContext?: EconomicContext;
  headers: IncomingHttpHeaders;
}

// Logging types
export interface UjamaadaoLogContext {
  operationType?: 'AUTH' | 'GEOGRAPHIC' | 'ECONOMIC' | 'GOVERNANCE' | 'SECURITY' | 'PERFORMANCE' | 'GENERAL';
  verificationLevel?: VerificationLevel;
  geographicContext?: GeographicContext;
  economicContext?: EconomicContext;
  securityEvent?: {
    type: 'AUTH_FAILURE' | 'GEOGRAPHIC_VIOLATION' | 'ECONOMIC_FRAUD' | 'ROLE_VIOLATION' | 'SYSTEM_ANOMALY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: string;
    resource?: string;
  };
  operation?: string;
  duration?: number;
  userId?: string;
  metadata?: Record<string, any>;
}

// Middleware option types
export interface UjamaadaoValidationOptions {
  schema: ZodSchema;
  target: 'body'|'params'|'query' | 'context';
  verificationLevel?: VerificationLevel;
  validateGeographicContext?: boolean;
  logValidationFailures?: boolean;
  geographicScope?: LocationScope;
  customErrorMessages?: Record<string, string>;
}

export interface UjamaadaoAuthorizeOptions {
  allowedRoles: string[];
  verificationLevel?: VerificationLevel;
  minImpactPoints?: number;
  scopeCheck?: (req: AuthRequest) => boolean;
  resourceOwnerCheck?: (req: AuthRequest) => boolean;
}

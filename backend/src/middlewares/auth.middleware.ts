/**
 * UJAMAADAO Authentication Middleware
 * * Enhanced authentication system for the UJAMAADAO platform that includes:
 * - JWT-based user authentication
 * - Progressive verification status tracking (email → phone → community → location)
 * - Geographic hierarchy context (Ward → Constituency → County → National)
 * - Role-based access control with scope support
 * - Verification level requirements for protected routes
 * * This middleware extends the base authentication with UJAMAADAO-specific
 * business logic for community governance and economic participation.
 */

import type { Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { parseRoleInput } from '../constants/roles.js';
import { prisma } from '../prismaClient.js';
// CRITICAL FIX: Import the centralized verification logic
import { calculateVerificationStatus } from '../services/verification.service.js';
// CRITICAL FIX: Import AuthRequest, AuthUser, GeographicContext, and LocationScope
import type { AuthRequest, AuthUser, GeographicContext, LocationScope, RoleScope } from '../types/ujamaadao.types.js'; // Added RoleScope import

// Environment configuration for JWT security
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// Security requirement: JWT secret must be set in production
if (!JWT_SECRET && NODE_ENV !== 'development') {
  throw new Error('JWT_SECRET environment variable is required in production.');
}

/**
 * Core UJAMAADAO Authentication Middleware
 * Validates the JWT, fetches the user, and attaches `req.user` and `req.userRoles`.
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : undefined;

  if (!token) {
    logger.warn(`Auth Failure: Missing token - ${req.originalUrl ?? req.url}`, { ip: req.ip });
    // Proceed to next middleware (like geographic context) but without user
    return next();
  }

  try {
    // The decoded JWT payload includes the userId and roles array
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload & { userId: string, roles: RoleScope[] };
    const userId = decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        globalImpactPoints: true,
        utilityTokens: true,
        participationRights: true,
        email: true,
        primaryWard: true,
        // Include fields required for verification calculation
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        locationVerified: true,
        expertVerified: true,
        // Include other fields needed for AuthUser mapping
      }
    });

    if (!user) {
      logger.warn('Auth Failure: User not found in DB', { userId });
      return next(new ApiError('Authentication failed: User does not exist.', 401));
    }

    // Calculate verification status
    const verificationStatus = calculateVerificationStatus(user);

    // Map DB user to AuthUser
    req.user = {
      userId: user.id,
      walletAddress: user.walletAddress,
      verificationLevel: verificationStatus.overallLevel as AuthUser['verificationLevel'],
      globalImpactPoints: user.globalImpactPoints,
      utilityTokens: user.utilityTokens,
      participationRights: user.participationRights,
      email: user.email,
      primaryWard: user.primaryWard || undefined,
    } as unknown as AuthUser;

    // Attach parsed roles from JWT (handled more thoroughly by attachUserRoles.middleware if used)
    if (decoded.roles && Array.isArray(decoded.roles)) {
      // parseRoleInput converts raw string/object roles into the canonical RoleScope interface
      req.userRoles = decoded.roles.map(parseRoleInput);
    } else {
      req.userRoles = [];
    }

    logger.debug('Auth Success', { userId });
    next();

  } catch (error) {
    logger.warn(`Auth Failure: Invalid or expired token: ${error instanceof Error ? error.message : String(error)}`);
    next(new ApiError('Invalid or expired authentication token.', 401));
  }
};


// ============================================================================
// UJAMAADAO SECURITY ENHANCEMENT MIDDLEWARES (Should run AFTER authMiddleware)
// ============================================================================

/**
 * Verification hierarchy map for level comparison.
 */
const verificationHierarchy: Record<AuthUser['verificationLevel'], number> = {
  'UNVERIFIED': 0,
  'PHONE_VERIFIED': 1,
  'COMMUNITY_VERIFIED': 2,
  'FULL_VERIFIED': 3,
};

/**
 * UJAMAADAO Verification Level Requirement Middleware
 * Enforces a minimum verification status for accessing a route.
 */
export function requireVerificationLevel(requiredLevel: AuthUser['verificationLevel']) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError('Authentication required to check verification level.', 401));
    }

    const userLevel = req.user?.verificationLevel;

    // Check if user meets minimum verification requirement
    if (!userLevel || verificationHierarchy[userLevel] < verificationHierarchy[requiredLevel]) {
      logger.info('Verification Level Failure', { 
        userId: req.user.userId, 
        requiredLevel, 
        userLevel 
      });
      return next(new ApiError(
        `Insufficient verification level. Required: ${requiredLevel}, Current: ${userLevel}`,
        403
      ));
    }

    next();
  };
}

/**
 * UJAMAADAO Geographic Scope Requirement Middleware
 * Ensures the user's current geographic context meets or exceeds the required scope.
 */
export function requireLocationScope(requiredScope: Exclude<LocationScope, undefined>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Require geographic context (must be populated by geographicContextMiddleware)
    if (!req.geographicContext) {
      return next(new ApiError('Geographic context required for this operation', 403));
    }

    // Geographic scope hierarchy for comparison (higher number = broader scope)
    const scopeHierarchy: Record<Exclude<LocationScope, undefined>, number> = {
      'WARD': 1,
      'CONSTITUENCY': 2,
      'COUNTY': 3,
      'NATIONAL': 4
    };

    const currentScope = req.geographicContext.locationScope;

    /**
     * SINGLE LOCATION PRINCIPLE ENFORCEMENT
     * If locationScope is missing from context (due to failure or no GeoIP/profile data),
     * we default to the lowest privilege scope ('WARD') for security.
     */
    const currentScopeKey: Exclude<LocationScope, undefined> = currentScope ?? 'WARD';
    const currentScopeValue = scopeHierarchy[currentScopeKey];
    const requiredScopeValue = scopeHierarchy[requiredScope];

    if (currentScopeValue < requiredScopeValue) {
      logger.info('Geographic Scope Failure', { 
        userId: req.user?.userId, 
        requiredScope, 
        currentScope: currentScopeKey 
      });
      return next(new ApiError(
        `Insufficient geographic scope. Required: ${requiredScope}, Available: ${currentScopeKey}`,
        403
      ));
    }

    next();
  };
}

/**
 * UJAMAADAO Role-Based Access Control Middleware (Simple Check)
 * Ensures the authenticated user possesses at least one of the required roles.
 * NOTE: This checks the raw role name (e.g., 'admin') and does NOT check geographic scopes.
 * For scoped checks (e.g., 'ward:admin:WA001'), use the comprehensive RBAC middleware.
 */
export function requireAnyRole(requiredRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.userRoles) {
      // Authentication data should be present if authMiddleware ran successfully
      logger.warn('Role Check Failure: Auth user or roles missing', { path: req.path });
      return next(new ApiError('Access denied. Authentication data or roles are missing.', 401));
    }

    // Check if any of the user's raw role names are present in the required list
    const hasRequiredRole = req.userRoles.some(
      (userRole) => requiredRoles.includes(userRole.role)
    );

    if (hasRequiredRole) {
      next();
    } else {
      const requiredList = requiredRoles.join(', ');
      logger.info('Role Check Failure: Forbidden access', {
        userId: req.user.userId,
        required: requiredList,
        userRoles: req.userRoles.map(r => r.role).join(', ')
      });
      return next(new ApiError(
        `Forbidden. Requires one of the following roles: ${requiredList}`,
        403
      ));
    }
  };
}

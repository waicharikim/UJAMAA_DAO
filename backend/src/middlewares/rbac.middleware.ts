/**
 * @file rbac.middleware.ts
 * * @description
 * UJAMAADAO Role-Based Access Control Middleware
 * * Enhanced RBAC system for the UJAMAADAO platform that includes:
 * - Geographic scope validation for location-based governance
 * - Verification level requirements for progressive access control
 * - Economic system role integration (impact points, voting weights)
 * - Community governance permission hierarchies
 * - Comprehensive logging and monitoring
 * * UJAMAADAO SPECIFIC ENHANCEMENTS:\n
 * - Geographic scope validation (ward → constituency → county → national)\n
 * - Verification level requirements (phone → community → location verification)\n
 * - Economic system permissions (impact point thresholds, voting weights)\n
 * - Community governance role hierarchies\n
 * - Location-based resource access control\n
 * * Security Model:\n
 * - Role-based permissions with geographic scoping\n
 * - Progressive verification level requirements\n
 * - Economic participation gates\n
 * - Comprehensive audit logging\n
 * * CRITICAL FIX: Removed duplicated type definitions and now imports
 * canonical types from ujamaadao.types.js.
 */

import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import type { 
  AuthRequest, 
  RoleScope, // CRITICAL FIX: Imported canonical type
  UjamaadaoAuthorizeOptions, // CRITICAL FIX: Imported canonical type
  VerificationLevel 
} from '../types/ujamaadao.types.js'; 
import { getVerificationLevelOrder } from '../services/verification.service.js';

/**
 * UJAMAADAO Enhanced Authorization Middleware Factory
 * * This middleware performs a comprehensive check combining role, geographic,
 * verification, and economic requirements.
 * * @param options - Configuration for authorization requirements.
 * @returns Express Middleware function (req, res, next).
 */
export function authorize(options: UjamaadaoAuthorizeOptions) {
  const {
    allowedRoles,
    verificationLevel: requiredVerificationLevel,
    minImpactPoints = 0,
    scopeCheck, // A custom function to check geographic or resource scope
  } = options;

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Authentication Check
    if (!req.user || !req.user.roles) {
      return next(new ApiError('Access denied. Authentication data is missing.', 401, { code: 'UNAUTHENTICATED' }));
    }

    const { user } = req;
    const userId = user.userId;

    // 2. Role Check
    const hasRequiredRole = allowedRoles.some(
      allowedRole => user.roles.some(userRole => userRole.toLowerCase() === allowedRole.toLowerCase())
    );

    // If '*' is allowed, or role is present, continue.
    if (!hasRequiredRole && allowedRoles.indexOf('*') === -1) {
      logger.warn('UJAMAADAO RBAC: Role check failed', { userId, requiredRoles: allowedRoles.join(',') });
      return next(new ApiError(`Forbidden. Requires one of the following roles: ${allowedRoles.join(', ')}`, 403, { code: 'FORBIDDEN_ROLE' }));
    }

    // 3. Verification Level Check
    if (requiredVerificationLevel) {
      const userLevel = user.verificationLevel;
      const requiredLevel = requiredVerificationLevel;
      const levelOrder = getVerificationLevelOrder();

      if (levelOrder[userLevel] < levelOrder[requiredLevel]) {
        logger.warn('UJAMAADAO RBAC: Verification check failed', { userId, requiredLevel, userLevel });
        return next(new ApiError(`Insufficient verification level. Required: ${requiredLevel}`, 403, { code: 'INSUFFICIENT_VERIFICATION' }));
      }
    }
    
    // 4. Economic Check (Min Impact Points)
    if (user.globalImpactPoints < minImpactPoints) {
      logger.warn('UJAMAADAO RBAC: Impact point check failed', { userId, requiredIP: minImpactPoints, currentIP: user.globalImpactPoints });
      return next(new ApiError(`Insufficient impact points. Minimum ${minImpactPoints} required.`, 403, { code: 'MIN_IP_REQUIREMENT' }));
    }

    // 5. Custom Scope Check (e.g., Geographic or Resource Ownership)
    if (scopeCheck && !scopeCheck(req)) {
      logger.warn('UJAMAADAO RBAC: Custom scope check failed', { userId });
      return next(new ApiError('Forbidden. Access denied due to resource or geographic scope limitations.', 403, { code: 'SCOPE_FORBIDDEN' }));
    }

    // All checks passed
    next();
  };
}

/**
 * UJAMAADAO Geographic Scope Helper
 * * Checks if the user's current geographic context matches the resource's geographic ID
 * at the specified level.
 * * @param geographicLevel The level to check ('ward', 'constituency', 'county').
 * @param resourceGeographicIdPath The property path on the request object (e.g., 'params.wardId').
 * @returns A scope check function for the authorize middleware.
 */
export function createGeographicScopeCheck(
  geographicLevel: 'ward' | 'constituency' | 'county',
  resourceGeographicIdPath: string
) {
  return (req: AuthRequest): boolean => {
    // 1. Extract resource ID from the request
    const pathParts = resourceGeographicIdPath.split('.');
    let resourceGeographicId: string | undefined;

    try {
      let value: any = req;
      for (const part of pathParts) {
        value = value[part];
        if (value === undefined) throw new Error('Path not found');
      }
      resourceGeographicId = value;
    } catch (e) {
      logger.warn('UJAMAADAO RBAC: Geographic ID extraction failed', { 
        path: resourceGeographicIdPath, 
        error: e 
      });
      return false;
    }

    if (!resourceGeographicId) return false;

    // 2. Compare resource ID with user's geographic context
    if (!req.geographicContext) return false;

    switch (geographicLevel) {
      case 'ward':
        return req.geographicContext.primaryWardId === resourceGeographicId;
      case 'constituency':
        return req.geographicContext.constituencyId === resourceGeographicId;
      case 'county':
        return req.geographicContext.countyId === resourceGeographicId;
      default:
        return false;
    }
  };
}

/**
 * UJAMAADAO Resource Ownership Helper
 * * Checks if the authenticated user is the owner of the resource being accessed.
 * * @param resourceOwnerIdPath The property path on the request object that holds the resource's owner ID (e.g., 'body.ownerId').
 * @returns A scope check function for the authorize middleware.
 */
export function createResourceOwnerCheck(resourceOwnerIdPath: string) {
  return (req: AuthRequest): boolean => {
    try {
      // Navigate to the resource owner ID using the provided path
      const pathParts = resourceOwnerIdPath.split('.');
      let value: any = req;
      for (const part of pathParts) {
        value = value[part];
        if (value === undefined) return false;
      }
      
      // Compare with authenticated user ID
      return value === req.user?.userId;
    } catch (error) {
      logger.error('UJAMAADAO RBAC: Resource ownership check failed', {
        error,
        path: resourceOwnerIdPath,
        userId: req.user?.userId
      });
      return false;
    }
  };
}

/**
 * Backward Compatibility Wrapper
 * * Allows older code to use the simpler signature while still running through the enhanced middleware.
 * * @deprecated Use authorize with options object for UJAMAADAO features
 * @param allowedRoles - Array of roles allowed
 * @param scopeCheck - Optional custom scope check function
 */
export function authorizeLegacy(
  allowedRoles: string[],
  scopeCheck?: (req: AuthRequest) => boolean
) {
  return authorize({
    allowedRoles,
    scopeCheck
  });
}

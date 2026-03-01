/**
 * @file src/core/rbac/authorize.ts
 * @description
 * Layer 3: Fast RBAC Permission Checks (in-memory role checks)
 *
 * These are check functions that throw ApiError on failure.
 * Use directly in routes or wrap with toMiddleware() for Express middleware.
 *
 * Performance: ~0.1ms (array lookups only, no database)
 *
 * Version: 2.1 — January 2026
 */

import { Request, RequestHandler, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/Ujamaadao.types.js';
import { ApiError } from '../errors/ApiError.js';
import { createRequestLogger, logSecurityEvent } from '../logger/logger.js';
import { SystemRoles } from './roles.js';

type Scope = string | null;

// Input validation
const isValidRole = (role: string): boolean => /^[a-zA-Z_]{2,50}$/i.test(role);
const isValidScope = (scope: string): boolean =>
  /^[a-z]{2,20}(:[0-9a-f-]{8,36})?$/i.test(scope);

/**
 * Log authorization check for audit trail
 */
const logAuthCheck = (
  req: AuthRequest,
  checkType: string,
  required: string,
  granted: boolean
): void => {
  const severity = granted ? 'LOW' : 'MEDIUM';
  const event = granted ? 'AUTH_SUCCESS' : 'ROLE_VIOLATION';

  logSecurityEvent(
    `RBAC check: ${checkType}`,
    event,
    severity,
    `Required: ${required}, Result: ${granted ? 'GRANTED' : 'DENIED'}`,
    {
      userId: req.user?.userId,
      ipAddress: req.ip,
      metadata: {
        checkType,
        required,
        granted,
        userRoles: req.user?.roles || [],
        path: req.path,
        correlationId: req.correlationId,
      },
    }
  );
};

/**
 * Core role matcher - checks if user has role (with optional scope)
 */
const hasRole = (
  userRoles: string[] = [],
  role: string,
  scope?: Scope
): boolean => {
  if (!isValidRole(role)) return false;
  if (scope && !isValidScope(scope)) return false;

  return userRoles.some((r) => {
    if (scope) {
      return r === `${scope}:${role}` || r === role;
    }
    return r === role;
  });
};

/**
 * Check if user is super admin (bypasses all other checks)
 */
const isSuperAdmin = (req: AuthRequest): boolean => {
  const isSuper = req.user?.roles?.includes(SystemRoles.SUPER_ADMIN) || false;
  if (isSuper) {
    createRequestLogger(req).info(
      { operationType: 'SECURITY', metadata: { bypass: 'super_admin' } },
      'Super admin access granted'
    );
  }
  return isSuper;
};

// ==========================================================================
// CHECK FUNCTIONS (throw ApiError on failure)
// ==========================================================================

/**
 * Require system-level role (e.g., ADMIN, MODERATOR)
 */
const requireSystemRole =
  (role: string) =>
  (req: AuthRequest): void => {
    if (!isValidRole(role)) throw ApiError.badRequest('Invalid role format');

    if (isSuperAdmin(req)) {
      logAuthCheck(req, 'system_role', role, true);
      return;
    }

    const granted = hasRole(req.user?.roles, role);
    logAuthCheck(req, 'system_role', role, granted);

    if (!granted) {
      throw ApiError.insufficientPermissions(
        'Insufficient system permissions',
        [role],
        req.correlationId
      );
    }
  };

/**
 * Require group role with scope (e.g., ward:abc123:LEADER)
 */
const requireGroupRole =
  (role: string, scopePrefix: string) =>
  (req: AuthRequest): void => {
    if (!isValidRole(role) || !isValidScope(scopePrefix)) {
      throw ApiError.badRequest('Invalid role or scope format');
    }

    if (isSuperAdmin(req)) {
      logAuthCheck(req, 'group_role', `${scopePrefix}:${role}`, true);
      return;
    }

    const granted =
      hasRole(req.user?.roles, role, scopePrefix) ||
      hasRole(req.user?.roles, `${scopePrefix}:${role}`);
    logAuthCheck(req, 'group_role', `${scopePrefix}:${role}`, granted);

    if (!granted) {
      throw ApiError.insufficientPermissions(
        'Insufficient group permissions',
        [role],
        req.correlationId
      );
    }
  };

/**
 * Require ownership OR admin role
 * Useful for "edit your own profile OR be admin" patterns
 */
const requireOwnershipOrAdmin =
  (resourceUserId: string, adminRole = 'ADMIN') =>
  (req: AuthRequest): void => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.systemError(
        'Missing user context in ownership check',
        undefined,
        req.correlationId
      );
    }

    if (isSuperAdmin(req)) {
      logAuthCheck(req, 'ownership_or_admin', 'super_admin', true);
      return;
    }

    const isOwner = userId === resourceUserId;
    const isAdmin = hasRole(req.user?.roles, adminRole);

    const granted = isOwner || isAdmin;
    logAuthCheck(
      req,
      'ownership_or_admin',
      `owner:${resourceUserId} OR ${adminRole}`,
      granted
    );

    if (!granted) {
      throw ApiError.insufficientPermissions(
        'Not owner or authorized role',
        undefined,
        req.correlationId
      );
    }
  };

// ==========================================================================
// CONVENIENCE SHORTCUTS (match guide examples)
// ==========================================================================

export const requireSuperAdmin = () => requireSystemRole(SystemRoles.SUPER_ADMIN);
export const requireAdmin = () => requireSystemRole(SystemRoles.SUPER_ADMIN);

export const requireWardLeader = (
  wardId: string
): ((req: AuthRequest) => void) => {
  if (!/^[0-9a-f-]{36}$/i.test(wardId)) {
    throw new Error('Invalid ward ID format');
  }
  return requireGroupRole('LEADER', `ward:${wardId}`);
};

export const requireTreasurer = (scope: string) =>
  requireGroupRole('TREASURER', scope);

export const requireVerifier = (scope?: string) =>
  scope ? requireGroupRole('VERIFIER', scope) : requireSystemRole('VERIFIER');

export const requireModerator = (scope: string) =>
  requireGroupRole('MODERATOR', scope);

// ==========================================================================
// MIDDLEWARE WRAPPER — Convert checks to Express middleware
// ==========================================================================

/**
 * Convert a check function to Express middleware
 *
 * @example
 * router.post('/admin', authenticate, toMiddleware(requireAdmin()), handler)
 */
export const toMiddleware = (
  check: (req: AuthRequest) => void
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    try {
      check(authReq);
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error.toJSON());
      } else {
        const apiError = ApiError.systemError(
          'RBAC check failed',
          undefined,
          authReq.correlationId
        );
        res.status(500).json(apiError.toJSON());
      }
    }
  };
};

// ==========================================================================
// UTILITY FUNCTIONS (for use in handlers)
// ==========================================================================

/**
 * Check if user has ANY of the specified roles
 *
 * @example
 * if (hasAnyRole(req, ['ADMIN', 'MODERATOR'])) {
 *   // User is admin or moderator
 * }
 */
export const hasAnyRole = (req: AuthRequest, roles: string[]): boolean => {
  if (isSuperAdmin(req)) return true;
  return roles.some(
    (role) => isValidRole(role) && hasRole(req.user?.roles, role)
  );
};

/**
 * Check if user has ALL of the specified roles
 *
 * @example
 * if (hasAllRoles(req, ['VERIFIER', 'MODERATOR'])) {
 *   // User has both verifier AND moderator
 * }
 */
export const hasAllRoles = (req: AuthRequest, roles: string[]): boolean => {
  if (isSuperAdmin(req)) return true;
  return roles.every(
    (role) => isValidRole(role) && hasRole(req.user?.roles, role)
  );
};

/**
 * Get user's effective roles (returns ['*'] for super admin)
 *
 * @example
 * const roles = getEffectiveRoles(req);
 * console.log('User roles:', roles);
 */
export const getEffectiveRoles = (req: AuthRequest): string[] => {
  return isSuperAdmin(req) ? ['*'] : req.user?.roles || [];
};

/**
 * Check if user has a specific role (without throwing)
 *
 * @example
 * if (userHasRole(req, 'ADMIN')) {
 *   // Show admin UI
 * }
 */
export const userHasRole = (
  req: AuthRequest,
  role: string,
  scope?: string
): boolean => {
  if (isSuperAdmin(req)) return true;
  if (!isValidRole(role)) return false;
  return hasRole(req.user?.roles, role, scope || undefined);
};

/**
 * Check if user is owner of a resource (simple ID comparison)
 * For database-backed ownership checks, use rbac/integration helpers
 *
 * @example
 * if (isOwner(req, post.authorId)) {
 *   // User owns this post
 * }
 */
export const isOwner = (req: AuthRequest, resourceOwnerId: string): boolean => {
  return req.user?.userId === resourceOwnerId;
};

// ==========================================================================
// EXPORTS
// ==========================================================================

export default {
  // Core checks (throw on failure)
  requireSystemRole,
  requireGroupRole,
  requireOwnershipOrAdmin,

  // Shortcuts
  requireSuperAdmin,
  requireAdmin,
  requireWardLeader,
  requireTreasurer,
  requireVerifier,
  requireModerator,

  // Middleware wrapper
  toMiddleware,

  // Utility functions (return boolean)
  hasAnyRole,
  hasAllRoles,
  getEffectiveRoles,
  userHasRole,
  isOwner,
};

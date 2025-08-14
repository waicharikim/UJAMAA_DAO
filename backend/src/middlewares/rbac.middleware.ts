/**
 * @file rbac.middleware.ts
 *
 * @description
 * Middleware for role-based access control.
 * - Checks if the user has at least one of the allowed roles.
 * - Optional scopeCheck function for additional scoped permission validation.
 */

import { Request, Response, NextFunction } from 'express';

interface RoleScope {
  role: string;
  scope?: string;
}

/**
 * Returns middleware that authorizes requests based on allowed roles and optional scope validations.
 *
 * @param allowedRoles Array of roles allowed to access the endpoint (case-insensitive).
 * @param scopeCheck Optional function to perform additional scope-specific permission checks,
 *                   receives the request object and returns boolean.
 * @returns Express middleware function.
 */
export function authorize(
  allowedRoles: string[],
  scopeCheck?: (req: Request) => boolean
) {
  const allowedRolesLower = allowedRoles.map(r => r.toLowerCase());

  return (req: Request, res: Response, next: NextFunction): void => {
    const userRoles: RoleScope[] = req.userRoles ?? [];

    // Normalize roles to lowercase for case-insensitive comparison
    const userRolesLower = userRoles.map(({ role, scope }) => ({
      role: role.toLowerCase(),
      scope,
    }));

    // Check if user has any of the allowed roles
    const hasAllowedRole = userRolesLower.some(({ role }) =>
      allowedRolesLower.includes(role)
    );

    if (!hasAllowedRole) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    // If a scope check is provided, validate it
    if (scopeCheck && !scopeCheck(req)) {
      return res.status(403).json({ error: 'Forbidden: insufficient scope permissions' });
    }
/**
 * @file rbac.middleware.ts
 * @description
 * Role-based access control middleware.
 *
 * Usage:
 *   router.get('/admin', authorize(['system:super_admin']), handler);
 *
 * Notes:
 * - Uses AuthRequest so req.user and req.userRoles are typed.
 * - Uses ApiError to forward authorization errors to central error handler.
 * - allowedRoles supports case-insensitive matching; '*' allows any authenticated user.
 */

import type { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import type { AuthRequest } from './auth.middleware.js';

interface RoleScope {
  role: string;
  scope?: string;
}

/**
 * authorize
 * @param allowedRoles Array of allowed role strings (case-insensitive). Example: ['group:admin', 'system:super_admin']
 *                     Special value '*' means "any authenticated user".
 * @param scopeCheck Optional function to run additional scoped checks (receives AuthRequest and should return boolean).
 */
export function authorize(
  allowedRoles: string[],
  scopeCheck?: (req: AuthRequest) => boolean
) {
  const allowedLower = allowedRoles.map(r => String(r).toLowerCase());

  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;

    // If the route requires auth roles but there's no authenticated user, reject early
    if (!authReq.user) {
      logger.warn('authorize: unauthenticated request blocked', { path: req.path, method: req.method });
      return next(new ApiError('Unauthorized', 401));
    }

    // Grab user roles from req (populated by attachUserRoles middleware or by auth token)
    const userRolesRaw = authReq.userRoles ?? [];
    const userRoles: RoleScope[] = userRolesRaw.map((r: any) => ({
      role: String(r.role ?? r).toLowerCase(),
      scope: r.scope ?? undefined,
    }));

    // If allowedRoles contains '*', any authenticated user is allowed
    if (allowedLower.includes('*')) {
      // Optional scope check still applies
      if (scopeCheck && !scopeCheck(authReq)) {
        logger.warn('authorize: scope check failed', { path: req.path, method: req.method, userId: authReq.user?.userId });
        return next(new ApiError('Forbidden: insufficient scope permissions', 403));
      }
      return next();
    }

    // Check for any matching role
    const hasAllowedRole = userRoles.some(ur => allowedLower.includes(ur.role));

    if (!hasAllowedRole) {
      logger.warn('authorize: insufficient role', {
        path: req.path,
        method: req.method,
        userId: authReq.user?.userId,
        required: allowedLower,
        userRoles: userRoles.map(r => r.role),
      });
      return next(new ApiError('Forbidden: insufficient permissions', 403));
    }

    // If a scope check function is provided, enforce it
    if (scopeCheck && !scopeCheck(authReq)) {
      logger.warn('authorize: scope check failed', { path: req.path, method: req.method, userId: authReq.user?.userId });
      return next(new ApiError('Forbidden: insufficient scope permissions', 403));
    }

    // All good
    return next();
  };
}
    next();
  };
}
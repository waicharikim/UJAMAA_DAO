/**
 * rbac.middleware.ts
 *
 * Role-based access control middleware.
 * - Case-insensitive role matching.
 * - Supports wildcard '*' to allow any authenticated user.
 * - Optional scopeCheck for per-request scoping logic.
 * - Uses AuthRequest so req.user and req.userRoles are typed.
 * - Emits ApiError for central error handling.
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

    // Require authenticated user for any role-protected route
    if (!authReq.user) {
      logger.warn('authorize: unauthenticated request blocked', { path: req.path, method: req.method });
      return next(new ApiError('Unauthorized', 401));
    }

    // Normalize user roles coming from req.userRoles which may be strings or objects
    const userRolesRaw = authReq.userRoles ?? [];
    const userRoles: RoleScope[] = (userRolesRaw as any[]).map((r: any) => ({
      role: String(r?.role ?? r).toLowerCase(),
      scope: r?.scope ?? undefined,
    }));

    // If '*' is allowed, any authenticated user is permitted (scopeCheck still applies)
    if (allowedLower.includes('*')) {
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

    return next();
  };
}
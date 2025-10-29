/**
 * @file authorize.ts
 *
 * @description
 * Express middleware for Role-Based Access Control (RBAC).
 * Checks if the authenticated user (req.user) has any of the required roles.
 *
 * CRITICAL FIX: Removed duplicated type definitions and now imports
 * canonical types from ujamaadao.types.js.
 */

import { Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
// CRITICAL FIX: Import canonical types from the centralized definition
import type { AuthRequest } from '../types/ujamaadao.types.js'; 


/**
 * Middleware function to check if the authenticated user has any of the required roles.
 * * @param requiredRoles An array of role strings that are allowed to access the route.
 * @returns Express Middleware function (req, res, next).
 */
export const authorize = (requiredRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Ensure authentication has run (and user is attached)
    // AuthRequest guarantees req.user, but we check for roles existence
    if (!req.user || !req.user.roles) {
      // If req.user is missing, the 'authenticate' middleware should have already thrown 401.
      // This is a safety check.
      return next(new ApiError('Access denied. Authentication data is missing.', 401, { code: 'UNAUTHENTICATED' }));
    }

    // 2. Check for required roles
    // The user's roles array must include at least one of the requiredRoles
    const hasRequiredRole = requiredRoles.some(role => req.user!.roles.includes(role));

    if (hasRequiredRole) {
      // User has the necessary role, proceed to the next handler/middleware
      next();
    } else {
      // User is authenticated but does not have the required role/permission
      const requiredList = requiredRoles.join(', ');
      return next(new ApiError(`Forbidden. Requires one of the following roles: ${requiredList}`, 403, { code: 'FORBIDDEN_ROLE' }));
    }
  };
};

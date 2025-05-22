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

    next();
  };
}
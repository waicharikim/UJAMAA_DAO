/**
 * @file src/core/rbac/integration.ts
 * @description
 * Integration helpers - bridge RBAC checks with RoleService database queries
 * 
 * These helpers enable database-backed permission checks in the authorize() middleware.
 * Use these when you need to check resource ownership or complex role relationships.
 * 
 * Performance: Results are cached by roleService (1-minute TTL)
 * 
 * Version: 2.0 — January 2026
 */

import { AuthRequest } from "../types/Ujamaadao.types.js";
import { roleService } from "../services/role.service.js";
import { logger } from "../logger/logger.js";

/**
 * Check if user is the owner of a project
 * 
 * @param projectIdParam - Name of route param containing project ID (default: 'projectId')
 * @returns Async function for use in authorize middleware
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: isProjectOwner()
 * })
 */
export const isProjectOwner = (projectIdParam: string = 'projectId') => {
  return async (req: AuthRequest): Promise<boolean> => {
    const projectId = req.params[projectIdParam];
    const userId = req.user?.userId;
    
    if (!userId) {
      logger.debug(
        { operationType: 'AUTHORIZATION', metadata: { reason: 'No user' } },
        'Project ownership check failed - no user'
      );
      return false;
    }
    
    if (!projectId) {
      logger.warn(
        { 
          operationType: 'AUTHORIZATION', 
          userId,
          metadata: { projectIdParam, reason: 'Missing project ID' } 
        },
        'Project ownership check failed - no project ID'
      );
      return false;
    }
    
    try {
      return await roleService.isProjectLeader(userId, projectId);
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            projectId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Project ownership check failed'
      );
      return false; // Fail closed on error
    }
  };
};

/**
 * Check if user has a specific role in a group
 * 
 * @param role - Role to check (e.g., 'ADMIN', 'MEMBER')
 * @param groupIdParam - Name of route param containing group ID (default: 'groupId')
 * @returns Async function for use in authorize middleware
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: hasGroupRole('ADMIN')
 * })
 */
export const hasGroupRole = (role: string, groupIdParam: string = 'groupId') => {
  return async (req: AuthRequest): Promise<boolean> => {
    const groupId = req.params[groupIdParam];
    const userId = req.user?.userId;
    
    if (!userId || !groupId) {
      logger.debug(
        { 
          operationType: 'AUTHORIZATION',
          userId,
          metadata: { role, groupId, reason: 'Missing user or group ID' } 
        },
        'Group role check failed'
      );
      return false;
    }
    
    try {
      return await roleService.hasGroupRole(userId, groupId, role);
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            role,
            groupId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Group role check failed'
      );
      return false;
    }
  };
};

/**
 * Check if user has a location-based role (ward admin, etc.)
 * 
 * @param role - Role to check (e.g., 'ADMIN', 'LEADER')
 * @param wardIdParam - Name of route param containing ward ID (default: 'wardId')
 * @returns Async function for use in authorize middleware
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: hasLocationRole('LEADER')
 * })
 */
export const hasLocationRole = (role: string, wardIdParam: string = 'wardId') => {
  return async (req: AuthRequest): Promise<boolean> => {
    const wardId = req.params[wardIdParam];
    const userId = req.user?.userId;
    
    if (!userId || !wardId) {
      logger.debug(
        { 
          operationType: 'AUTHORIZATION',
          userId,
          metadata: { role, wardId, reason: 'Missing user or ward ID' } 
        },
        'Location role check failed'
      );
      return false;
    }
    
    try {
      return await roleService.hasLocationRole(userId, wardId, role);
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            role,
            wardId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Location role check failed'
      );
      return false;
    }
  };
};

/**
 * Check if user is a verifier (global or location-specific)
 * 
 * @param wardIdParam - Optional: name of route param for ward-specific check
 * @returns Async function for use in authorize middleware
 * 
 * @example
 * // Global verifier
 * authorize({
 *   resourceOwnerCheck: isVerifier()
 * })
 * 
 * // Ward-specific verifier
 * authorize({
 *   resourceOwnerCheck: isVerifier('wardId')
 * })
 */
export const isVerifier = (wardIdParam?: string) => {
  return async (req: AuthRequest): Promise<boolean> => {
    const userId = req.user?.userId;
    
    if (!userId) {
      return false;
    }
    
    const wardId = wardIdParam ? req.params[wardIdParam] : undefined;
    
    try {
      return await roleService.isVerifier(userId, wardId);
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            wardId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Verifier check failed'
      );
      return false;
    }
  };
};

/**
 * Check if user has ANY of the listed roles in a group
 * 
 * @param roles - Array of roles to check
 * @param groupIdParam - Name of route param containing group ID
 * @returns Async function for use in authorize middleware
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: hasAnyGroupRole(['ADMIN', 'MODERATOR', 'LEADER'])
 * })
 */
export const hasAnyGroupRole = (roles: string[], groupIdParam: string = 'groupId') => {
  return async (req: AuthRequest): Promise<boolean> => {
    const groupId = req.params[groupIdParam];
    const userId = req.user?.userId;
    
    if (!userId || !groupId) {
      return false;
    }
    
    try {
      // Check each role until we find one that matches
      for (const role of roles) {
        const hasRole = await roleService.hasGroupRole(userId, groupId, role);
        if (hasRole) {
          logger.debug(
            {
              operationType: 'AUTHORIZATION',
              userId,
              metadata: { matchedRole: role, groupId },
            },
            'User has required group role'
          );
          return true;
        }
      }
      
      logger.debug(
        {
          operationType: 'AUTHORIZATION',
          userId,
          metadata: { requiredRoles: roles, groupId },
        },
        'User does not have any required group roles'
      );
      return false;
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            roles,
            groupId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Any group role check failed'
      );
      return false;
    }
  };
};

/**
 * Check if user has ALL of the listed roles in a group
 * 
 * @param roles - Array of roles to check
 * @param groupIdParam - Name of route param containing group ID
 * @returns Async function for use in authorize middleware
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: hasAllGroupRoles(['MEMBER', 'VERIFIED'])
 * })
 */
export const hasAllGroupRoles = (roles: string[], groupIdParam: string = 'groupId') => {
  return async (req: AuthRequest): Promise<boolean> => {
    const groupId = req.params[groupIdParam];
    const userId = req.user?.userId;
    
    if (!userId || !groupId) {
      return false;
    }
    
    try {
      // Must have ALL roles
      for (const role of roles) {
        const hasRole = await roleService.hasGroupRole(userId, groupId, role);
        if (!hasRole) {
          logger.debug(
            {
              operationType: 'AUTHORIZATION',
              userId,
              metadata: { missingRole: role, groupId },
            },
            'User missing required group role'
          );
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            roles,
            groupId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'All group roles check failed'
      );
      return false;
    }
  };
};

/**
 * Combine multiple ownership checks (OR logic)
 * 
 * @param checks - Array of check functions
 * @returns Async function that returns true if ANY check passes
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: anyOf([
 *     isProjectOwner(),
 *     hasGroupRole('ADMIN'),
 *     isVerifier()
 *   ])
 * })
 */
export const anyOf = (checks: Array<(req: AuthRequest) => Promise<boolean>>) => {
  return async (req: AuthRequest): Promise<boolean> => {
    // Try each check - return true on first success
    for (const check of checks) {
      try {
        const result = await check(req);
        if (result) {
          logger.debug(
            {
              operationType: 'AUTHORIZATION',
              userId: req.user?.userId,
              metadata: { checksPassed: 1 },
            },
            'anyOf check passed'
          );
          return true;
        }
      } catch (error) {
        logger.warn(
          {
            operationType: 'AUTHORIZATION',
            userId: req.user?.userId,
            metadata: {
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'One of the anyOf checks threw error - continuing to next check'
        );
        // Continue to next check on error
      }
    }
    
    logger.debug(
      {
        operationType: 'AUTHORIZATION',
        userId: req.user?.userId,
        metadata: { totalChecks: checks.length },
      },
      'anyOf check failed - no checks passed'
    );
    return false;
  };
};

/**
 * Combine multiple ownership checks (AND logic)
 * 
 * @param checks - Array of check functions
 * @returns Async function that returns true only if ALL checks pass
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: allOf([
 *     isProjectOwner(),
 *     isVerifier('wardId')
 *   ])
 * })
 */
export const allOf = (checks: Array<(req: AuthRequest) => Promise<boolean>>) => {
  return async (req: AuthRequest): Promise<boolean> => {
    // All checks must pass
    for (const check of checks) {
      try {
        const result = await check(req);
        if (!result) {
          logger.debug(
            {
              operationType: 'AUTHORIZATION',
              userId: req.user?.userId,
            },
            'allOf check failed - one check returned false'
          );
          return false;
        }
      } catch (error) {
        logger.error(
          {
            operationType: 'AUTHORIZATION',
            userId: req.user?.userId,
            metadata: {
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'allOf check failed - one check threw error'
        );
        return false; // Fail closed on error
      }
    }
    
    logger.debug(
      {
        operationType: 'AUTHORIZATION',
        userId: req.user?.userId,
        metadata: { totalChecks: checks.length },
      },
      'allOf check passed - all checks succeeded'
    );
    return true;
  };
};

/**
 * Negate a check (NOT logic)
 * 
 * @param check - Check function to negate
 * @returns Async function that returns opposite of check result
 * 
 * @example
 * authorize({
 *   resourceOwnerCheck: not(isProjectOwner()) // Must NOT be owner
 * })
 */
export const not = (check: (req: AuthRequest) => Promise<boolean>) => {
  return async (req: AuthRequest): Promise<boolean> => {
    try {
      const result = await check(req);
      return !result;
    } catch (error) {
      logger.error(
        {
          operationType: 'AUTHORIZATION',
          userId: req.user?.userId,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'not() check failed due to error'
      );
      return false; // Fail closed on error
    }
  };
};

export default {
  isProjectOwner,
  hasGroupRole,
  hasLocationRole,
  isVerifier,
  hasAnyGroupRole,
  hasAllGroupRoles,
  anyOf,
  allOf,
  not,
};
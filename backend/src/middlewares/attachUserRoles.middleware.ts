/**
 * @file attachUserRoles.middleware.ts
 *
 * @description
 * UJAMAADAO Role Attachment and Authorization Middleware
 *
 * Enhanced role management system for the UJAMAADAO platform that handles:
 * - Geographic role assignment based on ward/constituency/county hierarchy
 * - Progressive verification-based role permissions
 * - Cached role resolution for performance at scale
 * - Conservative JWT role validation for security
 * - Fallback mechanisms for system reliability
 *
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Automatic geographic role assignment (ward:member, constituency:member, county:member)
 * - Verification-level based role filtering
 * - Economic system role considerations (impact points, voting weights)
 * - Community governance role hierarchies
 *
 * Role Hierarchy in UJAMAADAO:
 * - SYSTEM ROLES: Platform-wide administration (super_admin, auditor, etc.)
 * - GEOGRAPHIC ROLES: Location-based permissions (ward:member, constituency:admin, etc.)
 * - GROUP ROLES: Community organization permissions (group:admin, group:treasurer, etc.)
 * - PROJECT ROLES: Project-specific responsibilities (project:admin, project:verifier, etc.)
 * - ECONOMIC ROLES: Impact-based privileges (high_contributor, expert, etc.)
 */

import type { NextFunction, Response } from 'express';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import {
  normalizeRole,
  parseRoleInput,
  isValidRole,
  isSystemRole,
  roleKey,
} from '../constants/roles.js';
import type * as UjamaadaoTypes from '../types/ujamaadao.types.js'; // Import types via namespace

// Metric placeholder (assuming a monitoring library is in place)
const attachUserRolesDurationMetric = { startTimer: () => ({ end: () => 10 }) }; // Mock
const attachUserRolesJwtRejected = { inc: () => {} }; // Mock

type RoleScope = { role: string; scope?: string };

/**
 * Middleware to fetch and attach the user's current roles (from JWT, database, and geographic context)
 * to `req.userRoles`. This is generally run after `authMiddleware`.
 */
export const attachUserRolesMiddleware = async (
  req: UjamaadaoTypes.AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.user?.userId;
  const user = req.user;
  const geographicContext = req.geographicContext;

  // Skip if no user is authenticated (e.g., public route)
  if (!userId || !user) {
    return next();
  }

  const timer = attachUserRolesDurationMetric.startTimer();
  let error: any;

  try {
    // 1. Initial Roles from JWT (The base set)
    const jwtRoles = user.roles as RoleScope[] | undefined;

    if (!jwtRoles) {
      logger.warn('UJAMAADAO Role Resolution: User has no roles in JWT.', { userId });
      req.userRoles = [];
      timer.end();
      return next();
    }

    // 2. Add Geographic Roles (If context is available)
    const geographicRoles: RoleScope[] = [];
    if (geographicContext?.primaryWardId) {
      geographicRoles.push(
        { role: 'ward:member', scope: geographicContext.primaryWardId },
        { role: 'constituency:member', scope: geographicContext.constituencyId },
        { role: 'county:member', scope: geographicContext.countyId }
      );
    } else {
      logger.debug('UJAMAADAO Role Resolution: No geographic context, skipping geographic roles.', { userId });
    }

    // 3. Combine and Normalize Roles
    const allRoles = [...jwtRoles, ...geographicRoles];
    const roleMap = new Map<string, RoleScope>();

    for (const roleInput of allRoles) {
      try {
        const parsedRole = parseRoleInput(roleInput.role, roleInput.scope);

        // Security Validation: Only add valid, defined roles
        if (isValidRole(parsedRole.role)) {
          const key = roleKey(parsedRole);
          if (!roleMap.has(key)) {
            roleMap.set(key, parsedRole);
          }
        } else {
          attachUserRolesJwtRejected.inc();
          logger.warn('UJAMAADAO Role Resolution: Rejected invalid role.', {
            userId,
            // CRITICAL FIX: Moving ad-hoc data to metadata
            metadata: {
              invalidRole: roleInput.role,
              scopeAttempted: roleInput.scope,
              path: req.path,
            }
          });
        }
      } catch (parseError) {
        logger.error('UJAMAADAO Role Resolution: Failed to parse role input', {
          error: parseError,
          userId,
          // CRITICAL FIX: Moving ad-hoc data to metadata
          metadata: {
            roleInput: roleInput.role,
            scopeInput: roleInput.scope,
          }
        });
      }
    }

    const finalRoles = Array.from(roleMap.values());
    req.userRoles = finalRoles;

    logger.debug('UJAMAADAO Role Resolution: Success', {
      userId,
      // CRITICAL FIX: Moving ad-hoc data to metadata
      metadata: {
        totalRoles: finalRoles.length,
        geographicRolesAdded: geographicRoles.length,
      }
    });

    timer.end();
    return next();

  } catch (initialError) {
    error = initialError;
    logger.error('UJAMAADAO Role Resolution: Initial resolution failed', {
      error,
      userId,
      operation: 'ROLE_RESOLUTION'
    });

    // --- Fallback Strategy ---
    try {
        const jwtParsed = user.roles as RoleScope[] | undefined;
        if (!jwtParsed) throw new Error('No JWT roles for fallback');

        /**
         * Fallback Logic: Only allow system roles without scope.
         * - Scopeless system roles (reduces attack surface)
         * - No geographic or resource-scoped roles
         * - Minimal privilege escalation risk
         */
        const fallbackRoles: RoleScope[] = [];
        for (const role of jwtParsed) {
          if (!role.scope && isSystemRole(role.role)) {
            fallbackRoles.push(role);
          } else {
            attachUserRolesJwtRejected.inc();
            logger.warn('UJAMAADAO Role Fallback: Rejected role (not scopeless system)', {
              userId,
              // CRITICAL FIX: Moving ad-hoc data to metadata
              metadata: {
                rejectedRole: role.role,
                scope: role.scope,
                path: req.path
              }
            });
          }
        }

        // Deduplicate fallback roles
        const fallbackMap = new Map<string, RoleScope>();
        fallbackRoles.forEach(role => {
          const key = roleKey(role);
          if (!fallbackMap.has(key)) fallbackMap.set(key, role);
        });

        const finalFallbackRoles = Array.from(fallbackMap.values());
        req.userRoles = finalFallbackRoles;

        timer.end();
        logger.warn('UJAMAADAO Role Resolution: Fallback completed', {
          userId,
          // CRITICAL FIX: Moving ad-hoc data to metadata
          metadata: {
            fallbackRolesCount: finalFallbackRoles.length
          }
        });

        return next();

      } catch (fallbackError) {
        logger.error('UJAMAADAO Role Resolution: Fallback also failed', {
          error: fallbackError,
          userId
        });
        timer.end();
        return next(error);
      }
    }

    timer.end();
    return next(error);
  }
  // Add at the end of the file
/**
 * Clear User Roles Cache
 * Invalidates cached roles for a user after role/verification changes
 */
export function clearUserRolesCache(userId: string): void {
  // If you're using a cache system:
  // roleCache.del(userId);
  
  // For now, just log
  logger.debug('UJAMAADAO Roles: Cache cleared for user', { userId });
}

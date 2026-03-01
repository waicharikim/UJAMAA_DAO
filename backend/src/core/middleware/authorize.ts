/**
 * @file src/core/middleware/authorize.ts
 * @description
 * Layer 2: Platform Authorization Middleware — v2.1
 *
 * Enforces:
 * - Roles (with wildcard support)
 * - Verification level
 * - Impact Points / Participation Rights thresholds
 * - Wallet authentication
 * - Custom async scope/ownership checks
 * - Optional admin bypass
 *
 * Version: 2.1 — January 2026
 * Security Hardened: January 2026
 */

import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  AuthRequest,
  UjamaadaoAuthorizeOptions,
} from '../types/Ujamaadao.types.js';
import { ApiError } from '../errors/ApiError.js';
import { createRequestLogger, logSecurityEvent } from '../logger/logger.js';
import { SystemRoles } from '../rbac/roles.js';

const VERIFICATION_LEVELS = [
  'UNVERIFIED',
  'EMAIL_VERIFIED',
  'PHONE_VERIFIED',
  'COMMUNITY_VERIFIED',
  'FULL_VERIFIED',
] as const;

const safeNumericValue = (value: number | undefined | null): number => {
  return Math.max(0, value ?? 0);
};

export const authorize = (options: UjamaadaoAuthorizeOptions) => {
  const {
    allowedRoles = [],
    verificationLevel = 'UNVERIFIED',
    minImpactPoints,
    minParticipationRights,
    requiresWalletAuth = false,
    scopeCheck,
    resourceOwnerCheck,
    skipAdmin = false,
  } = options;

  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const logger = createRequestLogger(req);
    const correlationId =
      req.correlationId || `corr-${Date.now()}-${randomUUID()}`;
    const user = req.user;

    try {
      if (!user || typeof user !== 'object') {
        logSecurityEvent(
          'Missing user in authenticated request',
          'AUTH_FAILURE',
          'HIGH',
          'No user attached after auth middleware',
          {
            ipAddress: req.ip,
            metadata: { path: req.path, method: req.method, correlationId },
          }
        );
        const error = ApiError.authenticationError(
          'Unauthorized access',
          undefined,
          correlationId
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      if (!Array.isArray(user.roles)) {
        logSecurityEvent(
          'Invalid user data structure',
          'AUTH_FAILURE',
          'HIGH',
          'User roles is not an array',
          {
            userId: user.userId,
            metadata: { path: req.path, method: req.method, correlationId },
          }
        );
        const error = ApiError.systemError(
          'Invalid user data structure',
          undefined,
          correlationId
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      if (skipAdmin && user.roles.includes(SystemRoles.SUPER_ADMIN)) {
        logger.info(
          { operationType: 'AUTH', metadata: { bypass: 'super_admin' } },
          'Super admin bypassed authorization'
        );
        return next();
      }

      if (requiresWalletAuth && !req.isWalletAuthenticated) {
        logSecurityEvent(
          'Wallet authentication required but missing',
          'AUTH_FAILURE',
          'HIGH',
          'Action requires connected wallet',
          { userId: user.userId, metadata: { correlationId } }
        );
        const error = ApiError.authenticationError(
          'Wallet connection required for this action',
          { required: 'wallet' },
          correlationId
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      const userLevelIndex = VERIFICATION_LEVELS.indexOf(
        user.verificationLevel
      );
      const requiredLevelIndex = VERIFICATION_LEVELS.indexOf(verificationLevel);

      if (userLevelIndex === -1 || requiredLevelIndex === -1) {
        const invalid =
          userLevelIndex === -1 ? user.verificationLevel : verificationLevel;
        logger.error(
          { invalidLevel: invalid },
          'Invalid verification level detected'
        );
        const error = ApiError.systemError(
          'Invalid verification level configuration',
          undefined,
          correlationId
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      if (userLevelIndex < requiredLevelIndex) {
        logSecurityEvent(
          'Insufficient verification level',
          'ROLE_VIOLATION',
          'MEDIUM',
          `Required: ${verificationLevel}, Found: ${user.verificationLevel}`,
          {
            userId: user.userId,
            metadata: {
              verificationLevel: user.verificationLevel,
              requiredLevel: verificationLevel,
              correlationId,
            },
          }
        );
        const error = ApiError.insufficientVerification(
          'Account verification level insufficient',
          verificationLevel,
          correlationId
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      if (allowedRoles.length > 0) {
        const hasWildcard = allowedRoles.includes('*');
        if (hasWildcard) {
          logger.warn(
            { userId: user.userId, path: req.path, correlationId },
            'Wildcard role (*) used — allows all authenticated users'
          );
        }

        const hasRole =
          hasWildcard || user.roles.some((role) => allowedRoles.includes(role));
        if (!hasRole) {
          logSecurityEvent(
            'Role access denied',
            'ROLE_VIOLATION',
            'MEDIUM',
            `Allowed: ${allowedRoles.join(', ')}, User has: ${user.roles.join(', ')}`,
            {
              userId: user.userId,
              metadata: { allowedRoles, userRoles: user.roles, correlationId },
            }
          );
          const error = ApiError.insufficientPermissions(
            'You do not have permission to perform this action',
            allowedRoles,
            correlationId
          );
          res.status(error.statusCode).json(error.toJSON());
          return;
        }
      }

      if (minImpactPoints !== undefined) {
        const current = safeNumericValue(user.globalImpactPoints);
        if (current < minImpactPoints) {
          logSecurityEvent(
            'Insufficient impact points',
            'ECONOMIC_FRAUD',
            'MEDIUM',
            `Required: ${minImpactPoints}, Has: ${current}`,
            {
              userId: user.userId,
              metadata: { required: minImpactPoints, correlationId },
            }
          );
          const error = ApiError.economicError(
            'Insufficient impact points',
            { required: minImpactPoints, current },
            correlationId
          );
          res.status(error.statusCode).json(error.toJSON());
          return;
        }
      }

      if (minParticipationRights !== undefined) {
        const current = safeNumericValue(user.participationRights);
        if (current < minParticipationRights) {
          logSecurityEvent(
            'Insufficient participation rights',
            'ROLE_VIOLATION',
            'HIGH',
            `Required: ${minParticipationRights} PR, Has: ${current}`,
            {
              userId: user.userId,
              metadata: { requiredPR: minParticipationRights, correlationId },
            }
          );
          const error = ApiError.insufficientParticipationRights(
            'Insufficient Participation Rights (PR)',
            minParticipationRights,
            current,
            correlationId
          );
          res.status(error.statusCode).json(error.toJSON());
          return;
        }
      }

      if (scopeCheck !== undefined) {
        let allowed: boolean;
        try {
          allowed =
            typeof scopeCheck === 'function'
              ? await Promise.resolve(scopeCheck(req))
              : scopeCheck;
        } catch (err) {
          logger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Scope check threw'
          );
          const error = ApiError.systemError(
            'Scope validation failed',
            undefined,
            correlationId
          );
          res.status(error.statusCode).json(error.toJSON());
          return;
        }

        if (!allowed) {
          logSecurityEvent(
            'Geographic scope violation',
            'GEOGRAPHIC_VIOLATION',
            'HIGH',
            'Custom scope check failed',
            {
              userId: user.userId,
              metadata: {
                geographicContext: req.geographicContext,
                correlationId,
              },
            }
          );
          const error = ApiError.geographicError(
            'Invalid geographic scope',
            req.geographicContext,
            correlationId
          );
          res.status(error.statusCode).json(error.toJSON());
          return;
        }
      }

      if (resourceOwnerCheck !== undefined) {
        let isOwner: boolean;
        try {
          isOwner =
            typeof resourceOwnerCheck === 'function'
              ? await Promise.resolve(resourceOwnerCheck(req))
              : resourceOwnerCheck;
        } catch (err) {
          logger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Ownership check threw'
          );
          const error = ApiError.systemError(
            'Ownership validation failed',
            undefined,
            correlationId
          );
          res.status(error.statusCode).json(error.toJSON());
          return;
        }

        if (!isOwner) {
          logSecurityEvent(
            'Resource ownership violation',
            'ROLE_VIOLATION',
            'HIGH',
            'Unauthorized resource access attempt',
            { userId: user.userId, metadata: { path: req.path, correlationId } }
          );
          const error = ApiError.authorizationError(
            'Not authorized to access this resource',
            undefined,
            correlationId
          );
          res.status(error.statusCode).json(error.toJSON());
          return;
        }
      }

      logger.info(
        {
          operationType: 'AUTH',
          userId: user.userId,
          verificationLevel: user.verificationLevel,
          roles: user.roles,
        },
        'Platform authorization passed'
      );

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        logger.warn(
          { userId: user?.userId, errorCode: error.code, correlationId },
          'Authorization failed'
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      logger.error(
        {
          userId: user?.userId,
          error: error instanceof Error ? error.stack : String(error),
          correlationId,
        },
        'Unexpected error in authorize middleware'
      );

      const apiError = ApiError.systemError(
        'Internal authorization error',
        undefined,
        correlationId
      );
      res.status(500).json(apiError.toJSON());
    }
  };
};

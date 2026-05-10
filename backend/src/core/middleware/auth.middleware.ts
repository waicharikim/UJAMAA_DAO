/**
 * @file src/core/middleware/auth.middleware.ts
 * @description
 * Authentication Middleware for UjamaaDAO — Passwordless & Hybrid
 *
 * Security features:
 * - JWT signature verification
 * - Token expiry validation
 * - Session database validation (enables instant logout)
 * - Token blacklist check (enables JWT revocation)
 * - Brute force logging
 *
 * Version: 2.3 — January 2026
 * Updated: Uses centralized correlation ID generation
 */

import { Response, NextFunction } from 'express';
import {
  AuthRequest,
  GeographicContext,
  LocationScope,
} from '../types/Ujamaadao.types.js';
import {
  verifyJwtToken,
  jwtPayloadToAuthUser,
  JwtPayload,
} from '../utils/jwt.service.js';
import { ApiError } from '../errors/ApiError.js';
import { logSecurityEvent, createRequestLogger } from '../logger/logger.js';
import { sessionService } from '../../modules/auth/services/session.service.js';
import { tokenBlacklistService } from '../services/token-blacklist.service.js';
import { prisma } from '../database/client.js';
import { generateCorrelationId } from './errorHandler.js';

// Token validation constants
const MAX_TOKEN_LENGTH = 2048;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Safe numeric value extraction (prevents NaN, negative values)
 */
function safeNumericValue(value: number | undefined | null): number {
  return Math.max(0, Number(value) || 0);
}

/**
 * Extract and validate Bearer token from Authorization header
 */
function extractToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization?.trim();
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();

  // Reject oversized tokens (DoS protection)
  if (token.length > MAX_TOKEN_LENGTH) {
    createRequestLogger(req).warn(
      {
        operationType: 'AUTH',
        metadata: { tokenLength: token.length, ipAddress: req.ip },
      },
      'Oversized JWT token rejected'
    );
    return null;
  }

  // Validate JWT structure (3 base64url parts separated by dots)
  if (!JWT_PATTERN.test(token)) {
    createRequestLogger(req).warn(
      {
        operationType: 'AUTH',
        metadata: { ipAddress: req.ip },
      },
      'Malformed JWT token format'
    );
    return null;
  }

  return token;
}

/**
 * Build geographic context with scope inference
 */
function buildGeographicContext(payload: JwtPayload): GeographicContext {
  const scopes: LocationScope[] = [];

  if (payload.countyId) scopes.push('COUNTY');
  if (payload.constituencyId) scopes.push('CONSTITUENCY');
  if (payload.primaryWardId) scopes.push('WARD');

  return {
    primaryWardId: payload.primaryWardId ?? undefined,
    secondaryWardId: payload.secondaryWardId ?? undefined,
    currentLocationId: payload.currentLocationId ?? undefined,
    currentLocationUntil: payload.currentLocationUntil ?? undefined,
    constituencyId: payload.constituencyId ?? undefined,
    countyId: payload.countyId ?? undefined,
    locationScope: payload.primaryWardId
      ? 'WARD'
      : payload.constituencyId
        ? 'CONSTITUENCY'
        : payload.countyId
          ? 'COUNTY'
          : 'NATIONAL',
    broaderScopes: scopes,
  };
}

/**
 * Core validation logic - verifies JWT and populates request context
 *
 * Validation layers:
 * 1. JWT signature and structure
 * 2. Token expiry
 * 3. Token blacklist (revocation check)
 * 4. Session validity (database check)
 */
async function validateAndPopulateUser(
  req: AuthRequest,
  token: string
): Promise<void> {
  // Layer 1: Verify JWT signature and decode payload
  const payload = verifyJwtToken<JwtPayload>(token);

  // Layer 2: Check token expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('Token expired');
  }

  // Layer 3: Validate JTI presence (required for revocation)
  if (!payload.jti) {
    logSecurityEvent(
      'Token missing JTI claim',
      'TOKEN_MANIPULATION',
      'HIGH',
      'JWT token lacks jti claim - cannot be revoked if compromised',
      {
        userId: payload.sub,
        ipAddress: req.ip,
        metadata: { correlationId: req.correlationId },
      }
    );
    throw new Error('Invalid token structure');
  }

  // Layer 4: Check if token has been explicitly revoked (blacklist)
  const isRevoked = await tokenBlacklistService.isRevoked(payload.jti);
  if (isRevoked) {
    logSecurityEvent(
      'Revoked token used',
      'AUTH_FAILURE',
      'MEDIUM',
      'User attempted to use a revoked token (logged out)',
      {
        userId: payload.sub,
        ipAddress: req.ip,
        metadata: {
          jti: payload.jti.slice(0, 8) + '...',
          correlationId: req.correlationId,
        },
      }
    );
    throw new Error('Token has been revoked');
  }

  // Layer 5: Validate session in database (enables instant logout)
  if (payload.sessionId) {
    const isValid = await sessionService.validateSession(payload.sessionId);
    if (!isValid) {
      logSecurityEvent(
        'Session revoked',
        'AUTH_FAILURE',
        'MEDIUM',
        'User attempted to use revoked session',
        {
          userId: payload.sub,
          ipAddress: req.ip,
          metadata: {
            sessionId: payload.sessionId,
            correlationId: req.correlationId,
          },
        }
      );
      throw new Error('Session has been revoked');
    }
  }

  // Layer 6: Check user account status (blocks suspended/banned accounts)
  const account = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { status: true },
  });
  if (!account || account.status !== 'ACTIVE') {
    logSecurityEvent(
      'Suspended or banned account attempted access',
      'AUTH_FAILURE',
      'HIGH',
      `Account status: ${account?.status ?? 'NOT_FOUND'}`,
      {
        userId: payload.sub,
        ipAddress: req.ip,
        metadata: { correlationId: req.correlationId },
      }
    );
    throw new Error('Account is not active');
  }

  // Populate request context with validated user data
  req.user = jwtPayloadToAuthUser(payload);
  req.userId = payload.sub;
  req.isWalletAuthenticated = !!payload.walletAddress;
  req.walletAddress = payload.walletAddress ?? undefined;

  req.geographicContext = buildGeographicContext(payload);

  req.economicContext = {
    globalImpactPoints: safeNumericValue(payload.globalImpactPoints),
    utilityTokens: safeNumericValue(payload.utilityTokens),
    participationRights: safeNumericValue(payload.participationRights),
  };
}

/**
 * Required authentication - reject requests without valid token
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  req.correlationId ??= generateCorrelationId();

  const token = extractToken(req);
  if (!token) {
    const error = ApiError.authenticationError(
      'Authentication required',
      undefined,
      req.correlationId
    );
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  const requestLogger = createRequestLogger(req);

  try {
    await validateAndPopulateUser(req, token);
    requestLogger.info(
      { operationType: 'AUTH' },
      'User authenticated successfully'
    );
    next();
  } catch (error) {
    logSecurityEvent(
      'Authentication failed',
      'AUTH_FAILURE',
      'HIGH',
      error instanceof Error ? error.message : 'Invalid token',
      {
        ipAddress: req.ip,
        correlationId: req.correlationId,
        metadata: {
          userAgent: req.headers['user-agent'],
          errorType: error instanceof Error ? error.name : 'Unknown',
        },
      },
      error instanceof Error ? error : undefined
    );

    const apiError = ApiError.tokenInvalid(
      'Invalid or expired token',
      req.correlationId
    );
    res.status(apiError.statusCode).json(apiError.toJSON());
  }
}

/**
 * Optional authentication - continue even without token
 * Useful for endpoints that behave differently for authenticated vs anonymous users
 */
export async function optionalAuthenticate(
  req: AuthRequest,
  _: Response,
  next: NextFunction
): Promise<void> {
  req.correlationId ??= generateCorrelationId();

  const token = extractToken(req);
  if (!token) {
    return next();
  }

  const requestLogger = createRequestLogger(req);

  try {
    await validateAndPopulateUser(req, token);
    requestLogger.info({ operationType: 'AUTH' }, 'Optional auth succeeded');
  } catch (error) {
    requestLogger.warn(
      {
        operationType: 'AUTH',
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      },
      'Optional authentication failed — continuing unauthenticated'
    );
  }

  next();
}

/**
 * Require wallet authentication - ensures user connected via Web3 wallet
 */
export async function requireWalletAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await authenticate(req, res, () => {
    if (!req.isWalletAuthenticated || !req.walletAddress) {
      const error = ApiError.authenticationError(
        'Wallet authentication required for this action',
        { required: 'wallet' },
        req.correlationId
      );
      res.status(error.statusCode).json(error.toJSON());
      return;
    }

    createRequestLogger(req).info(
      {
        operationType: 'AUTH',
        metadata: { walletAddress: req.walletAddress },
      },
      'Wallet authentication confirmed'
    );

    next();
  });
}

/**
 * @file auth.middleware.ts
 * @description
 * JWT authentication middleware.
 *
 * Behavior:
 *  - Validates Authorization: Bearer <token> header (with safe parsing).
 *  - Verifies the token using process.env.JWT_SECRET (required in production).
 *  - Restricts accepted JWT signing algorithms (default HS256).
 *  - Attaches req.user and req.userRoles in a consistent shape for downstream code.
 *  - Uses next(ApiError) for errors so centralized error middleware formats responses.
 *
 * Notes:
 *  - If you use asymmetric signing (RS256), replace the verification logic to use
 *    a public key/JWKs and adjust algorithms accordingly.
 *  - This middleware intentionally does not fetch authoritative roles from DB;
 *    attachUserRoles middleware should merge DB roles after this runs.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// Require a JWT secret in production to avoid insecure defaults.
if (!JWT_SECRET && NODE_ENV !== 'development') {
  // Throwing at module load-time fails fast so misconfiguration is discovered immediately.
  throw new Error('JWT_SECRET is required in production environment');
}

/**
 * AuthRequest extends Express Request to include user + userRoles typed fields.
 */
export interface AuthRequest extends Request {
  user?: { userId: string; walletAddress?: string };
  userRoles?: { role: string; scope?: string }[];
}

/**
 * Safely parse Authorization header and return the token string if present.
 * Accepts:
 *  - "Bearer <token>"
 *  - header possibly as an array (Express can present arrays)
 */
function parseAuthHeader(authHeader: string | string[] | undefined): string | null {
  if (!authHeader) return null;
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const parts = header.split(' ').filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  // If header is a single token (no "Bearer"), accept it as token as a fallback.
  if (parts.length === 1 && parts[0].length > 0) {
    return parts[0];
  }
  return null;
}

/**
 * Middleware: authMiddleware
 * Verifies JWT token and attaches req.user and req.userRoles.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const rawAuthHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = parseAuthHeader(rawAuthHeader as any);

    if (!token) {
      logger.warn('auth.middleware: Authorization header or token missing');
      return next(new ApiError('Authorization required', 401));
    }

    // Verify token. Restrict algorithms for safety; adjust if you use RS256 (asymmetric).
    // If you use asymmetric tokens, swap algorithm and verification function accordingly.
    let payload: JwtPayload | string;
    try {
      payload = jwt.verify(token, JWT_SECRET as string, { algorithms: ['HS256'] });
    } catch (err: any) {
      // Provide clear error messages for expired vs invalid tokens
      if (err.name === 'TokenExpiredError') {
        logger.info('auth.middleware: JWT expired', { message: err.message });
        return next(new ApiError('Token expired', 401));
      }
      logger.info('auth.middleware: JWT invalid', { message: err.message });
      return next(new ApiError('Invalid authentication token', 401));
    }

    // Expect payload to contain userId and optionally walletAddress and roles.
    // Normalize shape defensively.
    if (typeof payload === 'string' || !payload) {
      logger.warn('auth.middleware: JWT payload not an object', { payload });
      return next(new ApiError('Invalid token payload', 401));
    }

    const userId = (payload as any).userId as string | undefined;
    const walletAddress = (payload as any).walletAddress as string | undefined;
    const rolesRaw = (payload as any).roles as (string | { role: string } )[] | undefined;

    if (!userId) {
      logger.warn('auth.middleware: JWT missing userId claim');
      return next(new ApiError('Invalid token payload', 401));
    }

    // Attach minimal user info to request
    req.user = { userId, walletAddress };

    // Normalize roles to consistent { role, scope? } objects (lowercased)
    const normalizedRoles: { role: string; scope?: string }[] = [];
    if (Array.isArray(rolesRaw)) {
      for (const r of rolesRaw) {
        if (typeof r === 'string') {
          normalizedRoles.push({ role: r.toLowerCase() });
        } else if (r && typeof r.role === 'string') {
          normalizedRoles.push({ role: r.role.toLowerCase(), scope: r.scope });
        }
      }
    }

    req.userRoles = normalizedRoles;

    // Success: continue to next middleware
    return next();
  } catch (err) {
    // Catch any unexpected errors and forward as 401/500 appropriately
    logger.error('auth.middleware: unexpected error', { error: (err as any)?.message ?? err });
    return next(new ApiError('Authentication error', 401));
  }
}
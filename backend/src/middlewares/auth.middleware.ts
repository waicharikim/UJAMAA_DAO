import type { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import { parseRoleInput } from '../constants/roles.js';

const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

if (!JWT_SECRET && NODE_ENV !== 'development') {
  throw new Error('JWT_SECRET is required in production environment');
}

export interface AuthRequest extends Request {
  user?: { userId: string; walletAddress?: string };
  userRoles?: { role: string; scope?: string }[];
}

function parseAuthHeader(authHeader: string | string[] | undefined): string | null {
  if (!authHeader) return null;
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const parts = header.split(' ').filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  if (parts.length === 1 && parts[0].length > 0) {
    return parts[0];
  }
  return null;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const rawAuthHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = parseAuthHeader(rawAuthHeader as any);

    if (!token) {
      logger.warn('auth.middleware: Authorization header or token missing');
      return next(new ApiError('Authorization required', 401));
    }

    let payload: JwtPayload | string;
    try {
      payload = jwt.verify(token, JWT_SECRET as string, { algorithms: ['HS256'] });
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        logger.info('auth.middleware: JWT expired', { message: err.message });
        return next(new ApiError('Token expired', 401));
      }
      logger.info('auth.middleware: JWT invalid', { message: err.message });
      return next(new ApiError('Invalid authentication token', 401));
    }

    if (typeof payload === 'string' || !payload) {
      logger.warn('auth.middleware: JWT payload not an object', { payload });
      return next(new ApiError('Invalid token payload', 401));
    }

    const userId = (payload as any).userId as string | undefined;
    const walletAddress = (payload as any).walletAddress as string | undefined;
    const rolesRaw = (payload as any).roles as (string | { role: string; scope?: string })[] | undefined;

    if (!userId) {
      logger.warn('auth.middleware: JWT missing userId claim');
      return next(new ApiError('Invalid token payload', 401));
    }

    req.user = { userId, walletAddress };

    // Normalize roles to consistent { role, scope? } objects using parseRoleInput
    const normalizedRoles: { role: string; scope?: string }[] = [];
    if (Array.isArray(rolesRaw)) {
      for (const r of rolesRaw) {
        const parsed = parseRoleInput(r);
        if (parsed && parsed.role) normalizedRoles.push(parsed as any);
      }
    }

    req.userRoles = normalizedRoles;

    return next();
  } catch (err) {
    logger.error('auth.middleware: unexpected error', { error: (err as any)?.message ?? err });
    return next(new ApiError('Authentication error', 401));
  }
}
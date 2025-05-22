/**
 * @file auth.middleware.ts
 *
 * @description
 * Middleware for JWT-based authentication.
 * - Validates JWT from the Authorization header.
 * - Attaches user identity and roles to the request object.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret';

export interface AuthRequest extends Request {
  user?: { userId: string; walletAddress: string };
  userRoles?: { role: string; scope?: string }[];
}

/**
 * Express middleware to authenticate requests via JWT.
 * Checks Authorization header for Bearer token.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader) {
    logger.warn('Authorization header missing');
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = Array.isArray(authHeader) ? authHeader[0].split(' ')[1] : authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Token missing in Authorization header');
    return res.status(401).json({ error: 'Token missing' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      walletAddress: string;
      roles?: string[];
    };

    logger.info('JWT successfully verified', { userId: payload.userId });

    req.user = {
      userId: payload.userId,
      walletAddress: payload.walletAddress,
    };

    req.userRoles = (payload.roles ?? []).map(role => ({ role: role.toLowerCase() }));

    next();
  } catch (err: any) {
    logger.error('JWT verification error', { error: err.message ?? err });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
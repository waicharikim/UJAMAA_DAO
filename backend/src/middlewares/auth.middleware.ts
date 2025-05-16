/**
 * @file auth.middleware.ts
 *
 * @description
 * Express middleware for JWT authentication.
 * Validates the Authorization header,
 * verifies the JWT token against the secret,
 * attaches the user info to the request object,
 * and blocks unauthorized access.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js'; // Adjust path if required

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret';

export interface AuthRequest extends Request {
  headers: Request['headers']; // Explicitly include headers
  user?: { userId: string; walletAddress: string };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  logger.info('Auth header received', { authHeader });

  if (!authHeader) {
    logger.warn('Authorization header missing');
    res.status(401).json({ error: 'Authorization header missing' });
    return;
  }

  const token = Array.isArray(authHeader) ? authHeader[0].split(' ')[1] : authHeader.split(' ')[1];
  if (!token) {
    logger.warn('Token missing in Authorization header');
    res.status(401).json({ error: 'Token missing' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      walletAddress: string;
    };
    logger.info('JWT successfully verified', { userId: payload.userId });
    req.user = { userId: payload.userId, walletAddress: payload.walletAddress };
    next();
  } catch (err) {
    logger.error('JWT verification error', { error: err });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Extend Express Request type to include user info
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    walletAddress: string;
  };
}

// Middleware to verify JWT token in Authorization header
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header missing' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Token missing' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      walletAddress: string;
    };
    req.user = { userId: payload.userId, walletAddress: payload.walletAddress };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
/**
 * @file src/core/middleware/logging.middleware.ts
 * @description
 * Request-scoped logger middleware
 *
 * Attaches a logger instance to each request with automatic context binding.
 * The base logger already has PII-safe serializers, so we don't need redundant
 * sanitization here.
 *
 * Version: 2.1 — January 2026
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/logger.js';

// Extend Express Request type to include log property
declare global {
  namespace Express {
    interface Request {
      log: {
        info: (message: string, meta?: any) => void;
        error: (message: string, meta?: any) => void;
        warn: (message: string, meta?: any) => void;
        debug: (message: string, meta?: any) => void;
      };
    }
  }
}

/**
 * Attach scoped logger to request with correlation ID and user context
 *
 * The base logger (from logger.ts) already has serializers that:
 * - Redact PII (emails, wallets, IPs)
 * - Sanitize log messages
 * - Format structured data
 *
 * So we don't need to duplicate that logic here.
 */
export const attachLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = (req as any).correlationId;
  const userId = (req as any).user?.userId;

  // Create child logger with request-specific context
  const childLogger = logger.child({
    correlationId,
    userId,
  });

  // Attach simplified logging interface to request
  req.log = {
    info: (message: string, meta?: any) => {
      childLogger.info({ ...meta }, message);
    },

    error: (message: string, meta?: any) => {
      childLogger.error({ ...meta }, message);
    },

    warn: (message: string, meta?: any) => {
      childLogger.warn({ ...meta }, message);
    },

    debug: (message: string, meta?: any) => {
      childLogger.debug({ ...meta }, message);
    },
  };

  next();
};

/**
 * Request/Response logger - logs all incoming requests and their outcomes
 *
 * Useful for:
 * - API monitoring
 * - Performance tracking
 * - Debugging
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Log incoming request
  req.log?.info('Incoming request', {
    method: req.method,
    path: req.path,
    // IP will be redacted by base logger's serializers
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Use warn level for 4xx/5xx errors, info for success
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    req.log[level]('Request completed', {
      statusCode: res.statusCode,
      durationMs: duration,
      slow: duration > 1000, // Flag slow requests
    });
  });

  next();
};

export default attachLogger;

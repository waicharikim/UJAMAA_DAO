/**
 * @file src/core/middleware/rateLimiter.ts
 * @description
 * Production-ready rate limiter with Redis store, server-side fingerprinting,
 * and progressive penalties.
 *
 * Features:
 * - Redis-backed distributed rate limiting
 * - Fallback to in-memory store for dev/single-server
 * - Server-side fingerprinting (IP + User-Agent + headers)
 * - Progressive penalties for repeat offenders
 * - Security event logging
 *
 * Version: 2.3 — January 2026
 * Security Hardened & Signature Fixed: January 2026
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../logger/logger.js';
import { ApiError } from '../errors/ApiError.js';
import { env } from '../utils/env.js';

// ============================================================================
// REDIS CLIENT WITH PROPER INITIALIZATION
// ============================================================================

let redisClient: RedisClientType | null = null;
let redisReady = false;

/**
 * Initialize Redis connection asynchronously
 * Call this from app.ts before starting the server
 */
async function initializeRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    console.warn(
      '[RateLimit] REDIS_URL not set — using in-memory store (dev only, not for production)'
    );
    redisReady = true;
    return;
  }

  try {
    redisClient = createClient({ url: env.REDIS_URL });

    redisClient.on('error', (err: any) => {
      console.error('[RateLimit] Redis error:', err);
    });

    await redisClient.connect();
    redisReady = true;
    console.log('[RateLimit] Redis connected for rate limiting');
  } catch (err) {
    console.error('[RateLimit] Failed to connect to Redis:', err);
    redisClient = null;
    redisReady = true;
  }
}

export const redisInitialized = initializeRedis();

// ============================================================================
// SERVER-SIDE FINGERPRINTING
// ============================================================================

/**
 * Generate server-side fingerprint from request characteristics
 * More reliable than client IP alone (handles proxies, NAT, etc.)
 */
export function generateServerFingerprint(req: Request): string {
  const parts = [
    req.ip || 'unknown',
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ];

  return crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 16);
}

// ============================================================================
// PROGRESSIVE PENALTY TRACKING
// ============================================================================

/**
 * Record a rate limit offense and return offense count
 * Used to implement progressive penalties (longer blocks for repeat offenders)
 */
async function recordOffense(key: string): Promise<number> {
  try {
    if (!redisClient?.isOpen) {
      return 1;
    }

    const offenseKey = `offenses:${key}`;
    const raw = await redisClient.get(offenseKey);
    const record = raw ? JSON.parse(raw) : { count: 0 };
    record.count += 1;

    await redisClient.set(offenseKey, JSON.stringify(record), { EX: 604800 });
    return record.count;
  } catch {
    return 1;
  }
}

/**
 * Calculate block duration based on offense history
 * Progressive penalties: 1h → 6h → 24h → 3d → 7d
 */
async function getBlockDuration(key: string): Promise<number> {
  const durations = [3600000, 21600000, 86400000, 259200000, 604800000];

  try {
    if (!redisClient?.isOpen) {
      return durations[0];
    }

    const offenseKey = `offenses:${key}`;
    const raw = await redisClient.get(offenseKey);
    const count = raw ? JSON.parse(raw).count : 0;
    return durations[Math.min(count, durations.length - 1)];
  } catch {
    return durations[0];
  }
}

/**
 * Determine severity based on how much the limit was exceeded
 */
function getSeverity(
  current: number,
  limit: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const ratio = current / limit;
  if (ratio <= 1.5) return 'LOW';
  if (ratio <= 2) return 'MEDIUM';
  if (ratio <= 5) return 'HIGH';
  return 'CRITICAL';
}

// ============================================================================
// CORE LIMITER FACTORY
// ============================================================================

interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Build a rate limiter with custom configuration
 */
export function buildRateLimiter(config: RateLimiterConfig) {
  // In test environment, return a no-op middleware to prevent rate-limit interference
  if (process.env.NODE_ENV === 'test') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  if (!redisReady) {
    console.warn(
      '[RateLimit] Building limiter before Redis ready - will use in-memory store'
    );
  }

  const defaultKeyGenerator = (req: Request) => {
    const fp = generateServerFingerprint(req);
    if (!fp) throw ApiError.badRequest('Unable to identify request');
    return config.keyPrefix ? `${config.keyPrefix}:${fp}` : fp;
  };

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: config.message || 'Too many requests',

    store: redisClient?.isOpen
      ? new RedisStore({
          sendCommand: (...args: any[]) => redisClient!.sendCommand(args),
          prefix: 'rl:',
        })
      : undefined,

    keyGenerator: config.keyGenerator || defaultKeyGenerator,

    skip: (req: Request) => {
      const trusted =
        env.TRUSTED_IPS?.split(',').map((t: string) => t.trim()) || [];
      if (trusted.includes(req.ip || '')) return true;
      if (['/health', '/metrics'].includes(req.path)) return true;
      return false;
    },

    handler: async (req: Request, res: Response) => {
      const fp = generateServerFingerprint(req);
      const offenseCount = await recordOffense(fp);
      const blockDuration = await getBlockDuration(fp);
      const retryAfter = Math.ceil(blockDuration / 1000);
      const current = (req as any).rateLimit?.current || config.max + 1;
      const severity = getSeverity(current, config.max);

      logSecurityEvent(
        'Rate limit exceeded',
        'BRUTE_FORCE',
        severity,
        `${current}/${config.max} requests in window. Offense #${offenseCount}`,
        {
          ipAddress: req.ip,
          metadata: {
            path: req.path,
            method: req.method,
            fingerprint: fp,
            offenseCount,
            retryAfterSeconds: retryAfter,
            keyPrefix: config.keyPrefix,
          },
        }
      );

      res.status(429).json(ApiError.tooManyRequests(retryAfter).toJSON());
    },
  });
}

// ============================================================================
// PRESET LIMITERS (READY TO USE)
// ============================================================================

/**
 * Strict rate limit for sensitive operations (password reset, magic links, etc.)
 * 5 requests per 15 minutes
 */
export function strictRateLimit() {
  return buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many attempts — try again later',
    keyPrefix: 'strict',
  });
}

/**
 * Auth rate limit for login/signup endpoints
 * 20 requests per 15 minutes
 */
export function authRateLimit() {
  return buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts — please slow down',
    keyPrefix: 'auth',
  });
}

/**
 * Standard API rate limit
 * 100 requests per 15 minutes
 */
export function apiRateLimit() {
  return buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyPrefix: 'api',
  });
}

/**
 * Public/read-only endpoints rate limit
 * 1000 requests per 15 minutes
 */
export function publicRateLimit() {
  return buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyPrefix: 'public',
  });
}

/**
 * Global rate limit (all requests combined)
 * 10,000 requests per minute across all users
 */
export function globalRateLimit() {
  return buildRateLimiter({
    windowMs: 60 * 1000,
    max: 10000,
    keyGenerator: () => 'global',
  });
}

/**
 * Graceful shutdown - close Redis connection
 */
export async function shutdownRateLimiter(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    console.log('[RateLimit] Redis connection closed');
  }
}

// Export everything
export default {
  buildRateLimiter,
  strictRateLimit,
  authRateLimit,
  apiRateLimit,
  publicRateLimit,
  globalRateLimit,
  generateServerFingerprint,
  redisInitialized,
  shutdownRateLimiter,
};

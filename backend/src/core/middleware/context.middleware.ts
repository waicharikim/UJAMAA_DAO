/**
 * @file src/core/middleware/context.middleware.ts
 * @description
 * Request Context Middleware — First in Chain
 *
 * Initializes:
 * - Correlation ID for distributed tracing (validated for security)
 * - Request timing for performance monitoring
 * - Context placeholders (user, geographic, economic)
 * - Security headers
 * - Rate limit metadata
 *
 * Must run after body/cookie parsers, before auth middleware
 *
 * Version: 2.1 — January 2026
 * Security Hardened: January 2026
 */

import type { Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import type { AuthRequest } from "../types/Ujamaadao.types.js";
import { logger } from "../logger/logger.js";
import { sanitizeLogMessage } from "../logger/log-sanitizer.js";

// Valid UUID v4 pattern for correlation ID validation
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Custom correlation ID pattern (corr-timestamp-uuid)
const CUSTOM_CORRELATION_PATTERN = /^corr-\d{13}-[0-9a-f]{8,}$/i;

// Maximum correlation ID length to prevent header injection
const MAX_CORRELATION_ID_LENGTH = 64;

/**
 * Validate and sanitize correlation ID from client
 * 
 * Security: Only accept properly formatted UUIDs or our custom format
 * to prevent header injection attacks
 */
function validateCorrelationId(headerValue?: string): string | null {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  // Trim and enforce length limit
  const sanitized = headerValue.trim().slice(0, MAX_CORRELATION_ID_LENGTH);

  // Accept standard UUID v4
  if (UUID_PATTERN.test(sanitized)) {
    return sanitized;
  }

  // Accept our custom format (corr-timestamp-uuid)
  if (CUSTOM_CORRELATION_PATTERN.test(sanitized)) {
    return sanitized;
  }

  // Invalid format - could be injection attempt
  return null;
}

/**
 * Generate cryptographically secure correlation ID
 */
function generateCorrelationId(): string {
  return `corr-${Date.now()}-${randomUUID()}`;
}

/**
 * Context initialization middleware
 * 
 * Sets up all request-scoped context that other middleware depends on.
 * This MUST run first in the middleware chain (after body parsers).
 */
export const contextMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // 1. Correlation ID - validate from header or generate new
  const headerCorrelationId = req.headers["x-correlation-id"] as string;
  const validatedId = validateCorrelationId(headerCorrelationId);
  
  // Only accept valid correlation IDs, otherwise generate new one
  const correlationId = validatedId || generateCorrelationId();
  req.correlationId = correlationId;

  // Log security warning if client sent invalid correlation ID
  if (headerCorrelationId && !validatedId) {
    logger.warn({
      operationType: "SECURITY",
      metadata: {
        invalidCorrelationId: sanitizeLogMessage(headerCorrelationId),
        ipAddress: req.ip,
        path: req.path,
        userAgent: req.headers["user-agent"],
      }
    }, "Invalid correlation ID format rejected - possible header injection attempt");
  }

  // 2. Initialize authentication context with safe defaults
  req.user = req.user || undefined;
  req.userId = req.userId || undefined;
  req.walletAddress = req.walletAddress || undefined;
  req.isWalletAuthenticated = req.isWalletAuthenticated || false;

  // 3. Initialize geographic context
  req.geographicContext = req.geographicContext || undefined;

  // 4. Initialize economic context with safe defaults (prevent negative values)
  req.economicContext = req.economicContext || {
    globalImpactPoints: 0,
    utilityTokens: 0,
    participationRights: 0,
  };

  // 5. Initialize user roles array
  req.userRoles = req.userRoles || [];

  // 6. Performance tracking
  req.requestStartTime = Date.now();

  // 7. Rate limit metadata (will be populated by rate limiter if enabled)
  req.rateLimit = req.rateLimit || undefined;

  // 8. Session ID (will be populated by auth middleware if present)
  req.sessionId = req.sessionId || undefined;

  // 9. Propagate correlation ID to client (always send our generated/validated ID)
  res.setHeader("X-Correlation-ID", correlationId);

  // 10. Set security headers (if not already set by helmet)
  if (!res.headersSent) {
    // Prevent MIME sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");
    
    // XSS protection (legacy but good defense-in-depth)
    res.setHeader("X-XSS-Protection", "1; mode=block");
    
    // Referrer policy (privacy)
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  next();
};

/**
 * Request cleanup middleware — logs duration, warns on slow requests
 * 
 * Should be added early in middleware chain (after context) so it can
 * track the total request duration including all middleware/handlers.
 */
export const requestCleanupMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const startTime = req.requestStartTime || Date.now();
  let cleanupExecuted = false; // Prevent double execution

  const cleanup = () => {
    // Only execute cleanup once
    if (cleanupExecuted) return;
    cleanupExecuted = true;

    const duration = Date.now() - startTime;

    // Determine severity based on duration
    const isSlow = duration > 1000;
    const isVerySlow = duration > 5000;
    const isCritical = duration > 10000;

    // Log context with appropriate detail level
    const logContext = {
      operationType: "PERFORMANCE" as const,
      userId: req.user?.userId,
      metadata: {
        method: req.method,
        path: req.path, // Path only, not full URL (may contain tokens)
        durationMs: duration,
        correlationId: req.correlationId,
        statusCode: res.statusCode,
        slow: isSlow,
        verySlow: isVerySlow,
        critical: isCritical,
      },
    };

    // Log with appropriate severity
    if (isCritical) {
      logger.error(
        logContext,
        `CRITICAL: Request took ${duration}ms - investigate immediately`
      );
    } else if (isVerySlow) {
      logger.error(
        logContext,
        `Very slow request detected (${duration}ms) - potential performance issue`
      );
    } else if (isSlow) {
      logger.warn(
        logContext,
        `Slow request detected (${duration}ms)`
      );
    } else if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(
        logContext,
        `Request completed in ${duration}ms`
      );
    }

    // Log successful requests in info (for monitoring)
    if (res.statusCode < 400 && duration < 1000) {
      logger.info(
        {
          operationType: "GENERAL" as const,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration,
            correlationId: req.correlationId,
          },
        },
        "Request completed successfully"
      );
    }
  };

  // Attach to both events:
  // - finish: successful response sent
  // - close: connection closed (may not have sent full response)
  res.on("finish", cleanup);
  res.on("close", cleanup);

  next();
};

/**
 * Request size validator - prevent DoS via large payloads
 * 
 * This is a secondary check in addition to body-parser limits.
 * Use this to enforce stricter limits on specific routes.
 * 
 * @example
 * router.post('/upload', validateRequestSize(1024 * 1024), handler) // 1MB
 */
export const validateRequestSize = (maxBytes: number) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxBytes) {
      logger.warn({
        operationType: "SECURITY",
        userId: req.user?.userId,
        metadata: {
          contentLength,
          maxAllowed: maxBytes,
          path: req.path,
          correlationId: req.correlationId,
        },
      }, "Request rejected - payload too large");

      res.status(413).json({
        success: false,
        message: "Request payload too large",
        code: "PAYLOAD_TOO_LARGE",
        meta: {
          maxSizeBytes: maxBytes,
          correlationId: req.correlationId,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Trusted proxy header validator
 * 
 * Validates X-Forwarded-* headers to prevent IP spoofing.
 * Only use if you trust your proxy/load balancer.
 */
export const validateProxyHeaders = (trustedProxies: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    
    if (forwardedFor && !trustedProxies.includes(req.ip || '')) {
      logger.warn({
        operationType: "SECURITY",
        metadata: {
          forwardedFor,
          actualIp: req.ip,
          path: req.path,
          correlationId: req.correlationId,
        },
      }, "X-Forwarded-For header from untrusted proxy - potential IP spoofing");
    }

    next();
  };
};

export default contextMiddleware;
/**
 * @file src/core/middleware/errorHandler.ts
 * @description
 * Global Error Handler for UjamaaDAO — Final Middleware
 *
 * Features:
 * - Converts all errors to standardized ApiResponse
 * - Integrates with ApiError, logger, security events
 * - Handles Zod, Prisma, JWT, and internal errors
 * - PII-safe logging with automatic redaction
 * - Environment-aware error details (hide in production)
 * - Security event tracking for suspicious errors
 * - Proper HTTP headers for rate limiting
 *
 * Version: 2.2 — January 2026
 * Security Hardened & Improved: January 2026
 */

import type { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import type { AuthRequest } from '../types/Ujamaadao.types.js';
import { ApiError } from '../errors/ApiError.js';
import { BaseError } from '../errors/BaseError.js';
import { logger, logSecurityEvent } from '../logger/logger.js';
import { serializeError } from '../logger/log-serializers.js';
import {
  redactEmail,
  redactWallet,
  redactIP,
} from '../logger/log-sanitizer.js';
import {
  SecurityEventType,
  statusCodeToEventType,
} from '../types/security-event.types.js';

// Prisma error codes we handle specially
const PRISMA_ERROR_CODES = {
  UNIQUE_CONSTRAINT: 'P2002',
  NOT_FOUND: 'P2025',
  FOREIGN_KEY: 'P2003',
  CONSTRAINT_FAILED: 'P2004',
  INVALID_VALUE: 'P2007',
  QUERY_TIMEOUT: 'P2024',
  CONNECTION_ERROR: 'P1001',
  AUTHENTICATION_FAILED: 'P1002',
} as const;

// JWT error names
const JWT_ERROR_NAMES = {
  TOKEN_EXPIRED: 'TokenExpiredError',
  JSON_WEB_TOKEN_ERROR: 'JsonWebTokenError',
  NOT_BEFORE_ERROR: 'NotBeforeError',
} as const;

/**
 * Generate correlation ID (centralized)
 */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${randomUUID()}`;
}

/**
 * Build comprehensive log context with PII redaction
 */
function buildLogContext(req: AuthRequest, error: unknown) {
  return {
    operationType: 'GENERAL' as const,
    userId: req.user?.userId,
    email: redactEmail(req.user?.email),
    walletAddress: redactWallet(req.user?.walletAddress),
    ipAddress: redactIP(req.ip),
    geographicScope: req.geographicContext?.locationScope,
    hasEconomicActivity: !!req.economicContext?.participationRights,
    metadata: {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path, // Path only, not full URL (might have tokens)
      userAgent: req.headers['user-agent']?.slice(0, 200),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    },
  };
}

/**
 * Determine if error is security-relevant and should be logged as security event
 */
function isSecurityRelevant(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (
      error.statusCode === 401 ||
      error.statusCode === 403 ||
      error.statusCode === 429 ||
      error.statusCode >= 500
    );
  }

  // JWT errors are security-relevant
  if (error instanceof Error) {
    return Object.values(JWT_ERROR_NAMES).includes(error.name as any);
  }

  return false;
}

/**
 * Get security event severity based on error
 */
function getSecuritySeverity(
  error: unknown
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) return 'HIGH';
    if (error.statusCode === 429) return 'MEDIUM';
    if (error.statusCode === 403) return 'MEDIUM';
    if (error.statusCode === 401) return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Get security event type based on error
 * Maps error types to valid SecurityEventType values
 */
function getSecurityEventType(error: unknown): SecurityEventType {
  if (error instanceof ApiError) {
    return statusCodeToEventType(error.statusCode);
  }

  if (
    error instanceof Error &&
    Object.values(JWT_ERROR_NAMES).includes(error.name as any)
  ) {
    return 'TOKEN_VALIDATION_FAILED';
  }

  return 'AUTH_FAILURE';
}

/**
 * Convert Prisma errors to ApiError
 */
function handlePrismaError(error: any, correlationId?: string): ApiError {
  const code = error.code as string;

  switch (code) {
    case PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT:
      // Extract field name if available (but don't expose value)
      const target = error.meta?.target?.[0] || 'resource';
      return ApiError.duplicateResource(
        `${target} already exists`,
        target,
        undefined,
        correlationId
      );

    case PRISMA_ERROR_CODES.NOT_FOUND:
      return ApiError.notFound('Resource', undefined, correlationId);

    case PRISMA_ERROR_CODES.FOREIGN_KEY:
    case PRISMA_ERROR_CODES.CONSTRAINT_FAILED:
      return ApiError.badRequest(
        'Invalid reference or constraint violation',
        undefined,
        correlationId
      );

    case PRISMA_ERROR_CODES.INVALID_VALUE:
      return ApiError.validationError(
        'Invalid data value',
        { field: error.meta?.field_name },
        correlationId
      );

    case PRISMA_ERROR_CODES.QUERY_TIMEOUT:
      return ApiError.systemError(
        'Database query timeout',
        undefined,
        correlationId
      );

    case PRISMA_ERROR_CODES.CONNECTION_ERROR:
    case PRISMA_ERROR_CODES.AUTHENTICATION_FAILED:
      return ApiError.systemError(
        'Database connection error',
        undefined,
        correlationId
      );

    default:
      // Log internal Prisma error code for debugging
      logger.error(
        {
          operationType: 'DATABASE',
          metadata: {
            prismaCode: code,
            correlationId,
          },
        },
        'Unhandled Prisma error'
      );

      // Generic database error (don't expose internal details)
      return ApiError.databaseError(
        'Database operation failed',
        undefined,
        correlationId
      );
  }
}

/**
 * Convert Zod errors to ApiError with detailed field errors
 */
function handleZodError(error: any, correlationId?: string): ApiError {
  const zodError = error as any;

  // Group errors by field for better client handling
  const fieldErrors: Record<string, string> = {};

  zodError.errors?.forEach((e: any) => {
    const field = e.path?.join('.') || '_general';
    // Take first error per field (avoid overwhelming client)
    if (!fieldErrors[field]) {
      fieldErrors[field] = e.message.slice(0, 200); // Truncate long messages
    }
  });

  return ApiError.validationError(
    'Request validation failed',
    { fields: fieldErrors, errorCount: zodError.errors?.length || 0 },
    correlationId
  );
}

/**
 * Convert JWT errors to ApiError
 */
function handleJWTError(error: Error, correlationId?: string): ApiError {
  switch (error.name) {
    case JWT_ERROR_NAMES.TOKEN_EXPIRED:
      return ApiError.tokenExpired(
        'Your session has expired. Please log in again.',
        correlationId
      );

    case JWT_ERROR_NAMES.JSON_WEB_TOKEN_ERROR:
      return ApiError.tokenInvalid(
        'Invalid authentication token',
        correlationId
      );

    case JWT_ERROR_NAMES.NOT_BEFORE_ERROR:
      return ApiError.tokenInvalid('Token not yet valid', correlationId);

    default:
      return ApiError.authenticationError(
        'Authentication failed',
        undefined,
        correlationId
      );
  }
}

/**
 * Set appropriate HTTP headers based on error type
 */
function setErrorHeaders(res: Response, apiError: ApiError): void {
  // Rate limiting - set Retry-After header
  if (apiError.statusCode === 429 && apiError.details?.retryAfter) {
    res.setHeader('Retry-After', Math.ceil(apiError.details.retryAfter));
  }

  // Authentication errors - set WWW-Authenticate header
  if (apiError.statusCode === 401) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="UjamaaDAO"');
  }

  // CORS-safe error exposure
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Main error handler middleware
 *
 * This MUST be the last middleware in the chain
 */
export const errorHandler = (
  err: unknown,
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID if missing
  const correlationId = req.correlationId || generateCorrelationId();
  req.correlationId = correlationId;

  // Build PII-safe log context
  const logContext = buildLogContext(req, err);

  let apiError: ApiError;

  // Convert various error types to ApiError
  if (err instanceof ApiError) {
    // Already an ApiError - use as-is but ensure correlation ID
    apiError = err;
    if (!apiError.correlationId) {
      apiError = new ApiError(err.message, err.statusCode, {
        ...err,
        correlationId,
      });
    }
  } else if (err instanceof BaseError) {
    // Convert BaseError to ApiError with type-safe code conversion
    apiError = ApiError.fromError(err, { correlationId });
  } else if (
    err &&
    typeof err === 'object' &&
    'name' in err &&
    (err as any).name === 'ZodError'
  ) {
    // Zod validation errors
    apiError = handleZodError(err, correlationId);
  } else if (
    err instanceof Error &&
    Object.values(JWT_ERROR_NAMES).includes(err.name as any)
  ) {
    // JWT errors
    apiError = handleJWTError(err, correlationId);
  } else if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as any).code === 'string'
  ) {
    // Prisma database errors
    apiError = handlePrismaError(err, correlationId);
  } else if (err instanceof Error) {
    // Generic errors - sanitize message
    const safeMessage = err.message.slice(0, 200); // Truncate
    apiError = ApiError.systemError(safeMessage, undefined, correlationId);
  } else {
    // Unknown error types - don't expose raw error
    apiError = ApiError.systemError(
      'An unexpected error occurred',
      undefined,
      correlationId
    );
  }

  // Log as security event if relevant
  if (isSecurityRelevant(err)) {
    const severity = getSecuritySeverity(err);
    const eventType = getSecurityEventType(err);

    logSecurityEvent(
      apiError.message,
      eventType,
      severity,
      `API error: ${apiError.message}`,
      {
        userId: logContext.userId,
        ipAddress: req.ip,
        metadata: {
          ...logContext.metadata,
          errorCode: apiError.code,
          statusCode: apiError.statusCode,
          path: req.path,
          method: req.method,
        },
      }
    );
  }

  // Log with appropriate level
  if (apiError.statusCode >= 500) {
    // Server errors - log full details internally
    logger.error(
      {
        ...logContext,
        error: serializeError(err),
        apiError: apiError.toJSON(),
      },
      `Server Error [${apiError.statusCode}]: ${apiError.message}`
    );
  } else if (apiError.statusCode >= 400) {
    // Client errors - less verbose
    logger.warn(
      {
        ...logContext,
        errorCode: apiError.code,
        statusCode: apiError.statusCode,
      },
      `Client Error [${apiError.statusCode}]: ${apiError.message}`
    );
  } else {
    // Informational (shouldn't happen in error handler, but handle gracefully)
    logger.info(
      {
        ...logContext,
        errorCode: apiError.code,
        statusCode: apiError.statusCode,
      },
      `Handled [${apiError.statusCode}]: ${apiError.message}`
    );
  }

  // Set appropriate HTTP headers
  setErrorHeaders(res, apiError);

  // Send error response (never expose stack traces to client)
  const responseBody = {
    message: apiError.message,
    code: apiError.code,
    correlationId: apiError.correlationId,
    // Only include details if not a server error (prevent info leakage)
    ...(apiError.statusCode < 500 &&
      apiError.details && { details: apiError.details }),
  };

  res.status(apiError.statusCode).json(responseBody);
};

/**
 * Not Found (404) handler
 *
 * Place this BEFORE the error handler to catch unmatched routes
 */
export const notFoundHandler = (req: AuthRequest, res: Response): void => {
  const correlationId = req.correlationId || generateCorrelationId();

  logger.warn(
    {
      operationType: 'GENERAL',
      userId: req.user?.userId,
      metadata: {
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? 'present' : 'none',
        correlationId,
      },
    },
    '404 - Endpoint not found'
  );

  const error = ApiError.notFound('Endpoint', undefined, correlationId);

  res.status(404).json({
    message: error.message,
    code: error.code,
    correlationId,
  });
};

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes to error handler
 *
 * @example
 * router.get('/user', catchAsync(async (req, res) => {
 *   const user = await getUser(); // If this throws, it's caught
 *   res.json(user);
 * }))
 */
export const catchAsync = (fn: Function) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Health check endpoint error handler
 * Simpler error handling for health checks (no full logging)
 */
export const healthCheckErrorHandler = (
  err: unknown,
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  logger.error(
    {
      operationType: 'SYSTEM',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    },
    'Health check failed'
  );

  res.status(503).json({
    status: 'unhealthy',
    error: 'Service unavailable',
  });
};

export default errorHandler;

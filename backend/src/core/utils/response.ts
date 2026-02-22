/**
 * @file src/core/utils/response.ts
 * @description
 * Unified API response utilities for UjamaaDAO
 *
 * Security Features:
 * - PII redaction in error details
 * - Stack trace protection
 * - Input validation
 * - Correlation ID support
 *
 * Version: 2.0 — December 2025
 * Security Hardened: December 2025
 */

import type { Response, RequestHandler, NextFunction, Request } from 'express';
import { autoRedactObject, containsPII } from '../logger/log-sanitizer.js';
import { AuthRequest } from '../types/Ujamaadao.types.js';

/**
 * Unified API response shape for all endpoints.
 * Extensible for both REST and gRPC contexts.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    correlationId?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * Sanitize error details (remove PII, stack traces, internal paths)
 */
function sanitizeErrorDetails(
  details?: Record<string, any>
): Record<string, any> | undefined {
  if (!details) return undefined;

  // Check for PII and redact
  const sanitized = containsPII(details)
    ? autoRedactObject(details)
    : { ...details };

  // Remove sensitive keys
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'stack',
    'stackTrace',
  ];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      delete sanitized[key];
    }
  }

  // Remove overly long values (prevent response bloat)
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
      sanitized[key] = sanitized[key].slice(0, 500) + '... [truncated]';
    }
  }

  return sanitized;
}

/**
 * Build a standardized response object (can be reused for gRPC, tests, etc.)
 */
export const buildResponse = <T>(
  success: boolean,
  payload: Partial<ApiResponse<T>> = {},
  correlationId?: string
): ApiResponse<T> => {
  // Sanitize error details if present
  const sanitizedError = payload.error
    ? {
        ...payload.error,
        details: sanitizeErrorDetails(payload.error.details),
      }
    : undefined;

  return {
    success,
    message: payload.message,
    data: payload.data,
    error: sanitizedError,
    meta: {
      ...payload.meta,
      correlationId: correlationId || payload.meta?.correlationId,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Send a success response (standard for REST)
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message = 'Success',
  status = 200,
  meta?: ApiResponse<T>['meta']
): Response<ApiResponse<T>> => {
  // Get correlation ID from request if available
  const req = res.req as AuthRequest;
  const correlationId = req?.correlationId;

  // Validate status code
  if (status < 200 || status >= 300) {
    console.warn(
      `[Response] Invalid success status code: ${status}, using 200`
    );
    status = 200;
  }

  return res.status(status).json(
    buildResponse(
      true,
      {
        message,
        data,
        meta,
      },
      correlationId
    )
  );
};

/**
 * Send an error response (structured for easier debugging and monitoring)
 */
export const sendError = (
  res: Response,
  error:
    | string
    | {
        code?: string;
        message?: string;
        details?: Record<string, any>;
      },
  status = 400,
  message = 'Request failed'
): Response<ApiResponse> => {
  // Get correlation ID from request if available
  const req = res.req as AuthRequest;
  const correlationId = req?.correlationId;

  // Validate status code
  if (status < 400 || status >= 600) {
    console.warn(`[Response] Invalid error status code: ${status}, using 400`);
    status = 400;
  }

  // Build error object
  const errObj =
    typeof error === 'string'
      ? { message: error }
      : {
          message: error.message || message,
          code: error.code,
          details: error.details,
        };

  // In production, don't expose internal error details
  if (process.env.NODE_ENV === 'production' && status >= 500) {
    errObj.details = undefined; // Hide server error details from client
  }

  return res.status(status).json(
    buildResponse(
      false,
      {
        message,
        error: errObj,
      },
      correlationId
    )
  );
};

/**
 * Send a paginated response (standardized meta format)
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
  message = 'Fetched successfully'
): Response<ApiResponse<T[]>> => {
  // Get correlation ID from request if available
  const req = res.req as AuthRequest;
  const correlationId = req?.correlationId;

  // Validate pagination parameters
  const safeMeta = {
    page: Math.max(1, meta.page || 1),
    limit: Math.max(1, Math.min(1000, meta.limit || 10)), // Cap at 1000
    total: Math.max(0, meta.total || 0),
    totalPages: Math.ceil((meta.total || 0) / (meta.limit || 10)),
    hasNextPage: meta.page * meta.limit < meta.total,
    hasPreviousPage: meta.page > 1,
  };

  return res.status(200).json(
    buildResponse(
      true,
      {
        message,
        data,
        meta: safeMeta,
      },
      correlationId
    )
  );
};

/**
 * Utility: Format errors (safe for non-Express layers)
 */
export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    // In production, don't include stack traces in messages
    if (process.env.NODE_ENV === 'production') {
      return error.message;
    }
    return error.message;
  }

  if (typeof error === 'string') {
    return error.slice(0, 500); // Truncate long error strings
  }

  if (error && typeof error === 'object') {
    return JSON.stringify(error).slice(0, 500);
  }

  return 'An unknown error occurred';
};

/**
 * Async wrapper to handle errors cleanly in controllers
 * Avoids repetitive try/catch blocks
 */
export const asyncHandler =
  (fn: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    // Ensure we handle both sync and async errors
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Send a 204 No Content response (for successful DELETE, etc.)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(204).end();
};

/**
 * Send a 201 Created response with location header
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  location?: string,
  message = 'Resource created'
): Response<ApiResponse<T>> => {
  if (location) {
    res.setHeader('Location', location);
  }
  return sendSuccess(res, data, message, 201);
};

/**
 * Send a 202 Accepted response (for async operations)
 */
export const sendAccepted = <T>(
  res: Response,
  data?: T,
  message = 'Request accepted for processing'
): Response<ApiResponse<T>> => {
  return sendSuccess(res, data, message, 202);
};

export default {
  buildResponse,
  sendSuccess,
  sendError,
  sendPaginated,
  sendNoContent,
  sendCreated,
  sendAccepted,
  formatError,
  asyncHandler,
};

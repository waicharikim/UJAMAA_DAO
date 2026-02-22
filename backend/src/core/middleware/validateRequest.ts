/**
 * @file src/core/middleware/validateRequest.ts
 * @description
 * Zod Validation Middleware — Universal Request Validation
 *
 * Validates body, query, params, or context with full async support
 * Integrates with error system, logging, and geographic checks
 * PII-safe, injection-protected, with custom error messaging
 *
 * Version: 2.2 — January 2026
 * Updated: Uses centralized correlation ID generation
 */

import { NextFunction, Response } from 'express';
import { ZodSchema, ZodError } from 'zod';
import {
  AuthRequest,
  UjamaadaoValidationOptions,
  VerificationLevel,
  LocationScope,
} from '../types/Ujamaadao.types.js';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../logger/logger.js';
import { autoRedactObject, containsPII } from '../logger/log-sanitizer.js';
import { generateCorrelationId } from './errorHandler.js';

// Maximum number of validation errors to return (prevent response bloat)
const MAX_VALIDATION_ERRORS = 20;

// Maximum payload size for validation (prevent DoS)
const MAX_VALIDATION_PAYLOAD_SIZE = 1024 * 1024; // 1MB

/**
 * Sanitize validation errors for safe logging and client response
 *
 * - Removes sensitive values
 * - Truncates long messages
 * - Applies custom error messages if provided
 * - Limits number of errors
 */
function sanitizeValidationErrors(
  errors: ZodError['errors'],
  customMessages?: Record<string, string>
): Record<string, string> {
  const formatted: Record<string, string> = {};

  // Limit number of errors to prevent response bloat
  const limitedErrors = errors.slice(0, MAX_VALIDATION_ERRORS);

  for (const err of limitedErrors) {
    const path = err.path.join('.') || 'general';

    // Use custom message if provided, otherwise sanitize Zod message
    let message = customMessages?.[path] || err.message;

    // Sanitize message (remove potential PII or injection attempts)
    message = message
      .replace(/[\n\r\t]/g, ' ') // Remove newlines
      .slice(0, 200); // Truncate long messages

    formatted[path] = message;
  }

  // Indicate if errors were truncated
  if (errors.length > MAX_VALIDATION_ERRORS) {
    formatted._truncated = `... and ${errors.length - MAX_VALIDATION_ERRORS} more errors`;
  }

  return formatted;
}

/**
 * Extract payload based on validation target
 */
function extractPayload(
  req: AuthRequest,
  target: UjamaadaoValidationOptions['target']
): any {
  switch (target) {
    case 'body':
      return req.body;

    case 'query':
      return req.query;

    case 'params':
      return req.params;

    case 'context':
      return {
        user: req.user,
        geographicContext: req.geographicContext,
        economicContext: req.economicContext,
      };

    default:
      throw new Error(`Unsupported validation target: ${target}`);
  }
}

/**
 * Validate geographic context if required
 */
function validateGeographicContext(
  req: AuthRequest,
  requiredScope?: LocationScope
): void {
  const geoContext = req.geographicContext;

  if (!geoContext?.locationScope) {
    throw ApiError.geographicError(
      'Missing geographic context',
      geoContext,
      req.correlationId
    );
  }

  // If specific scope required, validate it
  if (requiredScope) {
    const scopeHierarchy: LocationScope[] = [
      'WARD',
      'CONSTITUENCY',
      'COUNTY',
      'NATIONAL',
    ];
    const userScopeIndex = scopeHierarchy.indexOf(geoContext.locationScope);
    const requiredScopeIndex = scopeHierarchy.indexOf(requiredScope);

    // User scope must be equal or narrower than required
    // (e.g., WARD user can access COUNTY endpoint, but not vice versa)
    if (userScopeIndex > requiredScopeIndex) {
      throw ApiError.insufficientGeographicScope(
        `Requires ${requiredScope} scope or narrower`,
        geoContext,
        req.correlationId
      );
    }
  }
}

/**
 * Validate verification level if specified
 */
function validateVerificationLevel(
  req: AuthRequest,
  requiredLevel?: VerificationLevel
): void {
  if (!requiredLevel) return;

  const verificationLevels: VerificationLevel[] = [
    'UNVERIFIED',
    'EMAIL_VERIFIED',
    'PHONE_VERIFIED',
    'COMMUNITY_VERIFIED',
    'LOCATION_VERIFIED',
    'FULL_VERIFIED',
  ];

  const userLevel = req.user?.verificationLevel || 'UNVERIFIED';
  const userLevelIndex = verificationLevels.indexOf(userLevel);
  const requiredLevelIndex = verificationLevels.indexOf(requiredLevel);

  if (userLevelIndex === -1 || requiredLevelIndex === -1) {
    throw ApiError.systemError(
      'Invalid verification level configuration',
      undefined,
      req.correlationId
    );
  }

  if (userLevelIndex < requiredLevelIndex) {
    throw ApiError.insufficientVerification(
      `Requires ${requiredLevel} verification`,
      requiredLevel,
      req.correlationId
    );
  }
}

/**
 * Check payload size before validation
 */
function validatePayloadSize(
  payload: any,
  target: string,
  correlationId?: string
): void {
  try {
    const payloadString = JSON.stringify(payload);
    const payloadSize = Buffer.byteLength(payloadString, 'utf8');

    if (payloadSize > MAX_VALIDATION_PAYLOAD_SIZE) {
      logger.warn(
        {
          operationType: 'SECURITY',
          metadata: {
            target,
            payloadSize,
            maxSize: MAX_VALIDATION_PAYLOAD_SIZE,
            correlationId,
          },
        },
        'Validation rejected - payload too large'
      );

      throw ApiError.badRequest(
        'Request payload too large for validation',
        { maxSize: MAX_VALIDATION_PAYLOAD_SIZE },
        correlationId
      );
    }
  } catch (error) {
    // If we can't stringify, it's probably too large or circular
    if (error instanceof ApiError) throw error;

    throw ApiError.badRequest(
      'Invalid payload structure',
      undefined,
      correlationId
    );
  }
}

/**
 * Main validation middleware factory
 */
export const validateRequest = (options: UjamaadaoValidationOptions) => {
  const {
    schema,
    target,
    verificationLevel,
    validateGeographicContext: checkGeography = false,
    geographicScope,
    logValidationFailures = true,
    customErrorMessages = {},
  } = options;

  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const requestLogger = logger.withRequestContext(req);
    const correlationId = req.correlationId || generateCorrelationId();
    req.correlationId = correlationId;

    try {
      // 1. Extract payload based on target
      const payload = extractPayload(req, target);

      // 2. Validate payload size (DoS protection)
      validatePayloadSize(payload, target, correlationId);

      // 3. Validate with Zod schema
      const result = schema.safeParse(payload);

      if (!result.success) {
        const zodError = result.error as ZodError;

        // Sanitize errors for both logging and response
        const formattedErrors = sanitizeValidationErrors(
          zodError.errors,
          customErrorMessages
        );

        if (logValidationFailures) {
          // Check if payload contains PII before logging
          const safePayload = containsPII(payload)
            ? autoRedactObject(payload)
            : payload;

          requestLogger.warn(
            {
              operationType: 'VALIDATION',
              userId: req.user?.userId,
              metadata: {
                path: req.path,
                method: req.method,
                target,
                errorCount: zodError.errors.length,
                validationErrors: formattedErrors,
                // Only log payload in development
                ...(process.env.NODE_ENV === 'development' && {
                  payload: safePayload,
                }),
              },
            },
            'Request validation failed'
          );
        }

        // Return sanitized errors to client
        const error = ApiError.validationError(
          'Validation failed',
          { errors: formattedErrors, target },
          correlationId
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      // 4. Additional verification level check if specified
      if (verificationLevel) {
        validateVerificationLevel(req, verificationLevel);
      }

      // 5. Geographic context validation if required
      if (checkGeography) {
        validateGeographicContext(req, geographicScope);
      }

      // 6. Attach validated & sanitized data back to request
      // This ensures any transformations or defaults from Zod are applied
      if (target === 'body') {
        req.body = result.data;
      } else if (target === 'query') {
        (req.query as any) = result.data;
      } else if (target === 'params') {
        (req.params as any) = result.data;
      }

      // Success - continue to next middleware
      next();
    } catch (error) {
      // Handle middleware errors
      if (error instanceof ApiError) {
        requestLogger.warn(
          {
            userId: req.user?.userId,
            metadata: {
              errorCode: error.code,
              statusCode: error.statusCode,
              correlationId,
            },
          },
          'Validation middleware rejected request'
        );
        res.status(error.statusCode).json(error.toJSON());
        return;
      }

      // Unexpected errors
      requestLogger.error(
        {
          userId: req.user?.userId,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            correlationId,
          },
        },
        'Validation middleware exception'
      );

      const apiError = ApiError.systemError(
        'Validation error',
        undefined,
        correlationId
      );
      res.status(500).json(apiError.toJSON());
    }
  };
};

/**
 * Convenience wrapper for body validation
 */
export const validateBody = (
  schema: ZodSchema,
  customMessages?: Record<string, string>
) => {
  return validateRequest({
    schema,
    target: 'body',
    customErrorMessages: customMessages,
  });
};

/**
 * Convenience wrapper for query validation
 */
export const validateQuery = (
  schema: ZodSchema,
  customMessages?: Record<string, string>
) => {
  return validateRequest({
    schema,
    target: 'query',
    customErrorMessages: customMessages,
  });
};

/**
 * Convenience wrapper for params validation
 */
export const validateParams = (
  schema: ZodSchema,
  customMessages?: Record<string, string>
) => {
  return validateRequest({
    schema,
    target: 'params',
    customErrorMessages: customMessages,
  });
};

/**
 * Validate with geographic requirements
 */
export const validateWithGeography = (
  schema: ZodSchema,
  scope?: LocationScope,
  customMessages?: Record<string, string>
) => {
  return validateRequest({
    schema,
    target: 'body',
    validateGeographicContext: true,
    geographicScope: scope,
    customErrorMessages: customMessages,
  });
};

export default validateRequest;

/**
 * @file src/core/errors/ApiError.ts
 * @description
 * Public-facing API error class with domain context
 * PII-safe, type-safe, production-ready
 *
 * Version: 2.1 — January 2026
 * Updated: Fixed type compatibility with BaseError
 */

import { BaseError, BaseErrorOptions } from './BaseError.js';
import {
  UJAMAADAO_ERROR_CODES,
  UjamaadaoErrorCode,
  isValidErrorCode,
} from './codes.js';
import { autoRedactObject, containsPII } from '../logger/log-sanitizer.js';

export interface ApiErrorOptions extends BaseErrorOptions {
  code?: UjamaadaoErrorCode;
  geographicContext?: any;
  verificationContext?: any;
  economicContext?: any;
}

/**
 * Sanitize context data for safe error responses
 */
function sanitizeContext(context: any): any {
  if (!context) return undefined;

  // Check for PII and redact
  if (containsPII(context)) {
    return autoRedactObject(context);
  }

  // For geographic context, only return scope (not exact location)
  if (context.primaryWardId || context.secondaryWardId) {
    return {
      scope: context.locationScope || 'unknown',
      hasLocation: true,
    };
  }

  // For economic context, return tier (not exact amounts)
  if (
    typeof context.participationRights === 'number' ||
    typeof context.globalImpactPoints === 'number'
  ) {
    const pr = context.participationRights || 0;
    return {
      economicTier:
        pr === 0 ? 'none' : pr < 100 ? 'low' : pr < 1000 ? 'medium' : 'high',
    };
  }

  return context;
}

export class ApiError extends BaseError {
  // Override code with proper type
  public readonly code?: UjamaadaoErrorCode;

  constructor(message: string, statusCode = 400, options?: ApiErrorOptions) {
    // Sanitize all context data
    const sanitizedDetails = {
      ...options?.details,
      ...(options?.geographicContext && {
        geographicContext: sanitizeContext(options.geographicContext),
      }),
      ...(options?.verificationContext && {
        verificationContext: sanitizeContext(options.verificationContext),
      }),
      ...(options?.economicContext && {
        economicContext: sanitizeContext(options.economicContext),
      }),
    };

    super(message, statusCode, {
      ...options,
      details: sanitizedDetails,
    });

    // Set code with proper type
    this.code = options?.code;
  }

  // ==========================================================================
  // FACTORY METHODS - VALIDATION
  // ==========================================================================

  static validationError(
    message = 'Invalid request data',
    validationDetails?: any,
    correlationId?: string
  ): ApiError {
    // Sanitize validation details (might contain user input)
    const safeDetails = validationDetails
      ? autoRedactObject({ validation: validationDetails })
      : undefined;

    return new ApiError(message, 400, {
      code: UJAMAADAO_ERROR_CODES.VALIDATION_ERROR,
      details: { ...safeDetails, type: 'REQUEST_VALIDATION_FAILED' },
      correlationId,
    });
  }

  static badRequest(
    message: string,
    details?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 400, {
      code: UJAMAADAO_ERROR_CODES.INVALID_INPUT,
      details: details ? sanitizeContext(details) : undefined,
      correlationId,
    });
  }

  // ==========================================================================
  // FACTORY METHODS - AUTHENTICATION
  // ==========================================================================

  static authenticationError(
    message = 'Authentication required',
    details?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 401, {
      code: UJAMAADAO_ERROR_CODES.AUTHENTICATION_ERROR,
      details: { type: 'AUTHENTICATION_FAILED', ...sanitizeContext(details) },
      correlationId,
    });
  }

  static invalidCredentials(
    message = 'Invalid credentials',
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 401, {
      code: UJAMAADAO_ERROR_CODES.INVALID_CREDENTIALS,
      details: { type: 'INVALID_CREDENTIALS' },
      correlationId,
    });
  }

  static tokenExpired(
    message = 'Token has expired',
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 401, {
      code: UJAMAADAO_ERROR_CODES.TOKEN_EXPIRED,
      details: { type: 'TOKEN_EXPIRED' },
      correlationId,
    });
  }

  static tokenInvalid(
    message = 'Invalid token',
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 401, {
      code: UJAMAADAO_ERROR_CODES.TOKEN_INVALID,
      details: { type: 'TOKEN_INVALID' },
      correlationId,
    });
  }

  // ==========================================================================
  // FACTORY METHODS - AUTHORIZATION
  // ==========================================================================

  static forbidden(
    message = 'Access denied',
    details?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.AUTHORIZATION_ERROR,
      details: { type: 'ACCESS_DENIED', ...sanitizeContext(details) },
      correlationId,
    });
  }

  static authorizationError(
    message = 'Insufficient permissions',
    context?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.AUTHORIZATION_ERROR,
      details: { type: 'ACCESS_DENIED', ...sanitizeContext(context) },
      correlationId,
    });
  }

  static insufficientPermissions(
    message = 'You do not have permission to perform this action',
    requiredPermissions?: string[],
    correlationId?: string
  ): ApiError {
    // Don't expose all required permissions (information leakage)
    const safePermissions =
      requiredPermissions && requiredPermissions.length > 0
        ? { hasRequirements: true, count: requiredPermissions.length }
        : undefined;

    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      details: safePermissions,
      correlationId,
    });
  }

  static insufficientVerification(
    message = 'Insufficient verification level',
    requiredLevel?: string,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.INSUFFICIENT_VERIFICATION,
      details: { requiredLevel },
      correlationId,
    });
  }

  static insufficientParticipationRights(
    message = 'Insufficient Participation Rights',
    required?: number,
    available?: number,
    correlationId?: string
  ): ApiError {
    // Don't expose exact amounts (privacy)
    const safeDetails = {
      resource: 'PARTICIPATION_RIGHTS',
      ...(required && available && { deficit: available < required }),
    };

    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.INSUFFICIENT_PARTICIPATION_RIGHTS,
      details: safeDetails,
      correlationId,
    });
  }

  // ==========================================================================
  // FACTORY METHODS - GEOGRAPHIC
  // ==========================================================================

  static geographicError(
    message = 'Geographic operation failed',
    geographicContext?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.GEOGRAPHIC_ERROR,
      geographicContext,
      correlationId,
    });
  }

  static insufficientGeographicScope(
    message = 'Insufficient geographic scope',
    context?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.INSUFFICIENT_GEOGRAPHIC_SCOPE,
      geographicContext: context,
      correlationId,
    });
  }

  static geographicMismatch(
    message = 'Geographic identifier mismatch',
    context?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.GEOGRAPHIC_IDENTIFIER_MISMATCH,
      geographicContext: context,
      correlationId,
    });
  }

  // ==========================================================================
  // FACTORY METHODS - ECONOMIC
  // ==========================================================================

  static economicError(
    message = 'Economic operation failed',
    economicContext?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.ECONOMIC_ERROR,
      economicContext,
      correlationId,
    });
  }

  static insufficientTokens(
    message = 'Insufficient tokens',
    required?: number,
    available?: number,
    correlationId?: string
  ): ApiError {
    const safeDetails = {
      ...(required && available && { deficit: available < required }),
    };

    return new ApiError(message, 403, {
      code: UJAMAADAO_ERROR_CODES.INSUFFICIENT_TOKENS,
      details: safeDetails,
      correlationId,
    });
  }

  static transactionFailed(
    message = 'Transaction failed',
    details?: any,
    correlationId?: string
  ): ApiError {
    const safeDetails =
      process.env.NODE_ENV === 'production'
        ? { type: 'TRANSACTION_FAILED' }
        : sanitizeContext(details);

    return new ApiError(message, 500, {
      code: UJAMAADAO_ERROR_CODES.TRANSACTION_FAILED,
      details: safeDetails,
      correlationId,
    });
  }

  static walletError(
    message = 'Wallet error',
    details?: any,
    correlationId?: string
  ): ApiError {
    const safeDetails =
      process.env.NODE_ENV === 'production'
        ? { type: 'WALLET_ERROR' }
        : sanitizeContext(details);

    return new ApiError(message, 500, {
      code: UJAMAADAO_ERROR_CODES.WALLET_ERROR,
      details: safeDetails,
      correlationId,
    });
  }

  // ==========================================================================
  // FACTORY METHODS - RESOURCE
  // ==========================================================================

  static notFound(
    resource = 'Resource',
    identifier?: string,
    correlationId?: string
  ): ApiError {
    const message = `${resource} not found`;

    return new ApiError(message, 404, {
      code: UJAMAADAO_ERROR_CODES.NOT_FOUND,
      details: { resource },
      correlationId,
    });
  }

  static conflict(
    message = 'Resource conflict',
    conflictDetails?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 409, {
      code: UJAMAADAO_ERROR_CODES.CONFLICT,
      details: sanitizeContext(conflictDetails),
      correlationId,
    });
  }

  static duplicateResource(
    message = 'Resource already exists',
    resource?: string,
    identifier?: string,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 409, {
      code: UJAMAADAO_ERROR_CODES.DUPLICATE_RESOURCE,
      details: { resource },
      correlationId,
    });
  }

  // ==========================================================================
  // FACTORY METHODS - SYSTEM
  // ==========================================================================

  static rateLimitError(
    message = 'Rate limit exceeded',
    retryAfter?: number,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 429, {
      code: UJAMAADAO_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      details: { retryAfter: retryAfter ? Math.ceil(retryAfter) : undefined },
      correlationId,
    });
  }

  static tooManyRequests(
    retryAfter?: number,
    correlationId?: string
  ): ApiError {
    const message = retryAfter
      ? `Too many requests. Please retry after ${Math.ceil(retryAfter)} seconds`
      : 'Too many requests. Please try again later';
    return ApiError.rateLimitError(message, retryAfter, correlationId);
  }

  static systemError(
    message = 'Internal system error',
    systemDetails?: any,
    correlationId?: string
  ): ApiError {
    const safeDetails =
      process.env.NODE_ENV === 'production'
        ? undefined
        : sanitizeContext(systemDetails);

    return new ApiError(message, 500, {
      code: UJAMAADAO_ERROR_CODES.SYSTEM_ERROR,
      details: safeDetails,
      correlationId,
    });
  }

  static databaseError(
    message = 'Database error',
    details?: any,
    correlationId?: string
  ): ApiError {
    const safeDetails =
      process.env.NODE_ENV === 'production'
        ? undefined
        : sanitizeContext(details);

    return new ApiError(message, 500, {
      code: UJAMAADAO_ERROR_CODES.DATABASE_ERROR,
      details: safeDetails,
      correlationId,
    });
  }

  static externalServiceError(
    message = 'External service error',
    serviceName?: string,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 502, {
      code: UJAMAADAO_ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      details: { serviceName },
      correlationId,
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  static fromError(
    err: unknown,
    overrides?: Partial<ApiErrorOptions>
  ): ApiError {
    if (err instanceof ApiError) return err;

    if (err instanceof BaseError) {
      // Type-safe conversion from BaseError
      const code =
        err.code && isValidErrorCode(err.code)
          ? (err.code as UjamaadaoErrorCode)
          : UJAMAADAO_ERROR_CODES.SYSTEM_ERROR;

      return new ApiError(err.message, err.statusCode, {
        code,
        details: sanitizeContext(err.details),
        correlationId: err.correlationId || overrides?.correlationId,
        cause: err.cause,
        ...overrides,
      });
    }

    // Handle standard Error objects
    if (err instanceof Error) {
      const safeMessage = err.message.slice(0, 200);
      return ApiError.systemError(
        safeMessage,
        process.env.NODE_ENV === 'production'
          ? undefined
          : { original: err.message },
        overrides?.correlationId
      );
    }

    // Unknown error type
    return ApiError.systemError(
      'Unexpected error',
      undefined,
      overrides?.correlationId
    );
  }

  /**
   * Check if an error is a specific type
   */
  static isAuthenticationError(err: unknown): boolean {
    return err instanceof ApiError && err.statusCode === 401;
  }

  static isAuthorizationError(err: unknown): boolean {
    return err instanceof ApiError && err.statusCode === 403;
  }

  static isNotFoundError(err: unknown): boolean {
    return err instanceof ApiError && err.statusCode === 404;
  }

  static isValidationError(err: unknown): boolean {
    return (
      err instanceof ApiError &&
      err.code === UJAMAADAO_ERROR_CODES.VALIDATION_ERROR
    );
  }

  static isRateLimitError(err: unknown): boolean {
    return (
      err instanceof ApiError &&
      err.code === UJAMAADAO_ERROR_CODES.RATE_LIMIT_EXCEEDED
    );
  }

  static isServerError(err: unknown): boolean {
    return err instanceof ApiError && err.statusCode >= 500;
  }
}

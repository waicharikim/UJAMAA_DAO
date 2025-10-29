/**
 * @file src/core/ApiError.ts
 * UJAMAADAO Enhanced Custom Error Class for API Errors
 */

export class ApiError extends Error {
  statusCode: number;
  details?: Record<string, any>;
  code?: string;
  timestamp: Date;
  correlationId?: string;

  constructor(
    message: string,
    statusCode: number = 400,
    options?: {
      details?: Record<string, any>;
      code?: string;
      correlationId?: string;
      geographicContext?: any;
      verificationContext?: any;
      economicContext?: any;
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.timestamp = new Date();

    if (options) {
      this.details = this.buildEnhancedDetails(options);
      this.code = options.code;
      this.correlationId = options.correlationId;
    }

    Object.setPrototypeOf(this, ApiError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  private buildEnhancedDetails(options: {
    details?: Record<string, any>;
    geographicContext?: any;
    verificationContext?: any;
    economicContext?: any;
  }): Record<string, any> {
    const enhancedDetails: Record<string, any> = {
      ...options.details,
      timestamp: this.timestamp.toISOString()
    };

    if (options.geographicContext) enhancedDetails.geographicContext = options.geographicContext;
    if (options.verificationContext) enhancedDetails.verificationContext = options.verificationContext;
    if (options.economicContext) enhancedDetails.economicContext = options.economicContext;

    return enhancedDetails;
  }

  toJSON(): Record<string, any> {
    return {
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(this.code && { code: this.code }),
      ...(this.details && { details: this.details }),
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }

  static validationError(message = 'Invalid request data', validationDetails?: any, correlationId?: string): ApiError {
    return new ApiError(message, 400, {
      code: 'VALIDATION_ERROR',
      details: { validation: validationDetails, type: 'REQUEST_VALIDATION_FAILED' },
      correlationId
    });
  }

  static authenticationError(message = 'Authentication required', verificationContext?: any, correlationId?: string): ApiError {
    return new ApiError(message, 401, {
      code: 'AUTHENTICATION_ERROR',
      details: { type: 'AUTHENTICATION_FAILED', ...(verificationContext && { verificationContext }) },
      correlationId
    });
  }

  static authorizationError(message = 'Insufficient permissions', context?: any, correlationId?: string): ApiError {
    return new ApiError(message, 403, {
      code: 'AUTHORIZATION_ERROR',
      details: { type: 'ACCESS_DENIED', ...context },
      correlationId
    });
  }

  static geographicError(message = 'Geographic operation failed', geographicContext?: any, correlationId?: string): ApiError {
    return new ApiError(message, 403, {
      code: 'GEOGRAPHIC_ERROR',
      details: { type: 'GEOGRAPHIC_OPERATION_FAILED', geographicContext },
      correlationId
    });
  }

  static economicError(message = 'Economic operation failed', economicContext?: any, correlationId?: string): ApiError {
    return new ApiError(message, 403, {
      code: 'ECONOMIC_ERROR',
      details: { type: 'ECONOMIC_OPERATION_FAILED', economicContext },
      correlationId
    });
  }

  static notFoundError(resource = 'Resource', identifier?: string, correlationId?: string): ApiError {
    const message = identifier ? `${resource} with identifier '${identifier}' not found` : `${resource} not found`;
    return new ApiError(message, 404, {
      code: 'NOT_FOUND',
      details: { resource, ...(identifier && { identifier }) },
      correlationId
    });
  }

  static conflictError(message = 'Resource conflict', conflictDetails?: any, correlationId?: string): ApiError {
    return new ApiError(message, 409, { code: 'CONFLICT', details: conflictDetails, correlationId });
  }

  static systemError(message = 'Internal system error', systemDetails?: any, correlationId?: string): ApiError {
    return new ApiError(message, 500, { code: 'SYSTEM_ERROR', details: systemDetails, correlationId });
  }
}

export const UJAMAADAO_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INSUFFICIENT_VERIFICATION: 'INSUFFICIENT_VERIFICATION',
  INSUFFICIENT_IMPACT_POINTS: 'INSUFFICIENT_IMPACT_POINTS',
  GEOGRAPHIC_ERROR: 'GEOGRAPHIC_ERROR',
  INSUFFICIENT_GEOGRAPHIC_SCOPE: 'INSUFFICIENT_GEOGRAPHIC_SCOPE',
  GEOGRAPHIC_IDENTIFIER_MISMATCH: 'GEOGRAPHIC_IDENTIFIER_MISMATCH',
  MISSING_GEOGRAPHIC_CONTEXT: 'MISSING_GEOGRAPHIC_CONTEXT',
  ECONOMIC_ERROR: 'ECONOMIC_ERROR',
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  WALLET_ERROR: 'WALLET_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

export type UjamaadaoErrorCode = typeof UJAMAADAO_ERROR_CODES[keyof typeof UJAMAADAO_ERROR_CODES];

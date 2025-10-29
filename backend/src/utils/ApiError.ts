/**
 * @file ApiError.ts
 * 
 * @description
 * UJAMAADAO Enhanced Custom Error Class for API Errors
 * 
 * Extended error class for the UJAMAADAO platform that includes:
 * - HTTP status codes for API responses
 * - Structured error details for client handling
 * - Geographic context for location-based errors
 * - Verification level context for access control errors
 * - Economic system context for token and impact point errors
 * - Error codes for consistent client error handling
 * - Timestamp and request correlation for debugging
 * 
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Error details object for structured error responses
 * - Geographic context in errors for location-based operations
 * - Verification level context for progressive access control
 * - Economic system context for token and impact point errors
 * - Error codes for consistent client-side error handling
 * - Request correlation for distributed tracing
 * 
 * Error Categories in UJAMAADAO:
 * - VALIDATION_ERROR: Request data validation failures
 * - AUTHENTICATION_ERROR: Authentication and verification failures
 * - AUTHORIZATION_ERROR: Permission and access control failures
 * - GEOGRAPHIC_ERROR: Location-based operation failures
 * - ECONOMIC_ERROR: Token and impact point operation failures
 * - BUSINESS_LOGIC_ERROR: Community governance rule violations
 * - SYSTEM_ERROR: Platform and infrastructure failures
 */

export class ApiError extends Error {
  /** HTTP status code for the error response */
  statusCode: number;
  
  /** UJAMAADAO ENHANCEMENT: Structured error details for client handling */
  details?: Record<string, any>;
  
  /** UJAMAADAO ENHANCEMENT: Error code for consistent client error handling */
  code?: string;
  
  /** UJAMAADAO ENHANCEMENT: Timestamp when error occurred */
  timestamp: Date;
  
  /** UJAMAADAO ENHANCEMENT: Request correlation ID for distributed tracing */
  correlationId?: string;

  /**
   * Constructs an UJAMAADAO Enhanced ApiError instance.
   * 
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default: 400)
   * @param options - UJAMAADAO enhanced error options
   * @param options.details - Structured error details for client handling
   * @param options.code - Error code for consistent client error handling
   * @param options.correlationId - Request correlation ID for distributed tracing
   * @param options.geographicContext - Geographic context for location-based errors
   * @param options.verificationContext - Verification level context for access errors
   * @param options.economicContext - Economic system context for token errors
   * 
   * @example
   * // Basic error
   * throw new ApiError('User not found', 404);
   * 
   * @example
   * // Validation error with details
   * throw new ApiError('Invalid request data', 400, {
   *   code: 'VALIDATION_ERROR',
   *   details: {
   *     field: 'email',
   *     issue: 'Invalid email format',
   *     expected: 'user@example.com'
   *   }
   * });
   * 
   * @example
   * // Geographic error with context
   * throw new ApiError('Insufficient geographic scope', 403, {
   *   code: 'INSUFFICIENT_GEOGRAPHIC_SCOPE',
   *   details: {
   *     requiredScope: 'COUNTY',
   *     userScope: 'WARD',
   *     userWardId: 'ward-123'
   *   }
   * });
   * 
   * @example
   * // Verification level error
   * throw new ApiError('Insufficient verification level', 403, {
   *   code: 'INSUFFICIENT_VERIFICATION',
   *   details: {
   *     requiredLevel: 'FULLY_VERIFIED',
   *     userLevel: 'PHONE_VERIFIED',
   *     hierarchy: {
   *       UNVERIFIED: 0,
   *       PHONE_VERIFIED: 1,
   *       COMMUNITY_VERIFIED: 2,
   *       FULLY_VERIFIED: 3
   *     }
   *   }
   * });
   * 
   * @example
   * // Economic system error
   * throw new ApiError('Insufficient impact points', 403, {
   *   code: 'INSUFFICIENT_IMPACT_POINTS',
   *   details: {
   *     requiredPoints: 100,
   *     userPoints: 45,
   *     operation: 'PROPOSAL_CREATION'
   *   }
   * });
   */
  constructor(
    message: string, 
    statusCode: number = 400,
    options?: {
      details?: Record<string, any>;
      code?: string;
      correlationId?: string;
      geographicContext?: {
        primaryWardId?: string;
        constituencyId?: string;
        countyId?: string;
        requiredScope?: string;
        userScope?: string;
      };
      verificationContext?: {
        requiredLevel?: string;
        userLevel?: string;
        hierarchy?: Record<string, number>;
      };
      economicContext?: {
        requiredPoints?: number;
        userPoints?: number;
        requiredTokens?: number;
        userTokens?: number;
        operation?: string;
      };
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.timestamp = new Date();
    
    // UJAMAADAO ENHANCEMENT: Apply enhanced error options
    if (options) {
      this.details = this.buildEnhancedDetails(options);
      this.code = options.code;
      this.correlationId = options.correlationId;
    }

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
    
    // Capture stack trace (excluding constructor call)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * UJAMAADAO ENHANCEMENT: Build Enhanced Error Details
   * 
   * Constructs a comprehensive error details object that includes
   * UJAMAADAO-specific context for geographic, verification, and economic errors.
   * 
   * @param options - Error options with UJAMAADAO context
   * @returns Enhanced error details object
   */
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

    // UJAMAADAO: Add geographic context if provided
    if (options.geographicContext) {
      enhancedDetails.geographicContext = options.geographicContext;
    }

    // UJAMAADAO: Add verification context if provided
    if (options.verificationContext) {
      enhancedDetails.verificationContext = options.verificationContext;
    }

    // UJAMAADAO: Add economic context if provided
    if (options.economicContext) {
      enhancedDetails.economicContext = options.economicContext;
    }

    return enhancedDetails;
  }

  /**
   * UJAMAADAO ENHANCEMENT: Convert to JSON for API Responses
   * 
   * Serializes the error to a consistent JSON format for API responses
   * that includes all UJAMAADAO-enhanced error information.
   * 
   * @returns JSON-serializable error object
   */
  toJSON(): Record<string, any> {
    return {
      // Standard error properties
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      
      // UJAMAADAO enhanced properties
      ...(this.code && { code: this.code }),
      ...(this.details && { details: this.details }),
      ...(this.correlationId && { correlationId: this.correlationId }),
      
      // Stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }

  /**
   * UJAMAADAO UTILITY: Create Validation Error
   * 
   * Factory method for creating validation errors with consistent structure
   * for the UJAMAADAO platform.
   * 
   * @param message - Validation error message
   * @param validationDetails - Zod issues or validation details
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for validation failures
   */
  static validationError(
    message: string = 'Invalid request data',
    validationDetails?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 400, {
      code: 'VALIDATION_ERROR',
      details: {
        validation: validationDetails,
        type: 'REQUEST_VALIDATION_FAILED'
      },
      correlationId
    });
  }

  /**
   * UJAMAADAO UTILITY: Create Authentication Error
   * 
   * Factory method for creating authentication errors with consistent structure
   * for the UJAMAADAO platform.
   * 
   * @param message - Authentication error message
   * @param verificationContext - Verification level context
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for authentication failures
   */
  static authenticationError(
    message: string = 'Authentication required',
    verificationContext?: {
      requiredLevel?: string;
      userLevel?: string;
    },
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 401, {
      code: 'AUTHENTICATION_ERROR',
      details: {
        type: 'AUTHENTICATION_FAILED',
        ...(verificationContext && { verificationContext })
      },
      correlationId
    });
  }

  /**
   * UJAMAADAO UTILITY: Create Authorization Error
   * 
   * Factory method for creating authorization errors with consistent structure
   * for the UJAMAADAO platform, including geographic and verification context.
   * 
   * @param message - Authorization error message
   * @param context - Authorization context (geographic, verification, economic)
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for authorization failures
   */
  static authorizationError(
    message: string = 'Insufficient permissions',
    context?: {
      geographicContext?: any;
      verificationContext?: any;
      economicContext?: any;
      requiredRoles?: string[];
      userRoles?: string[];
    },
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: 'AUTHORIZATION_ERROR',
      details: {
        type: 'ACCESS_DENIED',
        ...context
      },
      correlationId
    });
  }

  /**
   * UJAMAADAO UTILITY: Create Geographic Error
   * 
   * Factory method for creating geographic errors with consistent structure
   * for the UJAMAADAO platform's location-based governance system.
   * 
   * @param message - Geographic error message
   * @param geographicContext - Geographic context details
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for geographic operation failures
   */
  static geographicError(
    message: string = 'Geographic operation failed',
    geographicContext?: {
      primaryWardId?: string;
      constituencyId?: string;
      countyId?: string;
      requiredScope?: string;
      userScope?: string;
      operation?: string;
    },
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: 'GEOGRAPHIC_ERROR',
      details: {
        type: 'GEOGRAPHIC_OPERATION_FAILED',
        geographicContext
      },
      correlationId
    });
  }

  /**
   * UJAMAADAO UTILITY: Create Economic Error
   * 
   * Factory method for creating economic system errors with consistent structure
   * for the UJAMAADAO platform's dual-token economic system.
   * 
   * @param message - Economic error message
   * @param economicContext - Economic context details
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for economic operation failures
   */
  static economicError(
    message: string = 'Economic operation failed',
    economicContext?: {
      requiredPoints?: number;
      userPoints?: number;
      requiredTokens?: number;
      userTokens?: number;
      operation?: string;
      resource?: string;
    },
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 403, {
      code: 'ECONOMIC_ERROR',
      details: {
        type: 'ECONOMIC_OPERATION_FAILED',
        economicContext
      },
      correlationId
    });
  }

  /**
   * UJAMAADAO UTILITY: Create Not Found Error
   * 
   * Factory method for creating not found errors with consistent structure
   * for the UJAMAADAO platform.
   * 
   * @param resource - Resource type that was not found
   * @param identifier - Resource identifier that was not found
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for resource not found
   */
  static notFoundError(
    resource: string = 'Resource',
    identifier?: string,
    correlationId?: string
  ): ApiError {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    return new ApiError(message, 404, {
      code: 'NOT_FOUND',
      details: {
        resource,
        ...(identifier && { identifier })
      },
      correlationId
    });
  }

  /**
   * UJAMAADAO UTILITY: Create Conflict Error
   * 
   * Factory method for creating conflict errors with consistent structure
   * for the UJAMAADAO platform.
   * 
   * @param message - Conflict error message
   * @param conflictDetails - Details about the conflict
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for conflict situations
   */
  static conflictError(
    message: string = 'Resource conflict',
    conflictDetails?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 409, {
      code: 'CONFLICT',
      details: conflictDetails,
      correlationId
    });
  }

  /**
   * UJAMAADAO UTILITY: Create System Error
   * 
   * Factory method for creating system errors with consistent structure
   * for the UJAMAADAO platform.
   * 
   * @param message - System error message
   * @param systemDetails - System error details
   * @param correlationId - Request correlation ID
   * @returns ApiError instance for system failures
   */
  static systemError(
    message: string = 'Internal system error',
    systemDetails?: any,
    correlationId?: string
  ): ApiError {
    return new ApiError(message, 500, {
      code: 'SYSTEM_ERROR',
      details: systemDetails,
      correlationId
    });
  }
}

/**
 * UJAMAADAO ERROR CODES
 * 
 * Standardized error codes for consistent error handling across the platform.
 */
export const UJAMAADAO_ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Authentication errors
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // Authorization errors
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INSUFFICIENT_VERIFICATION: 'INSUFFICIENT_VERIFICATION',
  INSUFFICIENT_IMPACT_POINTS: 'INSUFFICIENT_IMPACT_POINTS',
  
  // Geographic errors
  GEOGRAPHIC_ERROR: 'GEOGRAPHIC_ERROR',
  INSUFFICIENT_GEOGRAPHIC_SCOPE: 'INSUFFICIENT_GEOGRAPHIC_SCOPE',
  GEOGRAPHIC_IDENTIFIER_MISMATCH: 'GEOGRAPHIC_IDENTIFIER_MISMATCH',
  MISSING_GEOGRAPHIC_CONTEXT: 'MISSING_GEOGRAPHIC_CONTEXT',
  
  // Economic errors
  ECONOMIC_ERROR: 'ECONOMIC_ERROR',
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  WALLET_ERROR: 'WALLET_ERROR',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  
  // System errors
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

/**
 * Type for UJAMAADAO error codes
 */
export type UjamaadaoErrorCode = typeof UJAMAADAO_ERROR_CODES[keyof typeof UJAMAADAO_ERROR_CODES];
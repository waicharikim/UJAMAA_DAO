/**
 * @file validateRequest.ts
 * * @description
 * UJAMAADAO Enhanced Request Validation Middleware with Zod
 * * Advanced request validation system for the UJAMAADAO platform that provides:
 * - Geographic context validation (ward, constituency, county hierarchies)
 * - Verification level integration for progressive access control
 * - Economic system validations (impact points, token amounts, voting weights)
 * - Community governance-specific validation rules
 * - Location-based resource access validation
 * - Enhanced error messages for community platform users
 * * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic hierarchy validation (ward → constituency → county → national)
 * - Verification level requirements in schema validation
 * - Economic system validations (impact points, utility tokens, participation rights)
 * - Community governance rule enforcement
 * - Location-scoped resource access validation
 * - Enhanced error messages with community context
 * * Validation Targets:
 * - Body: Request payload data (create, update operations)
 * - Params: URL parameters (resource identifiers, geographic IDs)
 * - Query: URL query parameters (filtering, pagination, geographic scoping)
 * - Context: UJAMAADAO-specific context (user, geographic, verification data)
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import type { AuthRequest } from './auth.middleware.js';

/**
 * UJAMAADAO Validation Options
 * * Enhanced validation configuration for the community governance platform
 * that includes geographic context, verification levels, and economic system
 * considerations.
 */
interface UjamaadaoValidationOptions {
  /** Zod schema for validation */
  schema: ZodSchema;
  /** Target of validation (body, params, query, or context) */
  target?: 'body' | 'params' | 'query' | 'context';
  /** UJAMAADAO: Required verification level for this operation */
  // CRITICAL FIX: Changed 'FULLY_VERIFIED' to 'FULL_VERIFIED'
  requiredVerificationLevel?: 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULL_VERIFIED';
  /** UJAMAADAO: Geographic scope requirement */
  geographicScope?: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';
  /** UJAMAADAO: Whether to validate geographic context consistency */
  validateGeographicContext?: boolean;
  /** UJAMAADAO: Custom error messages for community users */
  customErrorMessages?: Record<string, string>;
  /** UJAMAADAO: Whether to log validation failures for monitoring */
  logValidationFailures?: boolean;
}

/**
 * UJAMAADAO Enhanced Validation Middleware
 * * Advanced request validation that incorporates UJAMAADAO-specific business rules,
 * geographic context validation, and verification level checks alongside standard
 * Zod schema validation.
 * * Enhanced Features:
 * 1. GEOGRAPHIC CONTEXT VALIDATION: Ensures requests align with user's geographic
 * hierarchy and location-based permissions
 * * 2. VERIFICATION LEVEL INTEGRATION: Validates that users meet required verification
 * levels for sensitive operations
 * * 3. ECONOMIC SYSTEM VALIDATION: Validates economic parameters (impact points,
 * token amounts, voting weights) according to platform rules
 * * 4. COMMUNITY GOVERNANCE RULES: Enforces community-specific business rules and
 * validation logic
 * * 5. ENHANCED ERROR HANDLING: Provides community-friendly error messages and
 * comprehensive logging for platform monitoring
 * * @param options - UJAMAADAO validation configuration
 * @returns Express middleware function with enhanced validation
 * * @example
 * // Basic request body validation
 * router.post('/api/users', 
 * validateRequest({
 * schema: createUserSchema,
 * target: 'body'
 * }),
 * userController.create
 * );
 * * @example
 * // Geographic context validation for ward operations
 * router.post('/api/wards/:wardId/proposals',
 * authMiddleware,
 * validateRequest({
 * schema: createProposalSchema,
 * target: 'body',
 * requiredVerificationLevel: 'COMMUNITY_VERIFIED',
 * geographicScope: 'WARD',
 * validateGeographicContext: true
 * }),
 * proposalController.create
 * );
 * * @example
 * // Economic system validation with impact points
 * router.post('/api/marketplace/listings',
 * authMiddleware,
 * validateRequest({
 * schema: createListingSchema,
 * target: 'body',
 * requiredVerificationLevel: 'COMMUNITY_VERIFIED',
 * customErrorMessages: {
 * 'price.too_small': 'Listing price must be at least 10 Utility Tokens',
 * 'quantity.invalid': 'Quantity must be at least 1'
 * }
 * }),
 * marketplaceController.createListing
 * );
 * * @example
 * // Context validation for user operations
 * router.get('/api/users/me',
 * authMiddleware,
 * validateRequest({
 * schema: userContextSchema,
 * target: 'context' // Validates req.user and req.geographicContext
 * }),
 * userController.getProfile
 * );
 */
export function validateRequest(options: UjamaadaoValidationOptions) {
  const {
    schema,
    target = 'body',
    requiredVerificationLevel,
    geographicScope,
    validateGeographicContext = false,
    customErrorMessages = {},
    logValidationFailures = true
  } = options;

  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;

    try {
      /**
       * UJAMAADAO PRE-VALIDATION: Verification Level Check
       * * Validate that user meets required verification level before
       * proceeding with schema validation. This provides early rejection
       * for unauthorized operations.
       */
      if (requiredVerificationLevel) {
        validateVerificationLevel(authReq, requiredVerificationLevel);
      }

      /**
       * UJAMAADAO PRE-VALIDATION: Geographic Scope Check
       * * Validate that the request aligns with the required geographic scope
       * and that the user has appropriate geographic context.
       */
      if (geographicScope) {
        validateGeographicScope(authReq, geographicScope);
      }

      /**
       * UJAMAADAO PRE-VALIDATION: Geographic Context Consistency
       * * Ensure that geographic identifiers in the request match the user's
       * geographic context to prevent cross-boundary operations.
       */
      if (validateGeographicContext) {
        validateGeographicContextConsistency(authReq, req[target]);
      }

      /**
       * UJAMAADAO CONTEXT VALIDATION
       * * Special handling for context validation that combines user data
       * and geographic context into a single validation object.
       */
      let dataToValidate;
      if (target === 'context') {
        dataToValidate = buildContextValidationObject(authReq);
      } else {
        dataToValidate = req[target];
      }

      /**
       * ZOD SCHEMA VALIDATION
       * * Perform the core Zod schema validation with UJAMAADAO-enhanced
       * error handling and custom error messages.
       */
      const parsed = schema.parse(dataToValidate);

      /**
       * UJAMAADAO POST-VALIDATION: Write Back Normalized Data
       * * Write the normalized/parsed data back to the request object.
       * This is essential when the schema includes transformations or
       * coersions for UJAMAADAO business logic.
       */
      if (target === 'context') {
        // For context validation, we might update the request context
        updateRequestContext(authReq, parsed);
      } else {
        req[target] = parsed;
      }

      /**
       * UJAMAADAO VALIDATION SUCCESS LOGGING
       * * Log successful validations for platform monitoring and audit trails,
       * especially for sensitive operations in the community governance system.
       */
      if (logValidationFailures) {
        logger.debug('UJAMAADAO Validation: Request validation successful', {
          path: req.path,
          method: req.method,
          target,
          userId: authReq.user?.userId,
          verificationLevel: authReq.user?.verificationLevel,
          geographicScope: authReq.geographicContext?.locationScope
        });
      }

      next();

    } catch (error: unknown) {
      /**
       * UJAMAADAO ENHANCED ERROR HANDLING
       * * Comprehensive error handling that provides community-friendly error
       * messages and detailed logging for platform monitoring.
       */
      handleValidationError(error, req, options, authReq);
    }
  };
}

/**
 * Validate Verification Level for UJAMAADAO Operations
 * * Ensures that the user meets the required verification level for the
 * requested operation in the community governance platform.
 * * @param authReq - Authenticated request with user context
 * @param requiredLevel - Required verification level for the operation
 * @throws ApiError if verification level is insufficient
 */
function validateVerificationLevel(authReq: AuthRequest, requiredLevel: string): void {
  // CRITICAL FIX: Changed 'FULLY_VERIFIED' to 'FULL_VERIFIED'
  const verificationHierarchy = {
    'UNVERIFIED': 0,
    'PHONE_VERIFIED': 1,
    'COMMUNITY_VERIFIED': 2,
    'FULL_VERIFIED': 3
  };

  const userLevel = authReq.user?.verificationLevel || 'UNVERIFIED';
  const userLevelValue = verificationHierarchy[userLevel as keyof typeof verificationHierarchy] || 0;
  const requiredLevelValue = verificationHierarchy[requiredLevel as keyof typeof verificationHierarchy];

  if (userLevelValue < requiredLevelValue) {
    throw new ApiError(
      `Insufficient verification level. Required: ${requiredLevel}, Current: ${userLevel}`,
      403,
      {
        code: 'INSUFFICIENT_VERIFICATION',
        requiredLevel,
        userLevel,
        hierarchy: verificationHierarchy
      }
    );
  }
}

/**
 * Validate Geographic Scope for UJAMAADAO Operations
 * * Ensures that the request aligns with the required geographic scope
 * and that the user has appropriate geographic context.
 * * @param authReq - Authenticated request with geographic context
 * @param requiredScope - Required geographic scope for the operation
 * @throws ApiError if geographic scope is insufficient or missing
 */
function validateGeographicScope(authReq: AuthRequest, requiredScope: string): void {
  if (!authReq.geographicContext) {
    throw new ApiError(
      'Geographic context required for this operation',
      403,
      { code: 'MISSING_GEOGRAPHIC_CONTEXT' }
    );
  }

  const scopeHierarchy = {
    'WARD': 1,
    'CONSTITUENCY': 2,
    'COUNTY': 3,
    'NATIONAL': 4
  };

  // UJAMAADAO PRINCIPLE: Users primarily operate at ward level
  // Higher-level access requires explicit role assignments
  if (scopeHierarchy[requiredScope as keyof typeof scopeHierarchy] > scopeHierarchy.WARD) {
    throw new ApiError(
      `Insufficient geographic scope. Required: ${requiredScope}, Available: WARD`,
      403,
      { 
        code: 'INSUFFICIENT_GEOGRAPHIC_SCOPE',
        requiredScope,
        availableScope: 'WARD'
      }
    );
  }
}

/**
 * Validate Geographic Context Consistency
 * * Ensures that geographic identifiers in the request match the user's
 * geographic context to prevent cross-boundary operations in the
 * community governance platform.
 * * @param authReq - Authenticated request with geographic context
 * @param requestData - Request data being validated
 * @throws ApiError if geographic context is inconsistent
 */
function validateGeographicContextConsistency(authReq: AuthRequest, requestData: any): void {
  if (!authReq.geographicContext) return;

  const geographicFields = ['wardId', 'constituencyId', 'countyId', 'primaryWardId'];
  
  for (const field of geographicFields) {
    if (requestData[field] && authReq.geographicContext[field as keyof typeof authReq.geographicContext]) {
      const requestValue = requestData[field];
      const contextValue = authReq.geographicContext[field as keyof typeof authReq.geographicContext];
      
      if (requestValue !== contextValue) {
        throw new ApiError(
          `Geographic identifier mismatch for ${field}. Request: ${requestValue}, Context: ${contextValue}`,
          403,
          {
            code: 'GEOGRAPHIC_IDENTIFIER_MISMATCH',
            field,
            requestValue,
            contextValue
          }
        );
      }
    }
  }
}

/**
 * Build Context Validation Object for UJAMAADAO
 * * Combines user data and geographic context into a single object
 * for comprehensive context validation in the community governance platform.
 * * @param authReq - Authenticated request with UJAMAADAO context
 * @returns Combined context object for validation
 */
function buildContextValidationObject(authReq: AuthRequest): any {
  return {
    user: authReq.user ? {
      userId: authReq.user.userId,
      walletAddress: authReq.user.walletAddress,
      primaryWardId: authReq.user.primaryWardId,
      secondaryWardId: authReq.user.secondaryWardId,
      phoneVerified: authReq.user.phoneVerified,
      communityVerified: authReq.user.communityVerified,
      locationVerified: authReq.user.locationVerified,
      globalImpactPoints: authReq.user.globalImpactPoints,
      utilityTokens: authReq.user.utilityTokens,
      verificationLevel: authReq.user.verificationLevel
    } : undefined,
    
    geographicContext: authReq.geographicContext ? {
      primaryWardId: authReq.geographicContext.primaryWardId,
      constituencyId: authReq.geographicContext.constituencyId,
      countyId: authReq.geographicContext.countyId,
      locationScope: authReq.geographicContext.locationScope
    } : undefined,
    
    userRoles: authReq.userRoles?.map(role => ({
      role: role.role,
      scope: role.scope
    }))
  };
}

/**
 * Update Request Context with Validated Data
 * * Updates the request context with validated and normalized data
 * from the context validation process.
 * * @param authReq - Authenticated request to update
 * @param validatedContext - Validated context data
 */
function updateRequestContext(authReq: AuthRequest, validatedContext: any): void {
  // Update user context if validated
  if (validatedContext.user) {
    authReq.user = {
      ...authReq.user,
      ...validatedContext.user
    };
  }
  
  // Update geographic context if validated
  if (validatedContext.geographicContext) {
    authReq.geographicContext = {
      ...authReq.geographicContext,
      ...validatedContext.geographicContext
    };
  }
  
  // Update user roles if validated
  if (validatedContext.userRoles) {
    authReq.userRoles = validatedContext.userRoles;
  }
}

/**
 * Handle Validation Error with UJAMAADAO Enhancements
 * * Comprehensive error handling that provides community-friendly error
 * messages and detailed logging for the community governance platform.
 * * @param error - Validation error object
 * @param req - Express request object
 * @param options - Validation options
 * @param authReq - Authenticated request context
 */
function handleValidationError(
  error: unknown,
  req: Request,
  options: UjamaadaoValidationOptions,
  authReq: AuthRequest
): void {
  const { logValidationFailures, customErrorMessages } = options;

  // UJAMAADAO ERROR LOGGING: Log validation failures for monitoring
  if (logValidationFailures) {
    logger.warn('UJAMAADAO Validation: Request validation failed', {
      path: req.path,
      method: req.method,
      target: options.target,
      userId: authReq.user?.userId,
      verificationLevel: authReq.user?.verificationLevel,
      error: error instanceof Error ? error.message : String(error),
      geographicContext: authReq.geographicContext
    });
  }

  // ZOD ERROR HANDLING: Enhanced Zod error processing
  if (isZodError(error)) {
    const enhancedError = enhanceZodError(error, customErrorMessages);
    
    // UJAMAADAO ERROR ENRICHMENT: Add platform context to error
    const apiError = new ApiError(
      'Invalid request data',
      400,
      {
        code: 'VALIDATION_ERROR',
        details: enhancedError.issues,
        userContext: {
          userId: authReq.user?.userId,
          verificationLevel: authReq.user?.verificationLevel,
          geographicScope: authReq.geographicContext?.locationScope
        }
      }
    );
    
    // The original code was missing `next()` here, assuming it's meant to be passed to the next error handler.
    return next(apiError);
  }

  // API ERROR HANDLING: Already an ApiError from pre-validation
  if (error instanceof ApiError) {
    return next(error);
  }

  // GENERIC ERROR HANDLING: Fallback for unexpected errors
  const genericError = new ApiError(
    'Request validation failed',
    400,
    {
      code: 'UNKNOWN_VALIDATION_ERROR',
      originalError: error instanceof Error ? error.message : String(error)
    }
  );
  
  return next(genericError);
}

/**
 * Check if Error is a Zod Error
 * * Type guard to determine if an error is a Zod validation error.
 * * @param error - Error object to check
 * @returns Boolean indicating if error is a Zod error
 */
function isZodError(error: unknown): error is ZodError {
  return typeof error === 'object' && error !== null && 'issues' in error;
}

/**
 * Enhance Zod Error with UJAMAADAO Custom Messages
 * * Enhances Zod validation errors with community-friendly custom messages
 * and UJAMAADAO-specific error context.
 * * @param error - Zod error object
 * @param customErrorMessages - Custom error message mappings
 * @returns Enhanced Zod error with custom messages
 */
function enhanceZodError(error: ZodError, customErrorMessages: Record<string, string>): ZodError {
  const enhancedIssues = error.issues.map(issue => {
    // Generate error code for custom message lookup
    const errorCode = `${issue.path.join('.')}.${issue.code}`;
    
    // Apply custom message if available
    if (customErrorMessages[errorCode]) {
      return {
        ...issue,
        message: customErrorMessages[errorCode]
      };
    }
    
    // UJAMAADAO ENHANCEMENT: Apply community-friendly default messages
    const enhancedMessage = enhanceErrorMessage(issue.message, issue.code);
    
    return {
      ...issue,
      message: enhancedMessage
    };
  });

  return {
    ...error,
    issues: enhancedIssues
  };
}

/**
 * Enhance Error Message for UJAMAADAO Community
 * * Transforms technical error messages into community-friendly messages
 * for the UJAMAADAO platform users.
 * * @param originalMessage - Original technical error message
 * @param errorCode - Zod error code
 * @returns Enhanced community-friendly error message
 */
function enhanceErrorMessage(originalMessage: string, errorCode: string): string {
  const messageEnhancements: Record<string, string> = {
    'invalid_type': 'Please provide the correct type of information',
    'too_small': 'The value provided is too small',
    'too_big': 'The value provided is too large',
    'invalid_string': 'Please provide a valid text value',
    'invalid_date': 'Please provide a valid date',
    'invalid_enum_value': 'Please select from the available options'
  };

  return messageEnhancements[errorCode] || originalMessage;
}

/**
 * UJAMAADAO Economic Validation Helper
 * * Specialized validation helper for economic system parameters
 * in the UJAMAADAO platform.
 * * @param schema - Zod schema for economic validation
 * @param options - Additional validation options
 * @returns Configured validation middleware
 */
export function validateEconomicRequest(schema: ZodSchema, options?: Partial<UjamaadaoValidationOptions>) {
  return validateRequest({
    schema,
    target: 'body',
    requiredVerificationLevel: 'COMMUNITY_VERIFIED',
    logValidationFailures: true,
    customErrorMessages: {
      'amount.too_small': 'Amount must be at least 1 Utility Token',
      'impactPoints.invalid': 'Impact points must be a positive number',
      'price.invalid': 'Price must be a valid amount'
    },
    ...options
  });
}

/**
 * UJAMAADAO Geographic Validation Helper
 * * Specialized validation helper for geographic operations
 * in the UJAMAADAO platform.
 * * @param schema - Zod schema for geographic validation
 * @param options - Additional validation options
 * @returns Configured validation middleware
 */
export function validateGeographicRequest(schema: ZodSchema, options?: Partial<UjamaadaoValidationOptions>) {
  return validateRequest({
    schema,
    target: 'body',
    // CRITICAL FIX: Changed 'FULLY_VERIFIED' to 'FULL_VERIFIED'
    requiredVerificationLevel: 'FULL_VERIFIED',
    geographicScope: 'WARD',
    validateGeographicContext: true,
    logValidationFailures: true,
    ...options
  });
}

/**
 * Backward Compatibility Wrapper
 * * Maintains compatibility with existing code that uses the old validateRequest signature
 * while encouraging migration to the enhanced UJAMAADAO validation system.
 * * @deprecated Use validateRequest with options object for UJAMAADAO features
 * @param schema - Zod schema for validation
 * @param target - Target of validation (body, params, query)
 * @returns Express middleware function
 */
export function validateRequestLegacy(schema: ZodSchema, target: 'body' | 'params' | 'query' = 'body') {
  return validateRequest({
    schema,
    target
  });
}

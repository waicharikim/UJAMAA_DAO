/**
 * @file logger.ts
 *
 * @description
 * UJAMAADAO Enhanced Logger Configuration using Pino
 * * Comprehensive logging system for the UJAMAADAO platform that provides:
 * - Structured logging with UJAMAADAO context (geographic, verification, economic)
 * - Geographic hierarchy tracking for location-based operations
 * - Verification level integration for security monitoring
 * - Economic system metrics and transaction tracking
 * - Performance monitoring for community governance operations
 * - Security event tracking and audit trails
 * * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic context preservation in log entries
 * - Verification level tracking for access monitoring
 * - Economic system transaction logging
 * - Community governance operation auditing
 * - Security event classification and tracking
 * - Performance metrics for geographic operations
 * * Log Levels for UJAMAADAO Platform:
 * - fatal: System failures and security breaches
 * - error: Operational errors and validation failures
 * - warn: Security warnings and suspicious activities
 * - info: Platform operations and user activities
 * - debug: Detailed geographic and economic operations
 * - trace: Performance tracing and detailed debugging
 */

import pino from 'pino';
import type { AuthRequest, AuthUser, GeographicContext, EconomicContext LocationScope, VerificationLevel } from '../types/ujamaadao.types.js';
import type { UjamaadaoLogContext } from '../types/ujamaadao.types.js';
// ============================================================================
// UJAMAADAO LOGGER INTERFACE DEFINITION (MOVED HERE FOR RESOLUTION STABILITY)
// ============================================================================

/**
 * UJAMAADAO Log Context Interface
 * * Enhanced log context that includes platform-specific data for comprehensive
 * monitoring and debugging of the community governance platform.
 */


/**
 * UJAMAADAO Logger Interface
 * * Extends pino.BaseLogger to ensure all standard logging methods (warn, info, error, etc.) are present,
 * and adds custom, UJAMAADAO-specific methods for enhanced structured logging.
 */
export interface UjamaadaoLogger extends pino.BaseLogger {
  warn(arg0: string, arg1: { ip: any; }): unknown;
  debug(arg0: string, arg1: { userId: any; }): unknown;
  info(arg0: string, arg1: { userId: string; requiredLevel: VerificationLevel; userLevel: VerificationLevel; }): unknown;
  /**
   * Logs a security event, always using the `warn` level internally for visibility.
   * @param msg - The primary log message.
   * @param context - The structured log context with securityEvent details.
   */
  securityEvent: (msg: string, context: UjamaadaoLogContext) => void;

  /**
   * Logs a geographic operation, using the `debug` level internally for detailed tracing.
   * @param msg - The primary log message.
   * @param context - The structured log context with geographicContext details.
   */
  geographicOperation: (msg: string, context: UjamaadaoLogContext) => void;

  /**
   * Logs an economic transaction, using the `info` or `debug` level internally.
   * @param msg - The primary log message.
   * @param context - The structured log context with economicContext details.
   */
  economicTransaction: (msg: string, context: UjamaadaoLogContext) => void;

  /**
   * Creates a child logger with the Ujamaadao context from an Express request (req).
   * @param req - The Express AuthRequest object.
   * @returns A child UjamaadaoLogger instance.
   */
  withRequestContext: (req: AuthRequest) => UjamaadaoLogger;
}

// ============================================================================
// LOGGER IMPLEMENTATION
// ============================================================================

// Base Pino logger configuration
const pinoConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: {
    // Override default pino props
    pid: process.pid,
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  // Use a custom serializer for error objects to ensure they are logged correctly
  serializers: {
    error: pino.stdSerializers.err,
  },
};

// Create the base Pino logger instance
const baseLogger = pino(pinoConfig);

// Helper to create a child logger with request context
const withRequestContext = (req: AuthRequest) => {
  const context: Partial<UjamaadaoLogContext> = {
    userId: req.user?.userId,
    verificationLevel: req.user?.verificationLevel,
    geographicContext: req.geographicContext,
    // Add request context data
    metadata: {
      ipAddress: req.ip,
      method: req.method,
      url: req.originalUrl,
    },
  };

  return ujamaadaoLogger.child(context) as UjamaadaoLogger;
};


// Factory function to create the custom logger instance
const createUjamaadaoLogger = (): UjamaadaoLogger => {
  const loggerInstance = baseLogger as UjamaadaoLogger;

  // Custom methods implementation
  loggerInstance.securityEvent = (msg: string, context: UjamaadaoLogContext) => {
    // Security events are critical, log them as 'warn' or 'error' based on severity
    if (context.securityEvent?.severity === 'CRITICAL' || context.securityEvent?.severity === 'HIGH') {
      loggerInstance.error(context, `[SECURITY_ALERT] ${msg}`);
    } else {
      loggerInstance.warn(context, `[SECURITY_EVENT] ${msg}`);
    }
  };

  loggerInstance.geographicOperation = (msg: string, context: UjamaadaoLogContext) => {
    // Geographic operations are often detailed; use 'debug'
    loggerInstance.debug(context, `[GEO_OP] ${msg}`);
  };

  loggerInstance.economicTransaction = (msg: string, context: UjamaadaoLogContext) => {
    // Economic transactions are important for audit; use 'info'
    loggerInstance.info(context, `[ECO_TX] ${msg}`);
  };

  // Add the request context helper method
  loggerInstance.withRequestContext = withRequestContext;

  return loggerInstance;
};

// The singleton UJAMAADAO logger instance
const ujamaadaoLogger: UjamaadaoLogger = createUjamaadaoLogger();

// Export the singleton logger as default
export default ujamaadaoLogger;

// Export helpers (optional, but good practice)
export { ujamaadaoLogger };

/**
 * Create Request Logger
 * * Creates a child logger instance with request context for consistent
 * logging throughout request processing.
 */
export function createRequestLogger(req: AuthRequest): UjamaadaoLogger {
  return ujamaadaoLogger.withRequestContext(req);
}

/**
 * Log Geographic Operation
 * * Helper function for logging geographic operations with proper context.
 */
export function logGeographicOperation(
  operation: string,
  geographicContext: any,
  additionalContext?: Partial<UjamaadaoLogContext>
) {
  ujamaadaoLogger.geographicOperation(operation, {
    geographicContext,
    operationType: 'GEOGRAPHIC',
    ...additionalContext,
  });
}

/**
 * Log Economic Transaction
 * * Helper function for logging economic transactions with proper context.
 */
export function logEconomicTransaction(
  transaction: string,
  economicContext: any,
  additionalContext?: Partial<UjamaadaoLogContext>
) {
  ujamaadaoLogger.economicTransaction(transaction, {
    economicContext,
    operationType: 'ECONOMIC',
    ...additionalContext,
  });
}

/**
 * Log Security Event
 * * Helper function for logging security events with severity classification.
 */
export function logSecurityEvent(
  event: string,
  type: 'AUTH_FAILURE' | 'GEOGRAPHIC_VIOLATION' | 'ECONOMIC_FRAUD' | 'ROLE_VIOLATION',
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  details: string,
  additionalContext?: Partial<UjamaadaoLogContext>
) {
  ujamaadaoLogger.securityEvent(event, {
    securityEvent: { type, severity, details },
    operationType: 'SECURITY',
    ...additionalContext,
  });
}

/**
 * UJAMAADAO Enhanced Logger using Pino
 * Privacy-compliant, domain-aware, audit-ready
 * 
 * Version: 2.2 — January 2026
 * Updated: Fixed SecurityEventType imports and duplicate function declarations
 */

import pino from "pino";
import type { Logger, LoggerOptions } from "pino";
import type { AuthRequest, UjamaadaoLogContext } from "../types/Ujamaadao.types.js";
import { SecurityEventType, getEventSeverity } from "../types/security-event.types.js";
import { env } from "../utils/env.js";

import {
  redactEmail,
  redactWallet,
  redactIP,
  redactPhone,
  hashIdentifier,
  sanitizeLogMessage,
  sanitizeUserAgent,
} from './log-sanitizer.js';

import {
  serializeEconomicContext,
  serializeGeographicContext,
  serializeUser,
  serializeRequest,
} from './log-serializers.js';

// Type for severity levels
export type SecurityEventSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface UjamaadaoLogger extends Logger {
  critical(arg0: { operationType: string; queue: any; jobId: any; jobName: any; attempts: any; error: string; data: string; timestamp: string; }, arg1: string): unknown;
  securityEvent: (msg: string, context: UjamaadaoLogContext, error?: Error) => void;
  geographicOperation: (msg: string, context: UjamaadaoLogContext) => void;
  economicTransaction: (msg: string, context: UjamaadaoLogContext, level?: 'info' | 'warn' | 'error') => void;
  participationRightsOperation: (msg: string, context: UjamaadaoLogContext) => void;
  withRequestContext: (req: AuthRequest, includeEconomic?: boolean) => UjamaadaoLogger;
}

// ============================================================================
// PINO BASE CONFIG
// ============================================================================

const pinoConfig: LoggerOptions = {
  level: env.LOG_LEVEL || "info",
  base: { 
    pid: process.pid,
    service: env.PLATFORM_NAME || 'UJAMAADAO',
    environment: env.NODE_ENV,
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
  },
  transport: (env.NODE_ENV === "development" && process.env.ENABLE_PRETTY_LOGS !== "false")
    ? { 
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        }
      } 
    : undefined,
};

const baseLogger = pino(pinoConfig);

// ============================================================================
// AUDIT LOGGER
// ============================================================================

const auditLogger = env.NODE_ENV === 'production' && env.AUDIT_LOG_FILE
  ? pino({
      ...pinoConfig,
      level: 'info',
      transport: {
        target: 'pino/file',
        options: { destination: env.AUDIT_LOG_FILE }
      }
    })
  : baseLogger;

// ============================================================================
// ENHANCED LOGGER
// ============================================================================

const createUjamaadaoLogger = (): UjamaadaoLogger => {
  const logger = baseLogger as unknown as UjamaadaoLogger;

  logger.securityEvent = (msg: string, context: UjamaadaoLogContext, error?: Error) => {
    const sanitizedMsg = sanitizeLogMessage(msg);
    const severity = context.securityEvent?.severity || 'MEDIUM';
    const level = severity === "CRITICAL" || severity === "HIGH" ? "error" : "warn";

    const logContext = { ...context, logRetentionDays: 365 };
    if (error) logContext.error = pino.stdSerializers.err(error);

    auditLogger.info(logContext, `[AUDIT] ${sanitizedMsg}`);
    logger[level](logContext, `[SECURITY] ${sanitizedMsg}`);
  };

  logger.geographicOperation = (msg: string, context: UjamaadaoLogContext) => {
    const sanitizedMsg = sanitizeLogMessage(msg);
    const shouldLog = context.metadata?.forceLog || Math.random() < 0.1;
    if (shouldLog) {
      logger.debug({ ...context, sampleRate: 0.1, logRetentionDays: 30 }, `[GEO] ${sanitizedMsg}`);
    }
  };

  logger.economicTransaction = (msg: string, context: UjamaadaoLogContext, level: 'info' | 'warn' | 'error' = 'info') => {
    const sanitizedMsg = sanitizeLogMessage(msg);
    logger[level]({ ...context, logRetentionDays: 90 }, `[ECO] ${sanitizedMsg}`);
  };

  logger.participationRightsOperation = (msg: string, context: UjamaadaoLogContext) => {
    const sanitizedMsg = sanitizeLogMessage(msg);
    logger.info({ ...context, logRetentionDays: 90 }, `[PR] ${sanitizedMsg}`);
  };

  logger.withRequestContext = (req: AuthRequest, includeEconomic = false): UjamaadaoLogger => {
    const bindings: Record<string, any> = {
      correlationId: req.correlationId,
      user: req.user ? serializeUser(req.user) : null,
      request: serializeRequest(req),
      ipAddress: req.ip ? redactIP(req.ip) : 'unknown',
      userAgent: sanitizeUserAgent(req.headers["user-agent"]),
      sessionId: req.sessionId ? hashIdentifier(req.sessionId) : 'none',
    };

    // Only include geographic context if present
    if (req.geographicContext) {
      bindings.geographicContext = serializeGeographicContext(req.geographicContext);
    }

    // Only include economic context if requested and present
    if (includeEconomic && req.economicContext) {
      Object.assign(bindings, serializeEconomicContext(req.economicContext));
    }

    return logger.child(bindings) as UjamaadaoLogger;
  };

  return logger;
};

export const logger: UjamaadaoLogger = createUjamaadaoLogger();
export default logger;

// ============================================================================
// HELPERS
// ============================================================================

export const createRequestLogger = (req: AuthRequest, includeEconomic = false) =>
  logger.withRequestContext(req, includeEconomic);

/**
 * Log security events with proper typing and context
 * 
 * @param message - Human-readable security event message
 * @param eventType - Type of security event (typed enum)
 * @param severity - Severity level (LOW, MEDIUM, HIGH, CRITICAL)
 * @param description - Detailed description of the event
 * @param context - Additional context (userId, ipAddress, metadata)
 * @param error - Optional error object
 */
export function logSecurityEvent(
  message: string,
  eventType: SecurityEventType,
  severity: SecurityEventSeverity,
  description: string,
  context?: {
    userId?: string;
    ipAddress?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  },
  error?: Error
): void {
  const logContext: UjamaadaoLogContext = {
    operationType: "SECURITY",
    userId: context?.userId,
    securityEvent: {
      type: eventType,
      severity,
      details: sanitizeLogMessage(description),
    },
    metadata: {
      eventType,
      severity,
      description: sanitizeLogMessage(description),
      ipAddress: context?.ipAddress,
      ...context?.metadata,
      ...(error && {
        error: {
          message: error.message,
          name: error.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      }),
    },
  };

  logger.securityEvent(message, logContext, error);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export security event types for use across the application
export type { SecurityEventType } from '../types/security-event.types.js';
export { statusCodeToEventType, getEventSeverity } from '../types/security-event.types.js';
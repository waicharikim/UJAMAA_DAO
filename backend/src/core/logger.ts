/**
 * @file src/core/logger.ts
 * UJAMAADAO Enhanced Logger Configuration using Pino
 */

import pino from 'pino';
import type { AuthRequest, UjamaadaoLogContext } from './Ujamaadao.types.js';

export interface UjamaadaoLogger extends pino.BaseLogger {
  securityEvent: (msg: string, context: UjamaadaoLogContext) => void;
  geographicOperation: (msg: string, context: UjamaadaoLogContext) => void;
  economicTransaction: (msg: string, context: UjamaadaoLogContext) => void;
  withRequestContext: (req: AuthRequest) => UjamaadaoLogger;
}

const pinoConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: { pid: process.pid },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  serializers: { error: pino.stdSerializers.err },
};

const baseLogger = pino(pinoConfig);

const createUjamaadaoLogger = (): UjamaadaoLogger => {
  const loggerInstance = baseLogger as UjamaadaoLogger;

  loggerInstance.securityEvent = (msg: string, context: UjamaadaoLogContext) => {
    if (context.securityEvent?.severity === 'CRITICAL' || context.securityEvent?.severity === 'HIGH') {
      loggerInstance.error(context, `[SECURITY_ALERT] ${msg}`);
    } else {
      loggerInstance.warn(context, `[SECURITY_EVENT] ${msg}`);
    }
  };

  loggerInstance.geographicOperation = (msg: string, context: UjamaadaoLogContext) => {
    loggerInstance.debug(context, `[GEO_OP] ${msg}`);
  };

  loggerInstance.economicTransaction = (msg: string, context: UjamaadaoLogContext) => {
    loggerInstance.info(context, `[ECO_TX] ${msg}`);
  };

  loggerInstance.withRequestContext = (req: AuthRequest) => {
    const context: Partial<UjamaadaoLogContext> = {
      userId: req.user?.userId,
      verificationLevel: req.user?.verificationLevel,
      geographicContext: req.geographicContext,
      metadata: { ipAddress: req.ip, method: req.method, url: req.originalUrl },
    };
    return loggerInstance.child(context) as UjamaadaoLogger;
  };

  return loggerInstance;
};

const ujamaadaoLogger: UjamaadaoLogger = createUjamaadaoLogger();

export default ujamaadaoLogger;
export { ujamaadaoLogger };

export function createRequestLogger(req: AuthRequest): UjamaadaoLogger {
  return ujamaadaoLogger.withRequestContext(req);
}

export function logGeographicOperation(operation: string, geographicContext: any, additionalContext?: Partial<UjamaadaoLogContext>) {
  ujamaadaoLogger.geographicOperation(operation, { geographicContext, operationType: 'GEOGRAPHIC', ...additionalContext });
}

export function logEconomicTransaction(transaction: string, economicContext: any, additionalContext?: Partial<UjamaadaoLogContext>) {
  ujamaadaoLogger.economicTransaction(transaction, { economicContext, operationType: 'ECONOMIC', ...additionalContext });
}

export function logSecurityEvent(event: string, type: 'AUTH_FAILURE' | 'GEOGRAPHIC_VIOLATION' | 'ECONOMIC_FRAUD' | 'ROLE_VIOLATION', severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', details: string, additionalContext?: Partial<UjamaadaoLogContext>) {
  ujamaadaoLogger.securityEvent(event, { securityEvent: { type, severity, details }, operationType: 'SECURITY', ...additionalContext });
}

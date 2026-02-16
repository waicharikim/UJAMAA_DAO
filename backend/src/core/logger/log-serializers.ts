/**
 * @file log-serializers.ts
 * @description
 * Custom serializers for structured, privacy-safe logging
 * Ensures consistent log format across the application
 * 
 * Version: 1.0 — December 2025
 */

import type { Request, Response } from 'express';
import type { AuthRequest } from '../types/Ujamaadao.types.js';
import { 
  redactEmail, 
  redactWallet, 
  redactIP, 
  sanitizeUserAgent,
  sanitizeURL,
  autoRedactObject,
} from './log-sanitizer.js';

// ============================================================================
// ECONOMIC DATA SERIALIZATION
// ============================================================================

/**
 * Serialize economic context to privacy-safe tier format
 */
export function serializeEconomicContext(ctx?: {
  globalImpactPoints?: number;
  participationRights?: number;
  utilityTokens?: number;
}): any {
  if (!ctx) return { tier: 'unknown' };
  
  const pr = ctx.participationRights || 0;
  const ip = ctx.globalImpactPoints || 0;
  
  // Convert to tiers for privacy
  let prTier: string;
  if (pr === 0) prTier = 'none';
  else if (pr < 10) prTier = 'minimal';
  else if (pr < 100) prTier = 'low';
  else if (pr < 1000) prTier = 'medium';
  else if (pr < 10000) prTier = 'high';
  else prTier = 'whale';
  
  let ipTier: string;
  if (ip === 0) ipTier = 'none';
  else if (ip < 100) ipTier = 'minimal';
  else if (ip < 1000) ipTier = 'low';
  else if (ip < 10000) ipTier = 'medium';
  else if (ip < 100000) ipTier = 'high';
  else ipTier = 'elite';
  
  return {
    participationRightsTier: prTier,
    impactPointsTier: ipTier,
    hasSignificantActivity: pr >= 100 || ip >= 1000,
  };
}

/**
 * Serialize economic transaction (with magnitude, not exact amount)
 */
export function serializeEconomicTransaction(transaction: {
  type: 'deposit' | 'withdrawal' | 'transfer' | 'reward' | 'penalty';
  amount?: number;
  currency?: 'IP' | 'UT' | 'PR';
  userId?: string;
  reason?: string;
}): any {
  const amount = transaction.amount || 0;
  
  // Convert amount to magnitude for privacy
  let magnitude: string;
  if (amount === 0) magnitude = 'zero';
  else if (Math.abs(amount) < 10) magnitude = 'tiny';
  else if (Math.abs(amount) < 100) magnitude = 'small';
  else if (Math.abs(amount) < 1000) magnitude = 'medium';
  else if (Math.abs(amount) < 10000) magnitude = 'large';
  else magnitude = 'massive';
  
  return {
    type: transaction.type,
    currency: transaction.currency || 'unknown',
    magnitude,
    direction: amount >= 0 ? 'increase' : 'decrease',
    userId: transaction.userId,
    reason: transaction.reason,
  };
}

// ============================================================================
// GEOGRAPHIC DATA SERIALIZATION
// ============================================================================

/**
 * Serialize geographic context (scope only, not exact location)
 */
export function serializeGeographicContext(ctx?: any): any {
  if (!ctx) return { scope: 'unknown' };
  
  return {
    scope: ctx.locationScope || 'unknown',
    countyId: ctx.countyId,
    hasSecondaryWard: !!ctx.secondaryWardId,
    isTemporaryLocation: !!ctx.currentLocationId,
    // Don't include ward IDs or specific locations for privacy
  };
}

// ============================================================================
// USER DATA SERIALIZATION
// ============================================================================

/**
 * Serialize user data for logging (PII-redacted)
 */
export function serializeUser(user?: any): any {
  if (!user) return null;
  
  return {
    userId: user.userId || user.id,
    email: redactEmail(user.email),
    walletAddress: redactWallet(user.walletAddress),
    verificationLevel: user.verificationLevel || 'UNVERIFIED',
    roles: user.roles || [],
    hasWallet: !!user.walletAddress,
    hasEmail: !!user.email,
    hasPhone: !!user.phoneNumber,
  };
}

// ============================================================================
// REQUEST/RESPONSE SERIALIZATION
// ============================================================================

/**
 * Serialize HTTP request for logging (safe, no PII in query params)
 */
export function serializeRequest(req: Request | AuthRequest): any {
  return {
    method: req.method,
    path: sanitizeURL(req.originalUrl || req.url),
    // Don't log full URL with query params (might contain tokens/PII)
    userAgent: sanitizeUserAgent(req.headers['user-agent']),
    ip: redactIP(req.ip),
    protocol: req.protocol,
    headers: serializeHeaders(req.headers),
  };
}

/**
 * Serialize response for logging
 */
export function serializeResponse(res: Response): any {
  return {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    // Don't log response body (might contain sensitive data)
  };
}

/**
 * Serialize headers (redact sensitive ones)
 */
export function serializeHeaders(headers: any): any {
  const safe: any = {};
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'proxy-authorization',
  ];
  
  for (const key in headers) {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.includes(lowerKey)) {
      safe[key] = '[REDACTED]';
    } else {
      safe[key] = headers[key];
    }
  }
  
  return safe;
}

// ============================================================================
// ERROR SERIALIZATION
// ============================================================================

/**
 * Serialize error for logging (with stack trace in dev only)
 */
export function serializeError(error: any): any {
  if (!error) return null;
  
  const serialized: any = {
    name: error.name || 'Error',
    message: error.message || String(error),
    code: error.code,
    statusCode: error.statusCode || error.status,
  };
  
  // Include stack trace only in development
  if (process.env.NODE_ENV !== 'production') {
    serialized.stack = error.stack;
  } else {
    // In production, just log first line of stack
    const firstLine = error.stack?.split('\n')[0];
    serialized.stackFirstLine = firstLine;
  }
  
  // Include additional error properties
  if (error.data) {
    serialized.data = autoRedactObject(error.data);
  }
  
  return serialized;
}

// ============================================================================
// SECURITY EVENT SERIALIZATION
// ============================================================================

/**
 * Serialize security event for audit trail
 */
export function serializeSecurityEvent(event: {
  type: string;
  severity: string;
  details: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}): any {
  return {
    eventType: event.type,
    severity: event.severity,
    details: event.details,
    actor: {
      userId: event.userId,
      ip: redactIP(event.ipAddress),
      userAgent: sanitizeUserAgent(event.userAgent),
    },
    metadata: event.metadata ? autoRedactObject(event.metadata) : undefined,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// AUTHENTICATION EVENT SERIALIZATION
// ============================================================================

/**
 * Serialize authentication event
 */
export function serializeAuthEvent(event: {
  type: 'login' | 'logout' | 'token_refresh' | 'token_revoked' | 'password_reset';
  success: boolean;
  userId?: string;
  walletAddress?: string;
  email?: string;
  method?: 'wallet' | 'email' | 'phone' | 'magic-link';
  reason?: string;
}): any {
  return {
    eventType: event.type,
    success: event.success,
    authMethod: event.method || 'unknown',
    userId: event.userId,
    walletAddress: redactWallet(event.walletAddress),
    email: redactEmail(event.email),
    reason: event.reason,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// WALLET OPERATION SERIALIZATION
// ============================================================================

/**
 * Serialize wallet operation
 */
export function serializeWalletOperation(operation: {
  type: 'connect' | 'disconnect' | 'sign' | 'transaction';
  walletAddress?: string;
  chain?: string | number;
  success: boolean;
  error?: string;
}): any {
  return {
    operationType: operation.type,
    walletAddress: redactWallet(operation.walletAddress),
    chain: operation.chain,
    success: operation.success,
    error: operation.error,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// DATABASE QUERY SERIALIZATION
// ============================================================================

/**
 * Serialize database query for performance logging
 * (removes sensitive values from queries)
 */
export function serializeDatabaseQuery(query: {
  sql?: string;
  method?: string;
  table?: string;
  duration?: number;
  error?: any;
}): any {
  // Redact values in SQL queries
  const sanitizedSQL = query.sql
    ? query.sql.replace(/('([^'\\]|\\.)*'|"([^"\\]|\\.)*")/g, '***')
    : undefined;
  
  return {
    method: query.method,
    table: query.table,
    sqlTemplate: sanitizedSQL,
    duration: query.duration,
    slow: query.duration && query.duration > 1000, // Flag slow queries
    error: query.error ? serializeError(query.error) : undefined,
  };
}

// ============================================================================
// API CALL SERIALIZATION
// ============================================================================

/**
 * Serialize external API call for debugging
 */
export function serializeAPICall(call: {
  service: string;
  method: string;
  endpoint: string;
  statusCode?: number;
  duration?: number;
  error?: any;
}): any {
  return {
    service: call.service,
    method: call.method,
    endpoint: sanitizeURL(call.endpoint),
    statusCode: call.statusCode,
    duration: call.duration,
    success: call.statusCode ? call.statusCode >= 200 && call.statusCode < 300 : false,
    error: call.error ? serializeError(call.error) : undefined,
  };
}

// ============================================================================
// GOVERNANCE OPERATION SERIALIZATION
// ============================================================================

/**
 * Serialize governance/voting operation
 */
export function serializeGovernanceOperation(operation: {
  type: 'proposal_created' | 'vote_cast' | 'proposal_executed' | 'delegation';
  proposalId?: string;
  voterId?: string;
  vote?: 'for' | 'against' | 'abstain';
  participationRights?: number;
}): any {
  return {
    operationType: operation.type,
    proposalId: operation.proposalId,
    voterId: operation.voterId,
    vote: operation.vote,
    // Log PR tier, not exact amount
    voterTier: operation.participationRights
      ? serializeEconomicContext({ participationRights: operation.participationRights }).participationRightsTier
      : 'unknown',
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Economic
  serializeEconomicContext,
  serializeEconomicTransaction,
  
  // Geographic
  serializeGeographicContext,
  
  // User
  serializeUser,
  
  // Request/Response
  serializeRequest,
  serializeResponse,
  serializeHeaders,
  
  // Errors
  serializeError,
  
  // Events
  serializeSecurityEvent,
  serializeAuthEvent,
  serializeWalletOperation,
  serializeGovernanceOperation,
  
  // Infrastructure
  serializeDatabaseQuery,
  serializeAPICall,
};
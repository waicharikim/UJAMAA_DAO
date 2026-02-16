/**
 * @file src/core/types/security-event.types.ts
 * @description
 * Security Event Types for UjamaaDAO
 * 
 * Defines all valid security event types for consistent logging
 * 
 * Version: 1.0 — January 2026
 */

export type SecurityEventType =
  // Authentication Events
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "AUTHENTICATION_REQUIRED"
  
  // Authorization Events
  | "AUTHORIZATION_FAILURE"
  | "ACCESS_DENIED"
  | "INSUFFICIENT_PERMISSIONS"
  
  // Token Events
  | "TOKEN_VALIDATION_FAILED"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "TOKEN_MANIPULATION"
  
  // Rate Limiting
  | "RATE_LIMIT_EXCEEDED"
  | "BRUTE_FORCE"
  
  // 2FA Events
  | "TWO_FACTOR_ENABLED"
  | "TWO_FACTOR_DISABLED"
  | "TWO_FACTOR_FAILED"
  | "TWO_FACTOR_LOCKOUT"
  | "TWO_FACTOR_BACKUP_USED"
  | "TWO_FACTOR_BACKUP_REGENERATED"
  
  // Wallet Events
  | "WALLET_LINKED"
  | "WALLET_DISCONNECTED"
  | "WALLET_SIGNATURE_INVALID"
  
  // System Events
  | "SYSTEM_ERROR"
  | "DATABASE_ERROR"
  | "EXTERNAL_SERVICE_ERROR"
  
  // Suspicious Activity
  | "SUSPICIOUS_ACTIVITY"
  | "ACCOUNT_TAKEOVER_ATTEMPT"
  | "SESSION_HIJACK_ATTEMPT";

/**
 * Map HTTP status codes to security event types
 */
export function statusCodeToEventType(statusCode: number): SecurityEventType {
  if (statusCode >= 500) return "SYSTEM_ERROR";
  if (statusCode === 429) return "RATE_LIMIT_EXCEEDED";
  if (statusCode === 403) return "AUTHORIZATION_FAILURE";
  if (statusCode === 401) return "AUTH_FAILURE";
  
  return "AUTH_FAILURE"; // Default
}

/**
 * Get severity level for event type
 */
export function getEventSeverity(eventType: SecurityEventType): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const severityMap: Record<SecurityEventType, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
    // Low severity
    AUTH_SUCCESS: "LOW",
    TWO_FACTOR_ENABLED: "LOW",
    TWO_FACTOR_BACKUP_REGENERATED: "LOW",
    WALLET_LINKED: "LOW",
    
    // Medium severity
    AUTH_FAILURE: "MEDIUM",
    AUTHORIZATION_FAILURE: "MEDIUM",
    ACCESS_DENIED: "MEDIUM",
    INSUFFICIENT_PERMISSIONS: "MEDIUM",
    TOKEN_VALIDATION_FAILED: "MEDIUM",
    TOKEN_EXPIRED: "MEDIUM",
    TOKEN_REVOKED: "MEDIUM",
    AUTHENTICATION_REQUIRED: "MEDIUM",
    TWO_FACTOR_DISABLED: "MEDIUM",
    TWO_FACTOR_BACKUP_USED: "MEDIUM",
    WALLET_DISCONNECTED: "MEDIUM",
    WALLET_SIGNATURE_INVALID: "MEDIUM",
    RATE_LIMIT_EXCEEDED: "MEDIUM",
    
    // High severity
    TOKEN_MANIPULATION: "HIGH",
    TWO_FACTOR_FAILED: "HIGH",
    SYSTEM_ERROR: "HIGH",
    DATABASE_ERROR: "HIGH",
    EXTERNAL_SERVICE_ERROR: "HIGH",
    SUSPICIOUS_ACTIVITY: "HIGH",
    
    // Critical severity
    BRUTE_FORCE: "CRITICAL",
    TWO_FACTOR_LOCKOUT: "CRITICAL",
    ACCOUNT_TAKEOVER_ATTEMPT: "CRITICAL",
    SESSION_HIJACK_ATTEMPT: "CRITICAL",
  };
  
  return severityMap[eventType] || "MEDIUM";
}
/**
 * @file audit.util.ts
 * 
 * @description
 * UJAMAADAO Enhanced Audit Logging Utility
 * 
 * Comprehensive audit trail system for the UJAMAADAO platform that provides:
 * - User activity tracking with geographic context
 * - Economic system transaction auditing
 * - Verification workflow audit trails
 * - Security event logging and monitoring
 * - Geographic hierarchy change tracking
 * 
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic context preservation in audit logs
 * - Economic system transaction auditing
 * - Verification status change tracking
 * - Community governance decision auditing
 * - Location-based operation auditing
 */

import type { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * UJAMAADAO Audit Log Entry
 * 
 * Comprehensive audit trail structure that captures all platform activities
 * with geographic, economic, and verification context.
 */
export interface UjamaadaoAuditLog {
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string | null;
  ipAddress?: string;
  userAgent?: string;
  geographicContext?: {
    primaryWardId?: string;
    constituencyId?: string;
    countyId?: string;
    locationScope?: string;
  };
  economicContext?: {
    globalImpactPoints?: number;
    utilityTokens?: number;
    transactionType?: string;
  };
  verificationContext?: {
    previousLevel?: string;
    newLevel?: string;
    verificationType?: string;
  };
}

/**
 * Log User Audit Trail
 * 
 * Creates comprehensive audit trail entries for user activities in the
 * UJAMAADAO platform with enhanced context for geographic and economic systems.
 * 
 * @param auditData - Audit log data with UJAMAADAO context
 * @param tx - Optional transaction client for atomic operations
 */
export async function logUserAudit(
  auditData: UjamaadaoAuditLog, 
  tx?: any
): Promise<void> {
  const client = tx || require('../prismaClient.js').default;
  
  try {
    await client.userAudit.create({
      data: {
        userId: auditData.userId,
        field: auditData.field,
        oldValue: auditData.oldValue,
        newValue: auditData.newValue,
        changedBy: auditData.changedBy,
        timestamp: new Date(),
        // Additional context stored in metadata for querying
        metadata: {
          ipAddress: auditData.ipAddress,
          userAgent: auditData.userAgent,
          geographicContext: auditData.geographicContext,
          economicContext: auditData.economicContext,
          verificationContext: auditData.verificationContext
        }
      }
    });

    logger.debug('UJAMAADAO Audit: User audit log created', {
      userId: auditData.userId,
      field: auditData.field,
      hasGeographicContext: !!auditData.geographicContext
    });

  } catch (error) {
    logger.error('UJAMAADAO Audit: Failed to create audit log', {
      error: error instanceof Error ? error.message : String(error),
      userId: auditData.userId,
      field: auditData.field
    });
    // Don't throw - audit failures shouldn't break the main operation
  }
}
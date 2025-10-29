/**
 * @file userAudit.service.ts
 *
 * @description
 * Service for creating and retrieving audit records for user data changes.
 * - Logs changes with old/new values, the actor who performed the change, and optional metadata.
 * - Audit records are designed to be immutable (write-only).
 */

import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Logs an audit entry for a change to a user’s data field.
 *
 * @param params - Object containing userId, field name, old value,
 * new value, the actorId who made the change, and optional metadata.
 * @returns The created audit record.
 */
export async function logUserAudit(params: {
  userId: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedBy?: string | null;
  metadata?: Record<string, any> | null; // Added metadata for context like transaction IDs
}) {
  try {
    return await prisma.userAudit.create({
      data: {
        userId: params.userId,
        field: params.field,
        oldValue: params.oldValue,
        newValue: params.newValue,
        changedBy: params.changedBy || null,
        timestamp: new Date(),
        // Prisma automatically handles JSON serialization for the metadata field
        metadata: params.metadata || Prisma.JsonNull, 
      },
    });
  } catch (error) {
    logger.error('CRITICAL: Failed to write User Audit log', { userId: params.userId, field: params.field, error: error });
    // Re-throw a service error if this essential operation fails
    throw new ApiError('Audit log creation failed', 500, { code: 'AUDIT_LOG_FAILURE' });
  }
}

/**
 * Retrieves audit logs for a user, paginated and ordered by most recent.
 *
 * @param userId - User ID to filter by.
 * @param limit - Maximum number of records to retrieve (default 50).
 * @param offset - Number of records to skip (default 0).
 * @returns Array of audit log entries.
 */
export async function getUserAuditLogs(userId: string, limit = 50, offset = 0) {
  return prisma.userAudit.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}

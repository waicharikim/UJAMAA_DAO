/**
 * @file userAudit.service.ts
 *
 * @description
 * Service for creating and retrieving audit records for user data changes.
 * - Logs changes with old/new values and the user who performed the change.
 */

import prisma from '../prismaClient.js';

/**
 * Logs an audit entry for a change to a user’s data field.
 *
 * @param params - Object containing userId, field name, old value,
 *                 new value, and the userId who made the change.
 * @returns The created audit record.
 */
export async function logUserAudit(params: {
  userId: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedBy?: string | null;
}) {
  return prisma.userAudit.create({
    data: {
      userId: params.userId,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      changedBy: params.changedBy || null,
      timestamp: new Date(),
    },
  });
}

/**
 * Retrieves audit logs for a user, ordered by most recent.
 *
 * @param userId - User ID.
 * @param limit - Maximum number of records to retrieve (default 100).
 * @returns Array of audit log entries.
 */
export async function getUserAuditLogs(userId: string, limit = 100) {
  return prisma.userAudit.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}
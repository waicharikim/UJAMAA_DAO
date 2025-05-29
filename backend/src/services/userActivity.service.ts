/**
 * @file userActivity.service.ts
 *
 * @description
 * Service for logging user activity events and retrieving activity logs.
 */

import prisma from '../prismaClient.js';

/**
 * Logs a user activity event.
 * 
 * @param params - Object containing:
 *  - userId: ID of the user generating the activity
 *  - eventType: Description or type of the event
 *  - eventData: Optional JSON data related to the event
 *  - ipAddress: Optional IP address where event originated
 *  - userAgent: Optional user agent string of the client
 * @returns The created user activity log record.
 */
export async function logUserActivity(params: {
  userId: string;
  eventType: string;
  eventData?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.userActivityLog.create({
    data: {
      userId: params.userId,
      eventType: params.eventType,
      eventData: params.eventData,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}

/**
 * Retrieves recent activity logs for a given user.
 *
 * @param userId - ID of the user whose activities to fetch
 * @param limit - Number of activities to fetch (default 100)
 * @returns Array of user activity log records.
 */
export async function getUserActivities(userId: string, limit = 100) {
  return prisma.userActivityLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
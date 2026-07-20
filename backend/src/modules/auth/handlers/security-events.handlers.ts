/**
 * @file src/modules/auth/handlers/security-events.handlers.ts
 * @description
 * Security Events Handlers
 *
 * Provides endpoints for viewing and managing security events
 *
 * Version: 1.0 — January 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';

/**
 * Get user's own security events
 *
 * GET /auth/security-events
 * Query params:
 * - page (default: 1)
 * - pageSize (default: 20, max: 100)
 * - severity (optional filter: LOW, MEDIUM, HIGH, CRITICAL)
 * - eventType (optional filter)
 * - resolved (optional filter: true/false)
 */
export async function getUserSecurityEvents(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;

  // Parse query params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(req.query.pageSize as string) || 20)
  );
  const severity = req.query.severity as string | undefined;
  const eventType = req.query.eventType as string | undefined;
  const resolvedParam = req.query.resolved as string | undefined;

  const skip = (page - 1) * pageSize;

  try {
    // Build filter
    const where: any = { userId };

    if (severity) {
      where.severity = severity;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (resolvedParam !== undefined) {
      where.resolved = resolvedParam === 'true';
    }

    // Get events and total count
    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          severity: true,
          description: true,
          ipAddress: true,
          userAgent: true,
          resolved: true,
          resolvedAt: true,
          resolvedBy: true,
          createdAt: true,
          metadata: true,
        },
      }),
      prisma.securityEvent.count({ where }),
    ]);

    sendSuccess(res, {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    logger.error(
      {
        operationType: 'SECURITY',
        userId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          correlationId: req.correlationId,
        },
      },
      'Failed to fetch user security events'
    );

    throw ApiError.systemError(
      'Failed to fetch security events',
      undefined,
      req.correlationId
    );
  }
}

/**
 * Get unresolved security events (admin only)
 *
 * GET /auth/security-events/unresolved
 * Query params:
 * - page (default: 1)
 * - pageSize (default: 50, max: 100)
 * - severity (optional filter)
 * - minSeverity (optional: MEDIUM, HIGH, CRITICAL - shows events at or above this level)
 */
export async function getUnresolvedEvents(
  req: AuthRequest,
  res: Response
): Promise<void> {
  // TODO: Verify user is admin (should be done in middleware)
  const adminUserId = req.user!.userId;

  // Parse query params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(req.query.pageSize as string) || 50)
  );
  const severity = req.query.severity as string | undefined;
  const minSeverity = req.query.minSeverity as string | undefined;

  const skip = (page - 1) * pageSize;

  try {
    // Build filter
    const where: any = { resolved: false };

    if (severity) {
      where.severity = severity;
    } else if (minSeverity) {
      // Filter by minimum severity level
      const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const minIndex = severityOrder.indexOf(minSeverity);

      if (minIndex !== -1) {
        where.severity = {
          in: severityOrder.slice(minIndex),
        };
      }
    }

    // Get events and total count
    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { severity: 'desc' }, // CRITICAL first
          { createdAt: 'desc' }, // Then by recency
        ],
        select: {
          id: true,
          userId: true,
          eventType: true,
          severity: true,
          description: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          metadata: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.securityEvent.count({ where }),
    ]);

    // Count by severity for admin dashboard
    const severityCounts = await prisma.securityEvent.groupBy({
      by: ['severity'],
      where: { resolved: false },
      _count: true,
    });

    const counts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    severityCounts.forEach((item) => {
      counts[item.severity as keyof typeof counts] = item._count;
    });

    sendSuccess(res, {
      events,
      counts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    logger.error(
      {
        operationType: 'SECURITY',
        userId: adminUserId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          correlationId: req.correlationId,
        },
      },
      'Failed to fetch unresolved security events'
    );

    throw ApiError.systemError(
      'Failed to fetch unresolved events',
      undefined,
      req.correlationId
    );
  }
}

/**
 * Resolve a security event (admin only)
 *
 * PATCH /auth/security-events/:eventId/resolve
 * Body:
 * - notes (optional): Admin notes about resolution
 */
export async function resolveEvent(
  req: AuthRequest,
  res: Response
): Promise<void> {
  // TODO: Verify user is admin (should be done in middleware)
  const adminUserId = req.user!.userId;
  const { eventId } = req.params;
  const { notes } = req.body as { notes?: string };

  try {
    // Check if event exists and is not already resolved
    const event = await prisma.securityEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        userId: true,
        eventType: true,
        severity: true,
        resolved: true,
        resolvedAt: true,
      },
    });

    if (!event) {
      throw ApiError.notFound('Security event', eventId, req.correlationId);
    }

    if (event.resolved) {
      throw ApiError.conflict(
        'Security event already resolved',
        { resolvedAt: event.resolvedAt },
        req.correlationId
      );
    }

    // Resolve the event
    const updatedEvent = await prisma.securityEvent.update({
      where: { id: eventId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
        resolutionNotes: notes,
      },
      select: {
        id: true,
        eventType: true,
        severity: true,
        description: true,
        resolved: true,
        resolvedAt: true,
        resolvedBy: true,
        resolutionNotes: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    logger.info(
      {
        operationType: 'SECURITY',
        userId: adminUserId,
        metadata: {
          eventId,
          eventType: event.eventType,
          severity: event.severity,
          affectedUserId: event.userId,
          correlationId: req.correlationId,
        },
      },
      'Security event resolved by admin'
    );

    sendSuccess(res, {
      message: 'Security event resolved',
      event: updatedEvent,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.error(
      {
        operationType: 'SECURITY',
        userId: adminUserId,
        metadata: {
          eventId,
          error: error instanceof Error ? error.message : String(error),
          correlationId: req.correlationId,
        },
      },
      'Failed to resolve security event'
    );

    throw ApiError.systemError(
      'Failed to resolve security event',
      undefined,
      req.correlationId
    );
  }
}

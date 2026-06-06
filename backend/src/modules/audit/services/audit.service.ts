/**
 * @file src/modules/audit/services/audit.service.ts
 * @description
 * Audit Service — Immutable Action Log
 *
 * Logs all critical actions
 * Viewable by scoped admins
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { AuditAction, AuditSearchDto } from '../types.js';
import { SystemRoles } from '../../../core/rbac/roles.js';

class AuditService {
  /**
   * Log an action — called from other services
   */
  async log(
    userId: string,
    action: AuditAction,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, any>
  ) {
    // AuditLog.userId is a nullable UUID FK. System-initiated actions pass a
    // non-UUID sentinel (e.g. 'system' from the election cron) — coerce those to
    // a null actor (= system) and keep the original label in metadata, so the
    // insert can't throw a UUID-cast error and abort the calling operation.
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId
      );
    const actorId = isUuid ? userId : null;
    const meta = isUuid ? metadata : { ...(metadata ?? {}), actor: userId };

    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        entityType,
        entityId,
        metadata: meta ? JSON.parse(JSON.stringify(meta)) : undefined,
      },
    });

    logger.info(
      { userId, action, entityType, entityId, metadata },
      '[AUDIT] Action logged'
    );
  }

  /**
   * Search audit logs — scoped admin access.
   * SUPER_ADMIN sees all. Location admins see only users in their geographic scope
   * (derived from the admin's own primaryWardId → constituency → county).
   */
  async searchLogs(
    adminId: string,
    dto: AuditSearchDto,
    callerRoles: string[] = [],
    callerPrimaryWardId?: string | null
  ) {
    const isSuperAdmin =
      callerRoles.includes(SystemRoles.SUPER_ADMIN) ||
      callerRoles.includes(SystemRoles.COMPLIANCE_OFFICER);

    const limit = parseInt(String(dto.limit || 50), 10);
    const page = parseInt(String(dto.page || 1), 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Geographic scope filter — non-super admins only see their area
    if (!isSuperAdmin && callerPrimaryWardId) {
      const isCountyAdmin = callerRoles.includes(SystemRoles.COUNTY_ADMIN);
      const isConstAdmin = callerRoles.includes(SystemRoles.CONSTITUENCY_ADMIN);
      const isWardAdmin = callerRoles.includes(SystemRoles.WARD_ADMIN);

      const adminWard = await prisma.ward.findUnique({
        where: { id: callerPrimaryWardId },
        select: { id: true, constituencyId: true, countyId: true },
      });

      if (adminWard) {
        if (isWardAdmin) {
          where.user = { primaryWardId: adminWard.id };
        } else if (isConstAdmin) {
          where.user = {
            primaryWard: { constituencyId: adminWard.constituencyId },
          };
        } else if (isCountyAdmin) {
          where.user = { primaryWard: { countyId: adminWard.countyId } };
        }
      }
    }

    if (dto.userId) where.userId = dto.userId;
    if (dto.action) where.action = dto.action;
    if (dto.entityType) where.entityType = dto.entityType;
    if (dto.entityId) where.entityId = dto.entityId;
    if (dto.fromDate || dto.toDate) {
      where.createdAt = {};
      if (dto.fromDate) where.createdAt.gte = new Date(dto.fromDate);
      if (dto.toDate) where.createdAt.lte = new Date(dto.toDate);
    }

    const sortBy = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder || 'desc';

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const auditService = new AuditService();

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
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });

    logger.info(
      { userId, action, entityType, entityId, metadata },
      '[AUDIT] Action logged'
    );
  }

  /**
   * Search audit logs — scoped admin access
   */
  async searchLogs(adminId: string, dto: AuditSearchDto) {
    // In future: scope check (admin can only see logs in their scope)
    // For now: super_admin or ward_admin+

    const limit = parseInt(String(dto.limit || 50), 10);
    const page = parseInt(String(dto.page || 1), 10);
    const skip = (page - 1) * limit;

    const where: any = {};

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

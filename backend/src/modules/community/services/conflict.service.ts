/**
 * @file src/modules/community/services/conflict.service.ts
 * @description
 * Conflict Case Service — structured dispute resolution pathway
 *
 * Handles:
 * - File a conflict between two members
 * - List user's cases (as complainant or respondent)
 * - Retrieve single case
 * - Mediate / resolve (admin/mediator only)
 */

import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { ImpactPointReason } from '../../reputation/types.js';

class ConflictService {
  /**
   * File a conflict report against another member.
   */
  async fileConflict(
    complainantId: string,
    dto: {
      respondentId: string;
      description: string;
      evidence?: string[];
    }
  ) {
    if (complainantId === dto.respondentId) {
      throw ApiError.badRequest('Cannot file a conflict against yourself');
    }

    // Verify respondent exists
    const respondent = await prisma.user.findUnique({
      where: { id: dto.respondentId },
      select: { id: true },
    });
    if (!respondent) throw ApiError.notFound('User');

    const conflict = await prisma.conflictCase.create({
      data: {
        complainantId,
        respondentId: dto.respondentId,
        description: dto.description,
        evidence: dto.evidence ?? [],
        status: 'OPEN',
      },
    });

    logger.info(
      {
        complainantId,
        respondentId: dto.respondentId,
        conflictId: conflict.id,
      },
      'Conflict case filed'
    );

    await auditService.log(
      complainantId,
      AuditAction.CONFLICT_FILED,
      'ConflictCase',
      conflict.id,
      { respondentId: dto.respondentId }
    );

    await globalImpactPointService
      .award(complainantId, 5, ImpactPointReason.CONFLICT_FILED, {
        conflictId: conflict.id,
      })
      .catch(() => {});

    return conflict;
  }

  /**
   * List all cases where the user is complainant or respondent.
   */
  async listUserCases(userId: string) {
    return prisma.conflictCase.findMany({
      where: {
        OR: [{ complainantId: userId }, { respondentId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        description: true,
        createdAt: true,
        resolvedAt: true,
        complainant: { select: { id: true, name: true } },
        respondent: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get a single conflict case. Only parties involved or admin can view.
   */
  async getCase(userId: string, caseId: string) {
    const conflict = await prisma.conflictCase.findUnique({
      where: { id: caseId },
      include: {
        complainant: { select: { id: true, name: true } },
        respondent: { select: { id: true, name: true } },
      },
    });

    if (!conflict) throw ApiError.notFound('Conflict case');
    if (conflict.complainantId !== userId && conflict.respondentId !== userId) {
      throw ApiError.forbidden('Access denied');
    }

    return conflict;
  }

  /**
   * Append evidence URLs to an open case. Only parties can add evidence.
   * Hard cap: 10 total items across all submissions.
   */
  async addEvidence(userId: string, caseId: string, urls: string[]) {
    const conflict = await prisma.conflictCase.findUnique({
      where: { id: caseId },
    });
    if (!conflict) throw ApiError.notFound('Conflict case');
    if (conflict.complainantId !== userId && conflict.respondentId !== userId) {
      throw ApiError.forbidden('Access denied');
    }
    if (conflict.status === 'CLOSED') {
      throw ApiError.badRequest('Cannot add evidence to a closed case');
    }

    const current = (conflict.evidence ?? []) as string[];
    const remaining = 10 - current.length;
    if (remaining <= 0)
      throw ApiError.badRequest('Evidence limit reached (max 10)');

    const toAdd = urls.slice(0, remaining);
    const updated = await prisma.conflictCase.update({
      where: { id: caseId },
      data: { evidence: [...current, ...toAdd] },
      include: {
        complainant: { select: { id: true, name: true } },
        respondent: { select: { id: true, name: true } },
      },
    });

    await auditService.log(
      userId,
      AuditAction.CONFLICT_FILED,
      'ConflictCase',
      caseId,
      {
        action: 'addEvidence',
        count: toAdd.length,
      }
    );

    return updated;
  }

  /**
   * Resolve a conflict case (admin or assigned mediator only).
   */
  async resolveCase(actorId: string, caseId: string, resolution: string) {
    const conflict = await prisma.conflictCase.findUnique({
      where: { id: caseId },
    });
    if (!conflict) throw ApiError.notFound('Conflict case');
    if (conflict.status === 'CLOSED') {
      throw ApiError.conflict('Case already closed');
    }

    const updated = await prisma.conflictCase.update({
      where: { id: caseId },
      data: {
        status: 'CLOSED',
        resolution,
        resolvedAt: new Date(),
        mediatorId: actorId,
      },
    });

    logger.info({ actorId, caseId }, 'Conflict case resolved');

    await auditService.log(
      actorId,
      AuditAction.CONFLICT_RESOLVED,
      'ConflictCase',
      caseId,
      { resolution }
    );

    await globalImpactPointService
      .award(actorId, 15, ImpactPointReason.CONFLICT_RESOLVED, { caseId })
      .catch(() => {});

    return updated;
  }
}

export const conflictService = new ConflictService();

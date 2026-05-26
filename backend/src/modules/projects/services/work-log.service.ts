import { prisma } from '../../../core/database/client.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { roleService } from '../../../core/services/role.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { ImpactPointReason } from '../../reputation/types.js';
import type {
  LogWorkDto,
  VerifyWorkDto,
  WorkLogResponseDto,
  WorkLogListDto,
} from '../types.js';

export class WorkLogService {
  async logWork(userId: string, dto: LogWorkDto): Promise<WorkLogResponseDto> {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      select: { id: true, projectId: true, status: true },
    });
    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== 'IN_PROGRESS')
      throw ApiError.badRequest(
        'Can only log work on an in-progress milestone'
      );

    const member = await prisma.projectMember.findFirst({
      where: { projectId: milestone.projectId, userId },
    });
    if (!member)
      throw ApiError.forbidden('You must be a project member to log work');

    const IP_PER_HOUR = 10;
    const baseIP = Math.round(dto.hours * IP_PER_HOUR);

    const workLog = await prisma.physicalWorkLog.create({
      data: {
        userId,
        milestoneId: dto.milestoneId,
        projectId: milestone.projectId,
        workType: dto.workType,
        description: dto.description,
        hours: dto.hours,
        photoUrls: dto.photoUrls ?? [],
        witnessIds: dto.witnessIds ?? [],
        baseIP,
        totalIPEarned: 0,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    await auditService.log(
      userId,
      AuditAction.WORK_LOGGED,
      'PhysicalWorkLog',
      workLog.id,
      { milestoneId: dto.milestoneId, hours: dto.hours, workType: dto.workType }
    );

    logger.info(
      { userId, workLogId: workLog.id, milestoneId: dto.milestoneId },
      'Work logged'
    );

    return this.mapWorkLog(workLog);
  }

  async verifyWork(
    verifierId: string,
    dto: VerifyWorkDto
  ): Promise<WorkLogResponseDto> {
    const workLog = await prisma.physicalWorkLog.findUnique({
      where: { id: dto.workLogId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!workLog) throw ApiError.notFound('Work log');
    if (workLog.verifiedAt)
      throw ApiError.conflict('Work log already verified');

    const isLeader = await roleService.isProjectLeader(
      verifierId,
      workLog.projectId!
    );
    const isVerifier = await roleService.isVerifier(verifierId);
    if (!isLeader && !isVerifier)
      throw ApiError.forbidden(
        'Only project leaders or verifiers can verify work'
      );

    if (dto.approved)
      return this.approveWorkLog(workLog, verifierId, dto.workLogId);
    return this.rejectWorkLog(workLog, verifierId, dto.workLogId, dto.feedback);
  }

  async listWorkLogs(milestoneId: string): Promise<WorkLogListDto> {
    const workLogs = await prisma.physicalWorkLog.findMany({
      where: { milestoneId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      workLogs: workLogs.map((w) => this.mapWorkLog(w)),
      total: workLogs.length,
    };
  }

  private async approveWorkLog(
    workLog: { id: string; baseIP: number; userId: string },
    verifierId: string,
    workLogId: string
  ): Promise<WorkLogResponseDto> {
    const totalIPEarned = workLog.baseIP;
    const updated = await prisma.physicalWorkLog.update({
      where: { id: workLogId },
      data: { verifiedAt: new Date(), totalIPEarned },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    await globalImpactPointService.award(
      workLog.userId,
      totalIPEarned,
      ImpactPointReason.PHYSICAL_WORK_VERIFIED
    );
    await auditService.log(
      verifierId,
      AuditAction.WORK_VERIFIED,
      'PhysicalWorkLog',
      workLogId,
      { approved: true, totalIPEarned, workerId: workLog.userId }
    );
    logger.info({ verifierId, workLogId, approved: true }, 'Work verified');
    return this.mapWorkLog(updated);
  }

  private async rejectWorkLog(
    workLog: { id: string; userId: string; verifiedAt: Date | null },
    verifierId: string,
    workLogId: string,
    feedback: string | undefined
  ): Promise<WorkLogResponseDto> {
    await prisma.workVerification.create({
      data: {
        workLogId,
        verifierId,
        method: 'SUPERVISOR',
        status: 'REJECTED',
        notes: feedback,
        verifiedAt: new Date(),
      },
    });
    await auditService.log(
      verifierId,
      AuditAction.WORK_VERIFIED,
      'PhysicalWorkLog',
      workLogId,
      { approved: false, feedback, workerId: workLog.userId }
    );
    logger.info({ verifierId, workLogId, approved: false }, 'Work rejected');
    return this.mapWorkLog({ ...workLog, verifiedAt: null });
  }

  mapWorkLog(w: any): WorkLogResponseDto {
    const isVerified = !!w.verifiedAt;
    const isRejected =
      !isVerified &&
      (w.verifications?.some((v: any) => v.status === 'REJECTED') ?? false);

    return {
      id: w.id,
      milestoneId: w.milestoneId,
      projectId: w.projectId,
      userId: w.userId,
      worker: w.user,
      workType: w.workType,
      description: w.description,
      hours: Number(w.hours),
      photoUrls: w.photoUrls ?? [],
      status: isVerified ? 'APPROVED' : isRejected ? 'REJECTED' : 'PENDING',
      totalIPEarned: w.totalIPEarned ?? 0,
      verifiedAt: w.verifiedAt ? w.verifiedAt.toISOString() : null,
      createdAt: w.createdAt.toISOString(),
    };
  }
}

export const workLogService = new WorkLogService();

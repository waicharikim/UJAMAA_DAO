import crypto from 'crypto';
import { prisma } from '../../../core/database/client.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { roleService } from '../../../core/services/role.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { projectQueue } from '../../../core/queue/index.js';
import { ImpactPointReason } from '../../reputation/types.js';
import type {
  CreateWorkSessionDto,
  WorkSessionDto,
  WorkPresenceDto,
  ScanQrResponseDto,
  AttestResponseDto,
} from '../types.js';
import { ProjectJobName } from '../types.js';

export class WorkSessionService {
  async createWorkSession(
    leaderId: string,
    dto: CreateWorkSessionDto
  ): Promise<WorkSessionDto> {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      select: { id: true, projectId: true, status: true },
    });
    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== 'IN_PROGRESS')
      throw ApiError.badRequest(
        'Milestone must be IN_PROGRESS to start a work session'
      );

    const isLeader = await roleService.isProjectLeader(
      leaderId,
      milestone.projectId
    );
    if (!isLeader)
      throw ApiError.forbidden('Only project leaders can create work sessions');

    const existing = await prisma.workSession.findFirst({
      where: { milestoneId: dto.milestoneId, status: 'OPEN' },
    });
    if (existing)
      throw ApiError.conflict(
        'An open work session already exists for this milestone'
      );

    const durationMs = dto.durationMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
    const qrSecret = crypto.randomBytes(24).toString('hex');

    const session = await prisma.workSession.create({
      data: {
        milestoneId: dto.milestoneId,
        projectId: milestone.projectId,
        createdById: leaderId,
        qrSecret,
        expiresAt,
      },
    });

    await this.scheduleSessionAutoClose(session.id, durationMs);

    logger.info(
      {
        operationType: 'WORK_SESSION',
        sessionId: session.id,
        milestoneId: dto.milestoneId,
      },
      'Work session created'
    );

    return this.mapWorkSession(session, 0);
  }

  async scanQr(userId: string, qrSecret: string): Promise<ScanQrResponseDto> {
    const session = await prisma.workSession.findUnique({
      where: { qrSecret },
      include: { _count: { select: { presences: true } } },
    });
    if (!session) throw ApiError.notFound('Work session');
    this.assertSessionOpen(session);

    try {
      const presence = await prisma.workPresence.create({
        data: { sessionId: session.id, userId, depth: 0 },
      });

      const attestationsUsed = await prisma.workPresence.count({
        where: { sessionId: session.id, attestedById: userId },
      });

      return {
        sessionId: session.id,
        depth: presence.depth,
        expiresAt: session.expiresAt.toISOString(),
        attestationsRemaining: 2 - attestationsUsed,
      };
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw ApiError.conflict('You have already checked in to this session');
      throw err;
    }
  }

  async attestPresence(
    attestorId: string,
    sessionId: string,
    targetUserId: string
  ): Promise<AttestResponseDto> {
    const session = await prisma.workSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw ApiError.notFound('Work session');
    this.assertSessionOpen(session);
    const { attestationsUsed, attestorDepth } = await this.assertCanAttest(
      attestorId,
      sessionId
    );
    await this.assertValidAttestTarget(targetUserId, attestorId);

    try {
      const presence = await prisma.workPresence.create({
        data: {
          sessionId,
          userId: targetUserId,
          attestedById: attestorId,
          depth: attestorDepth + 1,
        },
      });

      return {
        presenceId: presence.id,
        targetUserId,
        depth: presence.depth,
        attestationsRemaining: 2 - (attestationsUsed + 1),
      };
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw ApiError.conflict(
          'This person is already checked in to this session'
        );
      throw err;
    }
  }

  async closeWorkSession(sessionId: string): Promise<WorkSessionDto> {
    const session = await prisma.workSession.findUnique({
      where: { id: sessionId },
      include: {
        presences: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!session) throw ApiError.notFound('Work session');
    if (session.status !== 'OPEN')
      return this.mapWorkSession(session, session.presences.length);

    const directScanCount = session.presences.filter(
      (p) => p.depth === 0
    ).length;
    const newStatus = directScanCount >= 1 ? 'APPROVED' : 'FLAGGED';

    const updated = await prisma.workSession.update({
      where: { id: sessionId },
      data: { status: newStatus, closedAt: new Date() },
    });

    if (newStatus === 'APPROVED') {
      await this.awardAllPresences(session.presences, sessionId);
      logger.info(
        {
          operationType: 'WORK_SESSION',
          sessionId,
          presenceCount: session.presences.length,
        },
        'Work session approved — IP awarded to all members'
      );
    } else {
      logger.warn(
        { operationType: 'WORK_SESSION', sessionId },
        'Work session flagged — no direct scans found'
      );
    }

    return this.mapWorkSession(updated, session.presences.length);
  }

  async getWorkSession(
    sessionId: string
  ): Promise<WorkSessionDto & { presences: WorkPresenceDto[] }> {
    const session = await prisma.workSession.findUnique({
      where: { id: sessionId },
      include: {
        presences: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!session) throw ApiError.notFound('Work session');

    return {
      ...this.mapWorkSession(session, session.presences.length),
      presences: session.presences.map((p) => ({
        id: p.id,
        sessionId: p.sessionId,
        userId: p.userId,
        user: p.user,
        attestedById: p.attestedById,
        depth: p.depth,
        ipAwarded: p.ipAwarded,
        awardedAt: p.awardedAt ? p.awardedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  private async scheduleSessionAutoClose(
    sessionId: string,
    durationMs: number
  ): Promise<void> {
    try {
      const job = await projectQueue.add(
        ProjectJobName.WORK_SESSION_CLOSE,
        { sessionId },
        { delay: durationMs, jobId: `ws-close-${sessionId}` }
      );
      await prisma.workSession.update({
        where: { id: sessionId },
        data: { closeJobId: job.id ?? null },
      });
    } catch (err) {
      logger.warn(
        { operationType: 'WORK_SESSION', sessionId, err: String(err) },
        'Could not schedule auto-close job — session will require manual close'
      );
    }
  }

  private async awardAllPresences(
    presences: Array<{ id: string; userId: string; depth: number }>,
    sessionId: string
  ): Promise<void> {
    const IP_PER_PRESENCE = 10;
    const now = new Date();
    await Promise.all(
      presences.map((p) =>
        Promise.all([
          prisma.workPresence
            .update({
              where: { id: p.id },
              data: { ipAwarded: IP_PER_PRESENCE, awardedAt: now },
            })
            .catch(() => {}),
          globalImpactPointService
            .award(
              p.userId,
              IP_PER_PRESENCE,
              ImpactPointReason.PHYSICAL_WORK_VERIFIED,
              { sessionId, depth: p.depth }
            )
            .catch(() => {}),
        ])
      )
    );
  }

  private assertSessionOpen(session: { status: string; expiresAt: Date }) {
    if (session.status !== 'OPEN')
      throw ApiError.badRequest('This work session is no longer open');
    if (new Date() > session.expiresAt)
      throw ApiError.badRequest('This QR code has expired');
  }

  private async assertCanAttest(attestorId: string, sessionId: string) {
    const attestorPresence = await prisma.workPresence.findUnique({
      where: { sessionId_userId: { sessionId, userId: attestorId } },
    });
    if (!attestorPresence)
      throw ApiError.forbidden(
        'You must be checked in to this session before attesting others'
      );
    const attestationsUsed = await prisma.workPresence.count({
      where: { sessionId, attestedById: attestorId },
    });
    if (attestationsUsed >= 2)
      throw ApiError.badRequest(
        'You have already used both of your attestation slots'
      );
    return { attestationsUsed, attestorDepth: attestorPresence.depth };
  }

  private async assertValidAttestTarget(
    targetUserId: string,
    attestorId: string
  ) {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) throw ApiError.notFound('Target user');
    if (targetUserId === attestorId)
      throw ApiError.badRequest('You cannot attest yourself');
  }

  private mapWorkSession(s: any, presenceCount: number): WorkSessionDto {
    return {
      id: s.id,
      milestoneId: s.milestoneId,
      projectId: s.projectId,
      qrSecret: s.qrSecret,
      expiresAt: s.expiresAt.toISOString(),
      status: s.status,
      closedAt: s.closedAt ? s.closedAt.toISOString() : null,
      presenceCount,
      createdAt: s.createdAt.toISOString(),
    };
  }
}

export const workSessionService = new WorkSessionService();

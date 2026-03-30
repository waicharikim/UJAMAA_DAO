/**
 * @file src/modules/projects/services/project.service.ts
 * @description
 * Project Service — Execution of Approved Proposals (Funded or Non-Funded)
 */

import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { roleService } from '../../../core/services/role.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import { ImpactPointReason } from '../../reputation/types.js';
import type {
  CreateProjectFromProposalDto,
  StartMilestoneDto,
  SubmitMilestoneDto,
  VerifyMilestoneDto,
  ListProjectsDto,
  ProjectDetailDto,
  ProjectDto,
  MilestoneResponseDto,
  ProjectMemberResponseDto,
  LogWorkDto,
  VerifyWorkDto,
  WorkLogResponseDto,
  WorkLogListDto,
} from '../types.js';
import { ProjectStatus, MilestoneStatus } from '../types.js';

const DEFAULT_REWARDS = { IP: 50, PR: 25 };

export class ProjectService {
  /**
   * Create project from an APPROVED proposal (funded or non-funded)
   */
  async createFromProposal(userId: string, dto: CreateProjectFromProposalDto) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: dto.proposalId },
      include: { group: true, milestones: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== 'APPROVED')
      throw ApiError.badRequest('Proposal must be approved');
    if (proposal.creatorId !== userId)
      throw ApiError.forbidden(
        'Only the proposal creator can create a project'
      );

    const existing = await prisma.project.findFirst({
      where: { proposalId: dto.proposalId },
    });
    if (existing)
      throw ApiError.conflict('Project already exists for this proposal');

    const project = await prisma.project.create({
      data: {
        proposalId: dto.proposalId,
        ownerGroupId: proposal.groupId,
        ownerUserId: userId,
        title: proposal.title,
        description: proposal.description,
        status: ProjectStatus.PLANNING,
      },
    });

    // Add creator as LEAD member
    await prisma.projectMember.create({
      data: { projectId: project.id, userId, role: 'LEAD' },
    });

    // Auto-create milestones from linked ProposalMilestones if any
    if (proposal.milestones.length > 0) {
      await prisma.milestone.createMany({
        data: proposal.milestones.map((m) => ({
          projectId: project.id,
          proposalMilestoneId: m.id,
          title: m.title,
          description: m.description ?? null,
          orderIndex: m.orderIndex,
          status: MilestoneStatus.PENDING,
        })),
      });
    }

    logger.info(
      { userId, proposalId: dto.proposalId, projectId: project.id },
      'Project created'
    );

    await auditService.log(
      userId,
      AuditAction.PROJECT_CREATED,
      'Project',
      project.id,
      { proposalId: dto.proposalId }
    );

    return project;
  }

  /**
   * Transition a milestone from PENDING → IN_PROGRESS (project leader only)
   */
  async startMilestone(userId: string, dto: StartMilestoneDto) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      include: { project: true },
    });

    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== MilestoneStatus.PENDING)
      throw ApiError.badRequest('Milestone is not pending');

    const isLeader = await roleService.isProjectLeader(
      userId,
      milestone.projectId
    );
    if (!isLeader)
      throw ApiError.forbidden('Only the project leader can start a milestone');

    await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: { status: MilestoneStatus.IN_PROGRESS, startedAt: new Date() },
    });

    return { status: MilestoneStatus.IN_PROGRESS };
  }

  /**
   * Submit milestone for verification (IN_PROGRESS → AWAITING_VERIFICATION)
   */
  async submitMilestone(userId: string, dto: SubmitMilestoneDto) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
    });

    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== MilestoneStatus.IN_PROGRESS)
      throw ApiError.badRequest('Milestone is not in progress');

    await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: {
        status: MilestoneStatus.AWAITING_VERIFICATION,
        submittedById: userId,
        submittedAt: new Date(),
        proofUrl: dto.proofUrl,
        submissionDescription: dto.description,
      },
    });

    await auditService.log(
      userId,
      AuditAction.MILESTONE_SUBMITTED,
      'Milestone',
      dto.milestoneId,
      { projectId: milestone.projectId }
    );

    return { status: MilestoneStatus.AWAITING_VERIFICATION };
  }

  /**
   * Verify milestone — project leader or designated verifier
   * Approved milestones trigger PR + IP rewards for the submitter
   */
  async verifyMilestone(verifierId: string, dto: VerifyMilestoneDto) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      include: { project: true },
    });

    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== MilestoneStatus.AWAITING_VERIFICATION)
      throw ApiError.badRequest('Milestone is not awaiting verification');

    const [isLeader, isVerifier] = await Promise.all([
      roleService.isProjectLeader(verifierId, milestone.projectId),
      roleService.isVerifier(verifierId),
    ]);
    if (!isLeader && !isVerifier)
      throw ApiError.forbidden('Not authorised to verify milestones');

    const newStatus = dto.approved
      ? MilestoneStatus.VERIFIED
      : MilestoneStatus.REJECTED;

    await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: {
        status: newStatus,
        verifiedById: verifierId,
        verifiedAt: new Date(),
        feedback: dto.feedback ?? null,
      },
    });

    await auditService.log(
      verifierId,
      AuditAction.MILESTONE_VERIFIED,
      'Milestone',
      dto.milestoneId,
      { approved: dto.approved, projectId: milestone.projectId }
    );

    if (dto.approved && milestone.submittedById) {
      await participationRightsService
        .award(
          milestone.submittedById,
          DEFAULT_REWARDS.PR,
          ParticipationRightsReason.MILESTONE_VERIFIED,
          { projectId: milestone.projectId, milestoneId: dto.milestoneId }
        )
        .catch((err) =>
          logger.warn({ err }, 'PR award failed after milestone verify')
        );

      await globalImpactPointService
        .award(
          milestone.submittedById,
          DEFAULT_REWARDS.IP,
          ImpactPointReason.MILESTONE_ACHIEVED,
          { projectId: milestone.projectId, milestoneId: dto.milestoneId }
        )
        .catch((err) =>
          logger.warn({ err }, 'IP award failed after milestone verify')
        );
    }

    return { status: newStatus };
  }

  /**
   * List projects with optional filters and pagination
   */
  async listProjects(params: {
    ownerGroupId?: string;
    ownerUserId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListProjectsDto> {
    const {
      ownerGroupId,
      ownerUserId,
      status,
      limit = 20,
      offset = 0,
    } = params;

    const where: Record<string, unknown> = {};
    if (ownerGroupId) where.ownerGroupId = ownerGroupId;
    if (ownerUserId) where.ownerUserId = ownerUserId;
    if (status) where.status = status;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { _count: { select: { milestones: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.project.count({ where }),
    ]);

    // Fetch completed milestone counts in one grouped query
    const completedCounts = await prisma.milestone.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projects.map((p) => p.id) },
        status: MilestoneStatus.VERIFIED,
      },
      _count: { id: true },
    });
    const completedMap: Record<string, number> = {};
    for (const r of completedCounts) completedMap[r.projectId] = r._count.id;

    return {
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status as ProjectStatus,
        ownerGroupId: p.ownerGroupId,
        ownerUserId: p.ownerUserId,
        proposalId: p.proposalId,
        milestonesCount: p._count.milestones,
        completedMilestonesCount: completedMap[p.id] ?? 0,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get full project detail including milestones, members, and linked entities
   */
  async getProject(projectId: string): Promise<ProjectDetailDto> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { orderBy: { orderIndex: 'asc' } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        ownerGroup: { select: { id: true, name: true } },
        ownerUser: { select: { id: true, name: true, avatarUrl: true } },
        proposal: { select: { id: true, title: true, status: true } },
        _count: { select: { milestones: true } },
      },
    });

    if (!project) throw ApiError.notFound('Project');

    const completedMilestonesCount = project.milestones.filter(
      (m) => m.status === MilestoneStatus.VERIFIED
    ).length;

    const milestones: MilestoneResponseDto[] = project.milestones.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      title: m.title,
      description: m.description,
      status: m.status as MilestoneStatus,
      dueDate: m.dueDate?.toISOString() ?? null,
      orderIndex: m.orderIndex,
      proposalMilestoneId: m.proposalMilestoneId,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    const members: ProjectMemberResponseDto[] = project.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    }));

    const base: ProjectDto = {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status as ProjectStatus,
      ownerGroupId: project.ownerGroupId,
      ownerUserId: project.ownerUserId,
      proposalId: project.proposalId,
      milestonesCount: project._count.milestones,
      completedMilestonesCount,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };

    return {
      ...base,
      milestones,
      members,
      ownerGroup: project.ownerGroup,
      ownerUser: project.ownerUser,
      proposal: project.proposal
        ? {
            id: project.proposal.id,
            title: project.proposal.title,
            status: project.proposal.status,
          }
        : null,
    };
  }

  // ── WORK LOGGING ────────────────────────────────────────────────────────────

  async logWork(userId: string, dto: LogWorkDto): Promise<WorkLogResponseDto> {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      select: { id: true, projectId: true, status: true },
    });
    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== 'IN_PROGRESS') {
      throw ApiError.badRequest(
        'Can only log work on an in-progress milestone'
      );
    }

    // Must be a project member
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
        totalIPEarned: 0, // awarded on verification
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

    // Must be project leader or a system verifier
    const isLeader = await roleService.isProjectLeader(
      verifierId,
      workLog.projectId!
    );
    const isVerifier = await roleService.isVerifier(verifierId);
    if (!isLeader && !isVerifier) {
      throw ApiError.forbidden(
        'Only project leaders or verifiers can verify work'
      );
    }

    const now = new Date();

    if (dto.approved) {
      const totalIPEarned = workLog.baseIP;

      const updated = await prisma.physicalWorkLog.update({
        where: { id: dto.workLogId },
        data: { verifiedAt: now, totalIPEarned },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Award IP to the worker
      await globalImpactPointService.award(
        workLog.userId,
        totalIPEarned,
        ImpactPointReason.PHYSICAL_WORK_VERIFIED
      );

      await auditService.log(
        verifierId,
        AuditAction.WORK_VERIFIED,
        'PhysicalWorkLog',
        dto.workLogId,
        { approved: true, totalIPEarned, workerId: workLog.userId }
      );

      logger.info(
        { verifierId, workLogId: dto.workLogId, approved: true },
        'Work verified'
      );
      return this.mapWorkLog(updated);
    } else {
      // Rejection — record via WorkVerification, don't award IP
      await prisma.workVerification.create({
        data: {
          workLogId: dto.workLogId,
          verifierId,
          method: 'SUPERVISOR',
          status: 'REJECTED',
          notes: dto.feedback,
          verifiedAt: now,
        },
      });

      await auditService.log(
        verifierId,
        AuditAction.WORK_VERIFIED,
        'PhysicalWorkLog',
        dto.workLogId,
        { approved: false, feedback: dto.feedback, workerId: workLog.userId }
      );

      logger.info(
        { verifierId, workLogId: dto.workLogId, approved: false },
        'Work rejected'
      );
      return this.mapWorkLog({ ...workLog, verifiedAt: null });
    }
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

  private mapWorkLog(w: any): WorkLogResponseDto {
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

export const projectService = new ProjectService();

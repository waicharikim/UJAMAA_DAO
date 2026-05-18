/**
 * @file src/modules/projects/services/project.service.ts
 * @description
 * Project Service — Execution of Approved Proposals (Funded or Non-Funded)
 */

import crypto from 'crypto';
import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { roleService } from '../../../core/services/role.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { treasuryService } from '../../treasury/services/treasury.service.js';
import { projectQueue } from '../../../core/queue/index.js';
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
  ContributeToProjectDto,
  ContributionResponseDto,
  CreateTaskDto,
  TaskDto,
  TaskListDto,
  MemberContributionDto,
  ClaimTaskResponseDto,
  CompleteTaskResponseDto,
  CreateWorkSessionDto,
  WorkSessionDto,
  WorkPresenceDto,
  ScanQrResponseDto,
  AttestResponseDto,
} from '../types.js';
import { ProjectStatus, MilestoneStatus, ProjectJobName } from '../types.js';
import { getUtContract } from '../../../core/blockchain/client.js';

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
      { proposalId: dto.proposalId, title: project.title }
    );

    await this.tryDebitGroupTreasury(proposal, project.id, userId);
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
      include: { project: { select: { title: true } } },
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
      {
        projectId: milestone.projectId,
        milestoneName: milestone.title,
        projectTitle: milestone.project.title,
      }
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
      {
        approved: dto.approved,
        projectId: milestone.projectId,
        milestoneName: milestone.title,
        projectTitle: milestone.project.title,
      }
    );

    if (dto.approved && milestone.submittedById)
      await this.awardMilestoneVerificationRewards(
        milestone.submittedById,
        milestone.projectId,
        dto.milestoneId
      );

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
        milestones: {
          orderBy: { orderIndex: 'asc' },
          include: {
            tasks: {
              orderBy: { createdAt: 'asc' },
              include: {
                assignedTo: {
                  select: { id: true, name: true, avatarUrl: true },
                },
              },
            },
          },
        },
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

    const milestones = this.mapMilestones(project.milestones);
    const members = this.mapProjectMembers(project.members);

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

  // ── Join project ─────────────────────────────────────────────────────────

  async joinProject(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, status: true },
    });
    if (!project) throw ApiError.notFound('Project');
    if (project.status === 'CANCELLED' || project.status === 'COMPLETED')
      throw ApiError.badRequest('Cannot join a completed or cancelled project');

    try {
      const member = await prisma.projectMember.create({
        data: { projectId, userId, role: 'CONTRIBUTOR' },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await this.awardProjectJoinRewards(userId, projectId);

      return {
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        user: member.user,
      };
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw ApiError.conflict('Already a member of this project');
      throw err;
    }
  }

  // ── UT contribution ───────────────────────────────────────────────────────

  async contributeToProject(
    userId: string,
    projectId: string,
    dto: ContributeToProjectDto
  ): Promise<ContributionResponseDto> {
    if (dto.amount <= 0) throw ApiError.badRequest('Amount must be positive');
    if (dto.amount > 100_000)
      throw ApiError.badRequest('Maximum single contribution is 100,000 UT');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, status: true, ownerGroupId: true },
    });
    if (!project) throw ApiError.notFound('Project');
    this.assertProjectAcceptsContributions(project);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fiatBackedUtBalance: true },
    });
    if (!user) throw ApiError.notFound('User');
    if (user.fiatBackedUtBalance < dto.amount)
      throw ApiError.forbidden(
        `Insufficient UT balance. You have ${user.fiatBackedUtBalance} UT.`
      );

    const { newBalance, transactionId } = await this.creditProjectTreasury(
      userId,
      project,
      dto.amount,
      projectId
    );

    await this.awardContributionRewards(userId, projectId, dto.amount);
    await this.burnUtOnChain(userId, projectId, dto.amount);

    logger.info(
      { userId, projectId, amount: dto.amount },
      'Project contribution recorded'
    );

    return { projectId, amount: dto.amount, newBalance, transactionId };
  }

  // ── Task CRUD ─────────────────────────────────────────────────────────────

  async createTask(userId: string, dto: CreateTaskDto): Promise<TaskDto> {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      select: { id: true, projectId: true },
    });
    if (!milestone) throw ApiError.notFound('Milestone');

    const isLeader = await roleService.isProjectLeader(
      userId,
      milestone.projectId
    );
    if (!isLeader)
      throw ApiError.forbidden('Only project leaders can create tasks');

    const task = await prisma.task.create({
      data: {
        milestoneId: dto.milestoneId,
        projectId: milestone.projectId,
        title: dto.title,
        description: dto.description ?? null,
        skillCategory: dto.skillCategory ?? null,
        maxAssignees: dto.maxAssignees ?? 1,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return {
      id: task.id,
      projectId: task.projectId,
      milestoneId: task.milestoneId,
      title: task.title,
      description: task.description,
      status: task.status as TaskDto['status'],
      skillCategory: task.skillCategory,
      maxAssignees: task.maxAssignees,
      dueDate: task.dueDate?.toISOString() ?? null,
      assignedTo: task.assignedTo,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async listProjectTasks(
    projectId: string,
    filters: { status?: string; skillCategory?: string }
  ): Promise<TaskListDto> {
    const where: Record<string, unknown> = { projectId };
    if (filters.status) where['status'] = filters.status;
    if (filters.skillCategory) where['skillCategory'] = filters.skillCategory;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        include: {
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        milestoneId: t.milestoneId,
        title: t.title,
        description: t.description,
        status: t.status as TaskDto['status'],
        skillCategory: t.skillCategory,
        maxAssignees: t.maxAssignees,
        dueDate: t.dueDate?.toISOString() ?? null,
        assignedTo: t.assignedTo,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      total,
    };
  }

  async getMemberContributions(
    projectId: string
  ): Promise<MemberContributionDto[]> {
    const [members, workLogs, presences] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.physicalWorkLog.findMany({
        where: { projectId, verifiedAt: { not: null } },
        select: { userId: true, hours: true, totalIPEarned: true },
      }),
      prisma.workPresence.findMany({
        where: { session: { projectId } },
        select: { userId: true, ipAwarded: true, awardedAt: true },
      }),
    ]);

    const taskCounts = await prisma.task.groupBy({
      by: ['assignedToId', 'status'],
      where: {
        projectId,
        assignedToId: { not: null },
        status: { in: ['IN_PROGRESS', 'DONE'] },
      },
      _count: { id: true },
    });

    return members.map((m) => {
      const userWorkLogs = workLogs.filter((l) => l.userId === m.userId);
      const userPresences = presences.filter((p) => p.userId === m.userId);
      const userTasks = taskCounts.filter((t) => t.assignedToId === m.userId);

      const tasksCompleted =
        userTasks.find((t) => t.status === 'DONE')?._count.id ?? 0;
      const tasksInProgress =
        userTasks.find((t) => t.status === 'IN_PROGRESS')?._count.id ?? 0;
      const hoursLogged = userWorkLogs.reduce((s, l) => s + Number(l.hours), 0);
      const sessionsAttended = userPresences.length;
      const impactPointsEarned =
        userWorkLogs.reduce((s, l) => s + l.totalIPEarned, 0) +
        userPresences.filter((p) => p.awardedAt).length * 10;

      return {
        userId: m.userId,
        user: m.user,
        role: m.role,
        tasksCompleted,
        tasksInProgress,
        hoursLogged,
        sessionsAttended,
        impactPointsEarned,
      };
    });
  }

  // ── Task claim + completion ───────────────────────────────────────────────

  async claimTask(
    userId: string,
    taskId: string
  ): Promise<ClaimTaskResponseDto> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        milestoneId: true,
        status: true,
        assignedToId: true,
        milestone: { select: { status: true } },
      },
    });
    if (!task) throw ApiError.notFound('Task');
    if (task.status !== 'TODO')
      throw ApiError.badRequest('Task is not available to claim');
    if (task.assignedToId) throw ApiError.conflict('Task is already claimed');
    if (task.milestone.status !== 'IN_PROGRESS')
      throw ApiError.badRequest(
        'Milestone must be in progress before claiming tasks'
      );

    await this.assertProjectMember(userId, task.projectId);

    await prisma.task.update({
      where: { id: taskId },
      data: { assignedToId: userId, status: 'IN_PROGRESS' },
    });

    return {
      taskId,
      projectId: task.projectId ?? '',
      milestoneId: task.milestoneId,
      status: 'IN_PROGRESS',
    };
  }

  async completeTask(
    userId: string,
    taskId: string
  ): Promise<CompleteTaskResponseDto> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, status: true, assignedToId: true },
    });
    if (!task) throw ApiError.notFound('Task');
    if (task.assignedToId !== userId)
      throw ApiError.forbidden(
        'Only the assigned member can complete this task'
      );
    if (task.status !== 'IN_PROGRESS')
      throw ApiError.badRequest('Task must be in progress to mark as done');

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'DONE' },
    });

    const IP_REWARD = 10;
    await participationRightsService
      .award(userId, 5, ParticipationRightsReason.TASK_COMPLETED, { taskId })
      .catch(() => {});
    await globalImpactPointService
      .award(userId, IP_REWARD, ImpactPointReason.TASK_COMPLETED, { taskId })
      .catch(() => {});

    return { taskId, status: 'DONE', ipAwarded: IP_REWARD };
  }

  // ── QR Work Sessions ─────────────────────────────────────────────────────

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

  private async tryDebitGroupTreasury(
    proposal: {
      groupFundingAmount: unknown;
      groupId: string | null;
      title: string;
    },
    projectId: string,
    userId: string
  ) {
    if (
      !proposal.groupFundingAmount ||
      Number(proposal.groupFundingAmount) <= 0 ||
      !proposal.groupId
    )
      return;
    try {
      await treasuryService.withdraw(
        proposal.groupId,
        {
          amount: Number(proposal.groupFundingAmount),
          description: `Project funding: ${proposal.title}`,
          projectId,
          referenceType: 'PROJECT_FUNDING',
        },
        userId
      );
    } catch (err) {
      logger.warn(
        { groupId: proposal.groupId, projectId, err },
        '[PROJECT] Treasury debit failed — project still created'
      );
    }
  }

  private async awardMilestoneVerificationRewards(
    submittedById: string,
    projectId: string,
    milestoneId: string
  ) {
    await participationRightsService
      .award(
        submittedById,
        DEFAULT_REWARDS.PR,
        ParticipationRightsReason.MILESTONE_VERIFIED,
        { projectId, milestoneId }
      )
      .catch((err) =>
        logger.warn({ err }, 'PR award failed after milestone verify')
      );
    await globalImpactPointService
      .award(
        submittedById,
        DEFAULT_REWARDS.IP,
        ImpactPointReason.MILESTONE_ACHIEVED,
        { projectId, milestoneId }
      )
      .catch((err) =>
        logger.warn({ err }, 'IP award failed after milestone verify')
      );
  }

  private mapMilestones(milestones: any[]): MilestoneResponseDto[] {
    return milestones.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      title: m.title,
      description: m.description,
      status: m.status as MilestoneStatus,
      dueDate: m.dueDate?.toISOString() ?? null,
      orderIndex: m.orderIndex,
      proposalMilestoneId: m.proposalMilestoneId,
      tasks:
        (m as any).tasks?.map((t: any) => ({
          id: t.id,
          projectId: t.projectId,
          milestoneId: t.milestoneId,
          title: t.title,
          description: t.description,
          status: t.status,
          skillCategory: t.skillCategory,
          maxAssignees: t.maxAssignees,
          dueDate: t.dueDate?.toISOString() ?? null,
          assignedTo: t.assignedTo,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })) ?? [],
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  private mapProjectMembers(members: any[]): ProjectMemberResponseDto[] {
    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    }));
  }

  private async awardProjectJoinRewards(userId: string, projectId: string) {
    await globalImpactPointService
      .award(userId, 5, ImpactPointReason.PROJECT_JOINED, { projectId })
      .catch(() => {});
    await auditService
      .log(userId, AuditAction.PROJECT_CREATED, 'Project', projectId, {
        action: 'MEMBER_JOINED',
      })
      .catch(() => {});
  }

  private assertProjectAcceptsContributions(project: {
    status: string;
    ownerGroupId: string | null;
  }): void {
    if (project.status !== 'ACTIVE' && project.status !== 'PLANNING')
      throw ApiError.badRequest('Project is not accepting contributions');
    if (!project.ownerGroupId)
      throw ApiError.badRequest(
        'Only group-owned projects accept UT contributions'
      );
  }

  private async creditProjectTreasury(
    userId: string,
    project: { id: string; title: string; ownerGroupId: string | null },
    amount: number,
    projectId: string
  ): Promise<{ newBalance: number; transactionId: string }> {
    return prisma.$transaction(async (t) => {
      const updated = await t.user.update({
        where: { id: userId },
        data: { fiatBackedUtBalance: { decrement: amount } },
        select: { fiatBackedUtBalance: true },
      });

      const treasury = await treasuryService.getOrCreateTreasury(
        project.ownerGroupId!
      );

      const walletTx = await t.walletTransaction.create({
        data: {
          treasuryId: treasury.id,
          amount,
          transactionType: 'CREDIT',
          description: `Contribution to project: ${project.title}`,
          referenceType: 'PROJECT_CONTRIBUTION',
          projectId,
          initiatedById: userId,
        },
      });

      await t.groupTreasury.update({
        where: { id: treasury.id },
        data: { balance: { increment: amount } },
      });

      return {
        newBalance: updated.fiatBackedUtBalance,
        transactionId: walletTx.id,
      };
    });
  }

  private async awardContributionRewards(
    userId: string,
    projectId: string,
    amount: number
  ): Promise<void> {
    await participationRightsService
      .award(userId, 10, ParticipationRightsReason.PROJECT_CONTRIBUTED, {
        projectId,
        amount,
      })
      .catch(() => {});
    await globalImpactPointService
      .award(userId, 10, ImpactPointReason.PROJECT_CONTRIBUTED, {
        projectId,
        amount,
      })
      .catch(() => {});
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
      {
        approved: true,
        totalIPEarned,
        workerId: workLog.userId,
      }
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
      {
        approved: false,
        feedback,
        workerId: workLog.userId,
      }
    );
    logger.info({ verifierId, workLogId, approved: false }, 'Work rejected');
    return this.mapWorkLog({ ...workLog, verifiedAt: null });
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

  private async burnUtOnChain(
    userId: string,
    projectId: string,
    amount: number
  ) {
    if (process.env.NODE_ENV === 'test') return;
    const contributor = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });
    if (!contributor?.walletAddress) return;
    const utContract = getUtContract();
    if (!utContract) return;
    try {
      const amountWei = BigInt(amount) * BigInt(10 ** 18);
      await utContract.burn(contributor.walletAddress, amountWei);
      logger.info(
        { userId, projectId, amount },
        '[UT] On-chain burn succeeded (contribution)'
      );
    } catch (err) {
      logger.warn(
        { userId, err },
        '[UT] On-chain burn failed — off-chain record intact'
      );
    }
  }

  private async assertProjectMember(userId: string, projectId: string | null) {
    if (!projectId) return;
    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!isMember)
      throw ApiError.forbidden('Join the project before claiming tasks');
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

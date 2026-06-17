/**
 * @file src/modules/projects/services/project.service.ts
 * @description
 * Project Service — Execution of Approved Proposals (Funded or Non-Funded)
 */

import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { roleService } from '../../../core/services/role.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { treasuryService } from '../../treasury/services/treasury.service.js';
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
import {
  ProjectStatus,
  MilestoneStatus,
  ProjectParticipation,
} from '../types.js';
import { getUtContract } from '../../../core/blockchain/client.js';
import { workSessionService } from './work-session.service.js';
import { workLogService } from './work-log.service.js';

const DEFAULT_REWARDS = { IP: 50, PR: 25 };

function isProjectClosed(status: string): boolean {
  return status === 'CANCELLED' || status === 'COMPLETED';
}

export class ProjectService {
  /**
   * Create project from an APPROVED proposal (funded or non-funded)
   */
  async createFromProposal(userId: string, dto: CreateProjectFromProposalDto) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: dto.proposalId },
      include: { group: true, milestones: { orderBy: { orderIndex: 'asc' } } },
    });

    this.assertProposalForNewProject(proposal, userId);

    const existing = await prisma.project.findFirst({
      where: { proposalId: dto.proposalId },
    });
    if (existing)
      throw ApiError.conflict('Project already exists for this proposal');

    // Project-setup gate: when the creator supplies milestones, they replace the
    // proposal's milestones and become the project's plan (full editor). When
    // omitted, the project inherits whatever the proposal already had.
    if (dto.milestones?.length) {
      await this.writeProposalMilestones(dto.proposalId, dto.milestones);
    }
    const milestones = await prisma.proposalMilestone.findMany({
      where: { proposalId: dto.proposalId },
      orderBy: { orderIndex: 'asc' },
    });

    const project = await prisma.project.create({
      data: {
        proposalId: dto.proposalId,
        ownerGroupId: proposal!.groupId,
        ownerUserId: userId,
        title: proposal!.title,
        description: proposal!.description,
        status: ProjectStatus.PLANNING,
      },
    });

    await prisma.projectMember.create({
      data: { projectId: project.id, userId, role: 'LEAD' },
    });

    await this.createMilestonesFromProposal(project.id, milestones);

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

    // NOTE: treasury is NOT debited here. Disbursement happens once, when the
    // proposal transitions APPROVED → EXECUTING (proposal-lifecycle service),
    // which now requires this project to exist first.
    return project;
  }

  // Replace the proposal's milestones with a setup payload (full editor).
  // Safe to delete first: no project/Milestone rows link to them yet (the
  // caller has already confirmed no project exists for this proposal).
  private async writeProposalMilestones(
    proposalId: string,
    milestones: NonNullable<CreateProjectFromProposalDto['milestones']>
  ): Promise<void> {
    await prisma.proposalMilestone.deleteMany({ where: { proposalId } });
    await prisma.proposalMilestone.createMany({
      data: milestones.map((m, i) => ({
        proposalId,
        title: m.title,
        description: m.description,
        deliverables: (m.deliverables ?? []) as Prisma.InputJsonValue,
        budgetAmount: m.budgetAmount,
        laborHours: m.laborHours ?? null,
        materials: (m.materials ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        startOffset: m.startOffset,
        duration: m.duration,
        dependencies: m.dependencies ?? [],
        verificationMethod: m.verificationMethod,
        verifiersNeeded: m.verifiersNeeded ?? 1,
        verificationCriteria: (m.verificationCriteria ??
          []) as Prisma.InputJsonValue,
        orderIndex: m.orderIndex ?? i,
      })),
    });
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
    // Separation of duties: you may not sign off on your own submission. A
    // single-leader group uses the platform VERIFIER role as the second party.
    if (milestone.submittedById && milestone.submittedById === verifierId)
      throw ApiError.forbidden('You cannot verify your own submission');
    await this.assertMilestoneVerifyAuth(verifierId, milestone.projectId);
    const newStatus = await this.applyMilestoneVerification(
      verifierId,
      dto,
      milestone
    );
    return { status: newStatus };
  }

  private async assertMilestoneVerifyAuth(
    verifierId: string,
    projectId: string
  ): Promise<void> {
    const [isLeader, isVerifier] = await Promise.all([
      roleService.isProjectLeader(verifierId, projectId),
      roleService.isVerifier(verifierId),
    ]);
    if (!isLeader && !isVerifier)
      throw ApiError.forbidden('Not authorised to verify milestones');
  }

  private async applyMilestoneVerification(
    verifierId: string,
    dto: VerifyMilestoneDto,
    milestone: {
      id: string;
      projectId: string;
      title: string;
      submittedById: string | null;
      project: { title: string };
    }
  ): Promise<MilestoneStatus> {
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

    return newStatus;
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
    /** When set and no explicit owner filter is given, the list is scoped to
     *  projects this viewer can actually reach (their groups + geographically
     *  open projects in their area + their own). */
    viewerId?: string;
  }): Promise<ListProjectsDto> {
    const {
      ownerGroupId,
      ownerUserId,
      status,
      limit = 20,
      offset = 0,
      viewerId,
    } = params;

    const where: Record<string, unknown> = {};
    if (ownerGroupId) where.ownerGroupId = ownerGroupId;
    if (ownerUserId) where.ownerUserId = ownerUserId;
    if (status) where.status = status;

    // Scope to the viewer when they didn't ask for a specific owner. An explicit
    // ownerGroupId/ownerUserId filter (e.g. a group's own project page) keeps the
    // transparent, unscoped behaviour.
    if (viewerId && !ownerGroupId && !ownerUserId) {
      where.OR = await this.buildViewerScope(viewerId);
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: { select: { milestones: true } },
          ownerGroup: { select: { name: true } },
        },
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
        ownerGroupName: p.ownerGroup?.name ?? null,
        ownerUserId: p.ownerUserId,
        proposalId: p.proposalId,
        participationScope: p.participationScope as ProjectParticipation,
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
        ownerGroup: { select: { id: true, name: true, isSystemGroup: true } },
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
      ownerGroupName: project.ownerGroup?.name ?? null,
      ownerUserId: project.ownerUserId,
      proposalId: project.proposalId,
      participationScope: project.participationScope as ProjectParticipation,
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

  // ── Work Logging (delegated to WorkLogService) ───────────────────────────

  async logWork(userId: string, dto: LogWorkDto): Promise<WorkLogResponseDto> {
    return workLogService.logWork(userId, dto);
  }

  async verifyWork(
    verifierId: string,
    dto: VerifyWorkDto
  ): Promise<WorkLogResponseDto> {
    return workLogService.verifyWork(verifierId, dto);
  }

  async listWorkLogs(milestoneId: string): Promise<WorkLogListDto> {
    return workLogService.listWorkLogs(milestoneId);
  }

  // ── Join project ─────────────────────────────────────────────────────────

  async joinProject(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, status: true },
    });
    if (!project) throw ApiError.notFound('Project');
    if (isProjectClosed(project.status))
      throw ApiError.badRequest('Cannot join a completed or cancelled project');
    await this.assertCanParticipate(userId, projectId);
    return this.createProjectMembership(userId, projectId);
  }

  /**
   * Set a project's participation scope (leader-only, gated at the route).
   * Only meaningful for voluntary-group projects — a system group's project
   * already reaches everyone in its tier, so widening it is rejected.
   */
  async setParticipationScope(
    leaderId: string,
    projectId: string,
    scope: ProjectParticipation
  ): Promise<{ projectId: string; participationScope: ProjectParticipation }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        ownerGroup: { select: { isSystemGroup: true } },
      },
    });
    if (!project) throw ApiError.notFound('Project');
    if (isProjectClosed(project.status))
      throw ApiError.badRequest(
        'Cannot change a completed or cancelled project'
      );
    if (
      scope !== ProjectParticipation.MEMBERS_ONLY &&
      project.ownerGroup?.isSystemGroup
    )
      throw ApiError.badRequest(
        'System-group projects already include everyone in their area'
      );

    await prisma.project.update({
      where: { id: projectId },
      data: { participationScope: scope },
    });
    return { projectId, participationScope: scope };
  }

  /**
   * Gate on who may participate (join / claim / contribute) in a project.
   *
   * A project belongs to a group, and the group already encodes the right
   * audience:
   *  1. Members of the owning group may always participate. For system groups
   *     (ward / constituency / county) every resident at that tier is an
   *     auto-enrolled member, so this single check already covers community and
   *     cross-ward projects.
   *  2. A voluntary group may widen a project to its surrounding geography
   *     (WARD / CONSTITUENCY / COUNTY) — anyone whose residence falls inside the
   *     owning group's ward / constituency / county may then join, even if they
   *     are not a formal member.
   */
  private async assertCanParticipate(
    userId: string,
    projectId: string
  ): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerGroupId: true,
        participationScope: true,
        ownerGroup: { select: { wardId: true } },
      },
    });
    if (!project) throw ApiError.notFound('Project');

    if (project.ownerGroupId) {
      const membership = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId: project.ownerGroupId },
        },
        select: { active: true },
      });
      if (membership?.active) return;
    }

    if (
      project.participationScope !== ProjectParticipation.MEMBERS_ONLY &&
      project.ownerGroup?.wardId &&
      (await this.isWithinProjectGeography(
        userId,
        project.ownerGroup.wardId,
        project.participationScope as ProjectParticipation
      ))
    )
      return;

    throw ApiError.forbidden(
      "You must belong to this project's group to participate"
    );
  }

  /**
   * Build the `OR` clauses that scope a project list to what a viewer can reach:
   *  - projects of groups they actively belong to (spans their ward /
   *    constituency / county system groups via auto-enrollment, plus voluntary
   *    groups),
   *  - geographically-open projects whose owning group's ward / constituency /
   *    county matches the viewer's residence at that tier,
   *  - projects they personally own.
   */
  private async buildViewerScope(
    viewerId: string
  ): Promise<Record<string, unknown>[]> {
    const wardSelect = {
      id: true,
      constituencyId: true,
      countyId: true,
    } as const;
    const [memberships, user] = await Promise.all([
      prisma.groupMember.findMany({
        where: { userId: viewerId, active: true },
        select: { groupId: true },
      }),
      prisma.user.findUnique({
        where: { id: viewerId },
        select: {
          primaryWard: { select: wardSelect },
          secondaryWard: { select: wardSelect },
        },
      }),
    ]);

    const groupIds = memberships.map((m) => m.groupId);
    const wards = [user?.primaryWard, user?.secondaryWard].filter(
      (w): w is { id: string; constituencyId: string; countyId: string } =>
        w != null
    );
    const wardIds = [...new Set(wards.map((w) => w.id))];
    const constituencyIds = [...new Set(wards.map((w) => w.constituencyId))];
    const countyIds = [...new Set(wards.map((w) => w.countyId))];

    return [
      { ownerGroupId: { in: groupIds } },
      { ownerUserId: viewerId },
      {
        participationScope: ProjectParticipation.WARD,
        ownerGroup: { wardId: { in: wardIds } },
      },
      {
        participationScope: ProjectParticipation.CONSTITUENCY,
        ownerGroup: { ward: { constituencyId: { in: constituencyIds } } },
      },
      {
        participationScope: ProjectParticipation.COUNTY,
        ownerGroup: { ward: { countyId: { in: countyIds } } },
      },
    ];
  }

  /** True when the user's primary/secondary ward falls inside the project's
   *  geography at the requested tier. */
  private async isWithinProjectGeography(
    userId: string,
    projectWardId: string,
    scope: ProjectParticipation
  ): Promise<boolean> {
    const wardSelect = {
      id: true,
      constituencyId: true,
      countyId: true,
    } as const;
    const [projectWard, user] = await Promise.all([
      prisma.ward.findUnique({
        where: { id: projectWardId },
        select: wardSelect,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          primaryWard: { select: wardSelect },
          secondaryWard: { select: wardSelect },
        },
      }),
    ]);
    if (!projectWard || !user) return false;

    const userWards = [user.primaryWard, user.secondaryWard].filter(
      (w): w is { id: string; constituencyId: string; countyId: string } =>
        w != null
    );

    return userWards.some((w) => {
      if (scope === ProjectParticipation.WARD) return w.id === projectWard.id;
      if (scope === ProjectParticipation.CONSTITUENCY)
        return w.constituencyId === projectWard.constituencyId;
      return w.countyId === projectWard.countyId; // COUNTY
    });
  }

  private async createProjectMembership(userId: string, projectId: string) {
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

  // ── Member management (leader-only) ──────────────────────────────────────

  async addMember(
    leaderId: string,
    projectId: string,
    dto: { userId: string; role?: string }
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!project) throw ApiError.notFound('Project');
    if (isProjectClosed(project.status))
      throw ApiError.badRequest('Cannot add members to a closed project');
    if (dto.userId === leaderId)
      throw ApiError.badRequest('You are already a member');

    const role = (dto.role ?? 'CONTRIBUTOR') as any;
    try {
      const member = await prisma.projectMember.create({
        data: { projectId, userId: dto.userId, role },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      await this.awardProjectJoinRewards(dto.userId, projectId);
      return {
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        user: member.user,
      };
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw ApiError.conflict('User is already a member of this project');
      if (err?.code === 'P2003') throw ApiError.notFound('User');
      throw err;
    }
  }

  async removeMember(leaderId: string, projectId: string, userId: string) {
    if (userId === leaderId) {
      // Ensure there's another LEAD before allowing self-removal
      const otherLeads = await prisma.projectMember.count({
        where: { projectId, role: 'LEAD', userId: { not: leaderId } },
      });
      if (otherLeads === 0)
        throw ApiError.badRequest(
          'Cannot remove yourself — assign another lead first'
        );
    }

    const deleted = await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });
    if (deleted.count === 0)
      throw ApiError.notFound('Member not found in this project');

    await auditService
      .log(leaderId, AuditAction.PROJECT_CREATED, 'Project', projectId, {
        action: 'MEMBER_REMOVED',
        removedUserId: userId,
      })
      .catch(() => {});
  }

  async updateMemberRole(
    leaderId: string,
    projectId: string,
    userId: string,
    role: string
  ) {
    if (userId === leaderId && role !== 'LEAD') {
      const otherLeads = await prisma.projectMember.count({
        where: { projectId, role: 'LEAD', userId: { not: leaderId } },
      });
      if (otherLeads === 0)
        throw ApiError.badRequest(
          'Cannot demote yourself — assign another lead first'
        );
    }

    const updated = await prisma.projectMember.updateMany({
      where: { projectId, userId },
      data: { role: role as any },
    });
    if (updated.count === 0)
      throw ApiError.notFound('Member not found in this project');
  }

  // ── UT contribution ───────────────────────────────────────────────────────

  async contributeToProject(
    userId: string,
    projectId: string,
    dto: ContributeToProjectDto
  ): Promise<ContributionResponseDto> {
    this.assertContributionAmount(dto.amount);

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
    this.assertTaskClaimable(task);
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
    this.assertTaskCompletable(task, userId);
    // Defense-in-depth: a member could have been removed from the owning group
    // after claiming. Re-check membership before crediting completion.
    await this.assertProjectMember(userId, task.projectId);

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

  // ── QR Work Sessions (delegated to WorkSessionService) ───────────────────

  async createWorkSession(
    leaderId: string,
    dto: CreateWorkSessionDto
  ): Promise<WorkSessionDto> {
    return workSessionService.createWorkSession(leaderId, dto);
  }

  async scanQr(userId: string, qrSecret: string): Promise<ScanQrResponseDto> {
    return workSessionService.scanQr(userId, qrSecret);
  }

  async attestPresence(
    attestorId: string,
    sessionId: string,
    targetUserId: string
  ): Promise<AttestResponseDto> {
    return workSessionService.attestPresence(
      attestorId,
      sessionId,
      targetUserId
    );
  }

  async closeWorkSession(sessionId: string): Promise<WorkSessionDto> {
    return workSessionService.closeWorkSession(sessionId);
  }

  async getWorkSession(
    sessionId: string
  ): Promise<WorkSessionDto & { presences: WorkPresenceDto[] }> {
    return workSessionService.getWorkSession(sessionId);
  }

  private assertProposalForNewProject(
    proposal: {
      status: string;
      creatorId: string | null;
      kind?: string;
    } | null,
    userId: string
  ): void {
    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.kind === 'POLICY')
      throw ApiError.badRequest(
        'Policy proposals are decisions and do not create projects.'
      );
    if (proposal.status !== 'APPROVED')
      throw ApiError.badRequest('Proposal must be approved');
    if (proposal.creatorId !== userId)
      throw ApiError.forbidden(
        'Only the proposal creator can create a project'
      );
  }

  private async createMilestonesFromProposal(
    projectId: string,
    milestones: Array<{
      id: string;
      title: string;
      description: string | null;
      orderIndex: number;
    }>
  ): Promise<void> {
    if (!milestones.length) return;
    await prisma.milestone.createMany({
      data: milestones.map((m) => ({
        projectId,
        proposalMilestoneId: m.id,
        title: m.title,
        description: m.description ?? null,
        orderIndex: m.orderIndex,
        status: MilestoneStatus.PENDING,
      })),
    });
  }

  private assertTaskCompletable(
    task: { assignedToId: string | null; status: string },
    userId: string
  ): void {
    if (task.assignedToId !== userId)
      throw ApiError.forbidden(
        'Only the assigned member can complete this task'
      );
    if (task.status !== 'IN_PROGRESS')
      throw ApiError.badRequest('Task must be in progress to mark as done');
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
      submittedById: m.submittedById ?? null,
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

  private assertContributionAmount(amount: number): void {
    if (amount <= 0) throw ApiError.badRequest('Amount must be positive');
    if (amount > 100_000)
      throw ApiError.badRequest('Maximum single contribution is 100,000 UT');
  }

  private assertTaskClaimable(task: {
    status: string;
    assignedToId: string | null;
    milestone: { status: string };
  }): void {
    if (task.status !== 'TODO')
      throw ApiError.badRequest('Task is not available to claim');
    if (task.assignedToId) throw ApiError.conflict('Task is already claimed');
    if (task.milestone.status !== 'IN_PROGRESS')
      throw ApiError.badRequest(
        'Milestone must be in progress before claiming tasks'
      );
  }

  private async assertProjectMember(userId: string, projectId: string | null) {
    if (!projectId) return;
    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!isMember)
      throw ApiError.forbidden('Join the project before claiming tasks');
  }
}

export const projectService = new ProjectService();

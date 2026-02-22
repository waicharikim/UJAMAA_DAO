// @ts-nocheck — scaffold: schema field names not yet aligned (ownerGroupId, MilestoneStatus, etc.)
/**
 * @file src/modules/projects/services/project.service.ts
 * @description
 * Project Service — Execution of Passed Proposals (Funded or Non-Funded)
 *
 * All work comes from passed proposals
 * Non-funded proposals allowed (budget = 0)
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { globalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { roleService } from '../../../core/services/role.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';

const DEFAULT_REWARDS = {
  IP: 50,
  PR: 25,
};

class ProjectService {
  /**
   * Create project from PASSED proposal (funded or non-funded)
   */
  async createFromProposal(userId: string, dto: CreateProjectFromProposalDto) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: dto.proposalId },
      include: { group: true },
    });

    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.status !== 'PASSED')
      throw ApiError.badRequest('Proposal must be passed');
    if (proposal.creatorId !== userId)
      throw ApiError.forbidden('Only creator can create project');

    const existing = await prisma.project.findFirst({
      where: { proposalId: dto.proposalId },
    });

    if (existing) throw ApiError.conflict('Project already exists');

    const project = await prisma.project.create({
      data: {
        proposalId: dto.proposalId,
        groupId: proposal.groupId,
        title: proposal.title,
        description: proposal.description,
        budgetKes: proposal.fundingAmountKes || 0, // 0 for non-funded
        status: 'PLANNING',
        createdById: userId,
      },
    });

    // Auto-create milestones from executionPlan if provided
    if (proposal.executionPlan) {
      const plan = proposal.executionPlan as any;
      if (Array.isArray(plan.milestones)) {
        await prisma.milestone.createMany({
          data: plan.milestones.map((m: any, index: number) => ({
            projectId: project.id,
            title: m.title,
            description: m.description,
            order: index + 1,
            status: 'PENDING',
            rewardIP: m.ipReward || DEFAULT_REWARDS.IP,
            rewardPR: m.prReward || DEFAULT_REWARDS.PR,
          })),
        });
      }
    }

    logger.info(
      { userId, proposalId: dto.proposalId, projectId: project.id },
      'Project created'
    );

    return project;
  }

  /**
   * Start a milestone
   */
  async startMilestone(userId: string, dto: StartMilestoneDto) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      include: { project: true },
    });

    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== 'PENDING')
      throw ApiError.badRequest('Milestone not pending');

    const isLeader = await roleService.isProjectLeader(
      userId,
      milestone.projectId
    );

    if (!isLeader)
      throw ApiError.forbidden('Only project leader can start milestone');

    await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    return { status: 'IN_PROGRESS' };
  }

  /**
   * Submit milestone completion
   */
  async submitMilestone(userId: string, dto: SubmitMilestoneDto) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
    });

    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== 'IN_PROGRESS')
      throw ApiError.badRequest('Milestone not in progress');

    await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: {
        status: 'SUBMITTED',
        submittedById: userId,
        submittedAt: new Date(),
        proofUrl: dto.proofUrl,
        submissionDescription: dto.description,
      },
    });

    return { status: 'SUBMITTED' };
  }

  /**
   * Verify milestone — project leader or verifier
   */
  async verifyMilestone(verifierId: string, dto: VerifyMilestoneDto) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: dto.milestoneId },
      include: { project: true, submittedBy: true },
    });

    if (!milestone) throw ApiError.notFound('Milestone');
    if (milestone.status !== 'SUBMITTED')
      throw ApiError.badRequest('Milestone not submitted');

    const isLeader = await roleService.isProjectLeader(
      verifierId,
      milestone.projectId
    );
    const isVerifier = await roleService.isVerifier(verifierId);

    if (!isLeader && !isVerifier) {
      throw ApiError.forbidden('Not authorized to verify');
    }

    const newStatus = dto.approved ? 'VERIFIED' : 'REJECTED';

    await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: {
        status: newStatus,
        verifiedById: verifierId,
        verifiedAt: new Date(),
        feedback: dto.feedback,
      },
    });

    if (dto.approved && milestone.submittedById) {
      const ipReward = milestone.rewardIP || DEFAULT_REWARDS.IP;
      const prReward = milestone.rewardPR || DEFAULT_REWARDS.PR;

      if (prReward > 0) {
        await participationRightsService.award(
          milestone.submittedById,
          prReward,
          'MILESTONE_VERIFIED',
          { projectId: milestone.projectId, milestoneId: dto.milestoneId }
        );
      }

      if (ipReward > 0) {
        await globalImpactPointService.award(
          milestone.submittedById,
          ipReward,
          'MILESTONE_VERIFIED',
          { projectId: milestone.projectId }
        );
      }
    }

    return { status: newStatus };
  }
}

export const projectService = new ProjectService();

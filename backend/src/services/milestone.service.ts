/**
 * @file milestone.service.ts
 *
 * @description
 * Service layer for managing Project Milestones within UjamaaDAO.
 * Responsibilities:
 * - Creating milestones
 * - Submitting milestones for review
 * - Approving or rejecting milestones
 * - (Future) Handling related impact points and fund disbursement triggers
 */

import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export enum MilestoneStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class MilestoneService {
  /**
   * Create a new milestone linked to a project.
   * @param projectId string - ID of the project
   * @param milestoneData {title, description, dueDate?, fundingAmount}
   */
  static async createMilestone(
    projectId: string,
    milestoneData: {
      title: string;
      description: string;
      dueDate?: Date;
      fundingAmount: number;
    }
  ) {
    logger.info('Creating milestone called', { projectId, milestoneData });

    // Confirm the project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      logger.warn('Project not found during milestone creation', { projectId });
      throw new ApiError('Project not found', 404);
    }

    if (milestoneData.fundingAmount <= 0) {
      logger.warn('Invalid milestone funding amount', { fundingAmount: milestoneData.fundingAmount });
      throw new ApiError('Funding amount must be positive', 400);
    }

    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId,
        title: milestoneData.title,
        description: milestoneData.description,
        dueDate: milestoneData.dueDate,
        fundingAmount: milestoneData.fundingAmount,
        status: MilestoneStatus.PENDING,
      },
    });

    logger.info('Milestone created successfully', { milestoneId: milestone.id });
    return milestone;
  }

  /**
   * Submit a milestone for review.
   * @param milestoneId string - ID of the milestone
   * @param submittedBy string - userId of the submitter
   */
  static async submitMilestone(milestoneId: string, submittedBy: string) {
    logger.info('Submitting milestone for review', { milestoneId, submittedBy });

    // Fetch milestone
    const milestone = await prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) {
      throw new ApiError('Milestone not found', 404);
    }

    if (![MilestoneStatus.PENDING, MilestoneStatus.REJECTED].includes(milestone.status)) {
      logger.warn('Milestone cannot be submitted in current status', { milestoneId, status: milestone.status });
      throw new ApiError('Milestone cannot be submitted in its current status', 400);
    }

    const updated = await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: { status: MilestoneStatus.UNDER_REVIEW },
    });

    logger.info('Milestone status updated to UNDER_REVIEW', { milestoneId });
    return updated;
  }

  /**
   * Approve or reject a milestone after review.
   * @param milestoneId string - ID of the milestone
   * @param approved boolean - true if approved, false otherwise
   * @param reviewerId string - userId of reviewer
   */
  static async reviewMilestone(milestoneId: string, approved: boolean, reviewerId: string) {
    logger.info('Reviewing milestone', { milestoneId, approved, reviewerId });

    const milestone = await prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) {
      throw new ApiError('Milestone not found', 404);
    }

    if (milestone.status !== MilestoneStatus.UNDER_REVIEW) {
      logger.warn('Milestone is not under review', { milestoneId, currentStatus: milestone.status });
      throw new ApiError('Milestone is not under review', 400);
    }

    const newStatus = approved ? MilestoneStatus.APPROVED : MilestoneStatus.REJECTED;

    const updated = await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: { status: newStatus },
    });

    logger.info('Milestone review completed', { milestoneId, newStatus });

    // TODO: On approval, trigger fund disbursement and impact point rewards

    return updated;
  }
}
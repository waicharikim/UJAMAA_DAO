/**
 * @file project.service.ts
 *
 * @description
 * Service layer managing Projects for UjamaaDAO.
 * Handles:
 * - Creating projects from approved proposals
 * - Managing project metadata lifecycle
 * - Delegates milestone operations to MilestoneService
 * - Participant management and impact point adjustments (if applicable)
 */

import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { MilestoneService } from './milestone.service.js'; // Import MilestoneService

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

export class ProjectService {
  /**
   * Creates a new project from an approved proposal.
   *
   * @param proposalId string UUID of the approved proposal
   * @param data additional project fields (optional)
   * @returns Project created
   * @throws ApiError if proposal not approved or other validations fail
   */
  static async createProjectFromProposal(
    proposalId: string,
    data?: Partial<{ title: string; description: string; budget: number; timeline: string }>
  ) {
    logger.info('createProjectFromProposal called', { proposalId });

    try {
      const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });

      if (!proposal) {
        logger.warn('Proposal not found', { proposalId });
        throw new ApiError('Proposal not found', 404);
      }

      if (proposal.status !== 'APPROVED') {
        logger.warn('Proposal not approved', { proposalId, status: proposal.status });
        throw new ApiError('Cannot create project from unapproved proposal', 400);
      }

      const projectData = {
        proposalId,
        title: data?.title ?? proposal.title,
        description: data?.description ?? proposal.description,
        budget: data?.budget ?? proposal.budget ?? 0,
        timeline: data?.timeline ?? proposal.timeline ?? '',
        status: ProjectStatus.ACTIVE,
        locationScope: proposal.locationScope,
        constituency: proposal.constituency,
        county: proposal.county,
      };

      logger.info('Creating project with data', projectData);

      const project = await prisma.project.create({ data: projectData });

      logger.info('Project created', { projectId: project.id, proposalId });

      return project;
    } catch (error) {
      logger.error('Error in createProjectFromProposal:', error);
      throw error;
    }
  }

  /**
   * Retrieves a project by its ID.
   *
   * @param id string
   * @returns Project
   * @throws ApiError if project not found
   */
  static async getProjectById(id: string) {
    logger.info('getProjectById called', { id });
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        proposal: true,
        participants: true,
        milestones: true,
      },
    });

    if (!project) {
      logger.warn('Project not found', { id });
      throw new ApiError('Project not found', 404);
    }

    return project;
  }

  /**
   * Lists projects with optional filtering and pagination.
   *
   * @param filters optional object with status, constituency, county, limit, offset
   * @returns array of projects
   */
  static async listProjects(filters?: {
    status?: string;
    constituency?: string;
    county?: string;
    limit?: number;
    offset?: number;
  }) {
    logger.info('listProjects called', { filters });

    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.constituency) where.constituency = filters.constituency;
    if (filters?.county) where.county = filters.county;

    const projects = await prisma.project.findMany({
      where,
      take: filters?.limit ?? 20,
      skip: filters?.offset ?? 0,
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  /**
   * Updates project metadata.
   *
   * @param id string Project ID
   * @param data partial project data to update
   * @returns updated Project
   * @throws ApiError if not found
   */
  static async updateProject(id: string, data: Partial<{
    title: string;
    description: string;
    budget: number;
    timeline: string;
    status: string;
  }>) {
    logger.info('updateProject called', { id, data });

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      logger.warn('Project not found for update', { id });
      throw new ApiError('Project not found', 404);
    }

    const updated = await prisma.project.update({
      where: { id },
      data,
    });

    return updated;
  }

  /**
   * Deletes or cancels a project
   *
   * @param id string Project ID
   * @throws ApiError if not found
   */
  static async deleteProject(id: string) {
    logger.info('deleteProject called', { id });

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      logger.warn('Project not found for delete', { id });
      throw new ApiError('Project not found', 404);
    }

    await prisma.project.delete({ where: { id } });

    logger.info('Project deleted', { id });
  }
}
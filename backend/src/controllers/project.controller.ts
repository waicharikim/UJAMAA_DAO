/**
 * @file project.controller.ts
 *
 * @description
 * Express controller for Project management within UjamaaDAO.
 * Provides full CRUD operations and integrates validation, error handling, and logging.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ProjectService } from '../services/project.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

// Validation schemas for project operations
const createProjectSchema = z.object({
  proposalId: z.string().uuid(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  budget: z.number().int().nonnegative().optional(),
  timeline: z.string().optional(),
});

const updateProjectSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  budget: z.number().int().nonnegative().optional(),
  timeline: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
});

const listProjectsSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
  constituency: z.string().optional(),
  county: z.string().optional(),
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

// Controller handlers

export async function createProjectFromProposalHandler(req: Request, res: Response, next: NextFunction) {
  logger.info('Received request to create project', { body: req.body, user: (req as any).user });

  try {
    const data = createProjectSchema.parse(req.body);
    logger.info('Validated project creation input', { data });

    const project = await ProjectService.createProjectFromProposal(data.proposalId, data);

    res.status(201).json(project);
    logger.info('Project created successfully', { projectId: project.id });
  } catch (err) {
    logger.error('Error in createProjectFromProposalHandler', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      requestBody: req.body,
      user: (req as any).user,
    });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    if (typeof err === 'object' && err !== null && 'name' in err && (err as any).name === 'ZodError') {
      return res.status(400).json({ errors: (err as any).errors });
    }
    next(err);
  }
}

export async function getProjectByIdHandler(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.id;
  logger.info('Fetching project by ID', { projectId });

  try {
    const project = await ProjectService.getProjectById(projectId);
    res.json(project);
  } catch (err) {
    logger.error('Error in getProjectByIdHandler', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      projectId,
    });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

export async function listProjectsHandler(req: Request, res: Response, next: NextFunction) {
  // Parse and validate query params for filters & pagination
  try {
    const queryData = listProjectsSchema.parse(req.query);
    logger.info('Listing projects', { filters: queryData });

    const projects = await ProjectService.listProjects(queryData);
    res.json(projects);
  } catch (err) {
    logger.error('Error in listProjectsHandler', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      query: req.query,
    });
    if (typeof err === 'object' && err !== null && 'name' in err && (err as any).name === 'ZodError') {
      return res.status(400).json({ errors: (err as any).errors });
    }
    next(err);
  }
}

export async function updateProjectHandler(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.id;
  try {
    const updateData = updateProjectSchema.parse(req.body);
    logger.info('Updating project', { projectId, updateData });

    const updatedProject = await ProjectService.updateProject(projectId, updateData);
    res.json(updatedProject);
  } catch (err) {
    logger.error('Error in updateProjectHandler', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      projectId,
      updateData: req.body,
    });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    if (typeof err === 'object' && err !== null && 'name' in err && (err as any).name === 'ZodError') {
      return res.status(400).json({ errors: (err as any).errors });
    }
    next(err);
  }
}

export async function deleteProjectHandler(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.id;

  logger.info('Deleting project', { projectId });

  try {
    await ProjectService.deleteProject(projectId);
    res.status(204).send();
  } catch (err) {
    logger.error('Error in deleteProjectHandler', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      projectId,
    });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}
import type { Request, Response, NextFunction } from 'express';
import { MilestoneService } from '../services/milestone.service.js'; // Assuming you will have this separated
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import {
  createMilestoneSchema,
  submitMilestoneSchema,
  reviewMilestoneSchema,
} from '../validation/milestone.validation.js';

export async function createMilestoneHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createMilestoneSchema.parse(req.body);
    logger.info('Creating project milestone', { projectId: data.projectId });

    const milestone = await MilestoneService.createMilestone(data.projectId, {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      fundingAmount: data.fundingAmount,
    });

    res.status(201).json(milestone);
    logger.info('Milestone created', { milestoneId: milestone.id });
  } catch (err) {
    logger.error('Error in createMilestoneHandler', {
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

export async function submitMilestoneHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = submitMilestoneSchema.parse(req.body);
    const userId = (req as any).user?.userId;
    if (!userId) throw new ApiError('Unauthorized', 401);

    logger.info('Submitting milestone for review', { milestoneId: data.milestoneId, submittedBy: userId });

    const milestone = await MilestoneService.submitMilestone(data.milestoneId, userId);

    res.json(milestone);
    logger.info('Milestone submitted', { milestoneId: milestone.id });
  } catch (err) {
    logger.error('Error in submitMilestoneHandler', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      requestBody: req.body,
      user: (req as any).user,
    });
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (typeof err === 'object' && err !== null && 'name' in err && (err as any).name === 'ZodError') {
      return res.status(400).json({ errors: (err as any).errors });
    }
    next(err);
  }
}

export async function reviewMilestoneHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = reviewMilestoneSchema.parse(req.body);
    const userId = (req as any).user?.userId;
    if (!userId) throw new ApiError('Unauthorized', 401);

    logger.info('Reviewing milestone', { milestoneId: data.milestoneId, reviewerId: userId, approved: data.approved });

    const milestone = await MilestoneService.reviewMilestone(data.milestoneId, data.approved, userId);

    res.json(milestone);
    logger.info('Milestone review completed', { milestoneId: milestone.id, status: milestone.status });
  } catch (err) {
    logger.error('Error in reviewMilestoneHandler', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
      requestBody: req.body,
      user: (req as any).user,
    });
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (typeof err === 'object' && err !== null && 'name' in err && (err as any).name === 'ZodError') {
      return res.status(400).json({ errors: (err as any).errors });
    }
    next(err);
  }
}
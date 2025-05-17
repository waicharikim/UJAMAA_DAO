import type { Request, Response, NextFunction } from 'express';
import * as impactService from '../services/impactPoint.service.js';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { impactPointUpdateSchema } from '../validation/impact.validation.js';
import logger from '../utils/logger.js';

/**
 * Handler to add or subtract impact points for a user or group.
 */
export async function addImpactPointsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = impactPointUpdateSchema.parse(req.body);
    logger.info('addImpactPointsHandler called', data);
    const result = await impactService.addImpactPoints(data);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn('Validation error in addImpactPointsHandler', { errors: err.errors });
      return res.status(400).json({ errors: err.errors });
    }
    if (err instanceof ApiError) {
      logger.warn('ApiError in addImpactPointsHandler', { error: err.message, statusCode: err.statusCode });
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof Error) {
      logger.error('Unexpected error in addImpactPointsHandler', { message: err.message, stack: err.stack });
    } else {
      logger.error('Unknown error in addImpactPointsHandler', { error: err });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal Server Error' });
  }
}

/**
 * Handler to retrieve current impact points for a user or group.
 */
export async function getImpactPointsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { holderType, holderId, locationScope } = req.query;
    if (!holderType || !holderId) {
      return res.status(400).json({ error: 'holderType and holderId are required query parameters' });
    }
    const points = await impactService.getImpactPoints(
      holderType as 'USER' | 'GROUP',
      holderId as string,
      locationScope as string | undefined
    );
    res.json({ points });
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Error in getImpactPointsHandler', { message: err.message, stack: err.stack });
    } else {
      logger.error('Unknown error in getImpactPointsHandler', { error: err });
    }
    next(err);
  }
}
import type { Request, Response, NextFunction } from 'express';
import * as tokenService from '../services/token.service.js';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { tokenBalanceUpdateSchema } from '../validation/impact.validation.js';
import logger from '../utils/logger.js';

export async function updateTokenBalanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = tokenBalanceUpdateSchema.parse(req.body);
    logger.info('updateTokenBalanceHandler called', data);
    const result = await tokenService.updateTokenBalance(data);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ errors: err.errors });
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    logger.error('updateTokenBalanceHandler unexpected error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getTokenBalanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { holderType, holderId } = req.query;
    if (!holderType || !holderId) {
      return res.status(400).json({ error: 'Missing required query params' });
    }
    const balance = await tokenService.getTokenBalance(holderType as 'USER' | 'GROUP', holderId as string);
    res.json({ balance });
  } catch (err) {
    logger.error('getTokenBalanceHandler error', err);
    next(err);
  }
}
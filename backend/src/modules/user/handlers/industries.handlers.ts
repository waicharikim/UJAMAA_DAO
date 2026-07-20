/**
 * @file src/modules/user/handlers/industries.handlers.ts
 * @description
 * Handlers for user industries selection & retrieval
 *
 * Version: 1.0 — February 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { userService } from '../services/user.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { logger } from '../../../core/logger/logger.js';

/**
 * POST /users/me/industries
 * Select user industries (max 3)
 */
export async function selectIndustries(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const dto = req.body;

  try {
    const result = await userService.selectIndustries(userId, dto);

    sendSuccess(res, result, 'Industries updated successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_INDUSTRIES',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to update user industries'
    );
    throw error;
  }
}

/**
 * GET /users/me/industries
 * Get user's selected industries
 */
export async function getMyIndustries(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const industries = await userService.getUserIndustries(userId);

    sendSuccess(res, industries, 'Industries retrieved successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_INDUSTRIES',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve user industries'
    );
    throw error;
  }
}

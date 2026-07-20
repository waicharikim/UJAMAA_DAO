/**
 * @file src/modules/user/handlers/goods-services.handlers.ts
 * @description
 * Handlers for user goods/services selection & retrieval
 *
 * Version: 1.0 — February 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { userService } from '../services/user.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { logger } from '../../../core/logger/logger.js';

/**
 * POST /users/me/goods-services
 * Select goods/services user can provide/request
 */
export async function selectGoodsServices(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const dto = req.body;

  try {
    const result = await userService.selectGoodsServices(userId, dto);

    sendSuccess(res, result, 'Goods/services updated successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_GOODS_SERVICES',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to update user goods/services'
    );
    throw error;
  }
}

/**
 * GET /users/me/goods-services
 * Get user's selected goods/services
 */
export async function getMyGoodsServices(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const goodsServices = await userService.getUserGoodsServices(userId);

    sendSuccess(
      res,
      goodsServices,
      'Goods/services retrieved successfully',
      200
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_GOODS_SERVICES',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve user goods/services'
    );
    throw error;
  }
}

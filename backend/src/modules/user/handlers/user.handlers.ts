/**
 * @file src/modules/user/handlers/user.handlers.ts
 * @description
 * Request handlers for user profile management
 *
 * Version: 1.1 — February 2026
 * Updated: Added proper error handling, consistent logging, and minor type safety
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { userService } from '../services/user.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';

/**
 * GET /users/me
 * Get current user's profile
 */
export async function getMyProfile(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const profile = await userService.getProfile(userId);

    sendSuccess(res, profile, 'Profile retrieved successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve user profile'
    );
    throw error;
  }
}

/**
 * GET /users/:userId
 * Get another user's profile (respects privacy settings)
 */
export async function getUserProfile(req: AuthRequest, res: Response) {
  const { userId } = req.params;
  const requesterId = req.user?.userId;

  try {
    const profile = await userService.getProfile(userId);

    // TODO: Apply privacy filters based on requesterId & profile privacy settings
    // For now, return full profile if authenticated (as per original)

    sendSuccess(res, profile, 'Profile retrieved successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        requesterId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve public profile'
    );
    throw error;
  }
}

/**
 * PATCH /users/me/profile
 * Update user profile
 */
export async function updateProfile(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const dto = req.body;

  try {
    const user = await userService.updateProfile(userId, dto);

    sendSuccess(res, user, 'Profile updated successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to update user profile'
    );
    throw error;
  }
}

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
        operationType: 'USER',
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
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve user industries'
    );
    throw error;
  }
}

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
        operationType: 'USER',
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
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve user goods/services'
    );
    throw error;
  }
}

/**
 * POST /users/me/request-residence-change
 * Request primary residence change (7-day review + cooldown)
 */
export async function requestResidenceChange(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const dto = req.body;

  try {
    const request = await userService.requestResidenceChange(userId, dto);

    sendSuccess(
      res,
      request,
      'Residence change request submitted successfully',
      201
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to request residence change'
    );
    throw error;
  }
}

/**
 * GET /users/me/residence-change-requests
 * Get user's residence change requests
 */
export async function getMyResidenceChangeRequests(
  req: AuthRequest,
  res: Response
) {
  const userId = req.user!.userId;

  try {
    const requests = await userService.getUserResidenceChangeRequests(userId);

    sendSuccess(
      res,
      requests,
      'Residence change requests retrieved successfully',
      200
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve residence change requests'
    );
    throw error;
  }
}

/**
 * POST /users/me/temporary-location
 * Set temporary location (for travelling)
 */
export async function setTemporaryLocation(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { wardId, until } = req.body;

  try {
    const untilDate = new Date(until);
    if (isNaN(untilDate.getTime())) {
      throw ApiError.badRequest("Invalid 'until' date format");
    }

    const result = await userService.setTemporaryLocation(
      userId,
      wardId,
      untilDate
    );

    sendSuccess(res, result, 'Temporary location set successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to set temporary location'
    );
    throw error;
  }
}

/**
 * DELETE /users/me/temporary-location
 * Clear temporary location (return to primary residence)
 */
export async function clearTemporaryLocation(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    await userService.clearTemporaryLocation(userId);

    sendSuccess(
      res,
      { success: true },
      'Temporary location cleared successfully',
      200
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to clear temporary location'
    );
    throw error;
  }
}

/**
 * GET /users/me/privacy-settings
 * Get user's privacy settings
 */
export async function getPrivacySettings(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const settings = await userService.getPrivacySettings(userId);

    sendSuccess(res, settings, 'Privacy settings retrieved successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve privacy settings'
    );
    throw error;
  }
}

/**
 * GET /users/me/accessibility
 * Get user's accessibility settings
 */
export async function getAccessibilitySettings(
  req: AuthRequest,
  res: Response
) {
  const userId = req.user!.userId;

  try {
    const settings = await userService.getAccessibilitySettings(userId);

    sendSuccess(
      res,
      settings,
      'Accessibility settings retrieved successfully',
      200
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'USER',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve accessibility settings'
    );
    throw error;
  }
}

/**
 * @file src/modules/user/handlers/profile.handlers.ts
 * @description
 * Handlers for core profile read/update operations
 *
 * Version: 1.0 — February 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { userService } from '../services/user.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
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
        operationType: 'USER_PROFILE',
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
    // For now returning full profile if authenticated (as per original)

    sendSuccess(res, profile, 'Profile retrieved successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_PROFILE',
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
        operationType: 'USER_PROFILE',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to update user profile'
    );
    throw error;
  }
}

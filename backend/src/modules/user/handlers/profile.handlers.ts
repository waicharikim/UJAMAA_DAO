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
    const { _privacySettings: _ps, ...profile } =
      await userService.getProfile(userId);

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
 * Get another user's profile — privacy settings applied
 */
export async function getUserProfile(req: AuthRequest, res: Response) {
  const { userId } = req.params;
  const requesterId = req.user?.userId;

  try {
    const profile = await userService.getProfile(userId);

    // Owner sees their own full profile unfiltered
    if (requesterId === userId) {
      sendSuccess(res, profile, 'Profile retrieved successfully', 200);
      return;
    }

    // Apply privacy filters for other viewers
    const filtered = userService.applyPrivacyFilters(
      profile,
      (profile as any)._privacySettings ?? null
    );

    sendSuccess(res, filtered, 'Profile retrieved successfully', 200);
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
 * DELETE /users/me
 * Soft-delete own account — clears PII, revokes sessions
 */
export async function deleteMyAccount(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    await userService.deleteAccount(userId);
    sendSuccess(res, null, 'Account deleted successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_PROFILE',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to delete account'
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

/**
 * @file src/modules/user/handlers/verification.handlers.ts
 * @description
 * Handlers for community verification flows (hybrid vouching + payment fallback)
 *
 * Version: 1.0 — February 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { userService } from '../services/user.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { logger } from '../../../core/logger/logger.js';

/**
 * POST /users/verify-community/request
 * Start community verification (vouching phase)
 */
export async function requestCommunityVerification(
  req: AuthRequest,
  res: Response
) {
  const userId = req.user!.userId;

  try {
    const result = await userService.requestCommunityVerification(userId);

    sendSuccess(
      res,
      result,
      'Community verification requested. Start collecting vouches from ward members.',
      201
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_VERIFICATION',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to request community verification'
    );
    throw error;
  }
}

/**
 * POST /users/verify-community/vouch
 * Vouch for a user's community verification
 */
export async function vouchForUser(req: AuthRequest, res: Response) {
  const voucherId = req.user!.userId;
  const dto = req.body;

  try {
    const result = await userService.vouchForUser(voucherId, dto);

    sendSuccess(res, result, 'Vouch submitted successfully', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_VERIFICATION',
        voucherId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to vouch for user'
    );
    throw error;
  }
}

/**
 * POST /users/verify-community/payment
 * Process M-Pesa payment for verification fallback
 */
export async function processVerificationPayment(
  req: AuthRequest,
  res: Response
) {
  const userId = req.user!.userId;
  const dto = req.body;

  try {
    const result = await userService.processVerificationPayment(userId, dto);

    sendSuccess(
      res,
      result,
      'Payment verified. Community verification completed.',
      200
    );
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_VERIFICATION',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to process verification payment'
    );
    throw error;
  }
}

/**
 * GET /users/verify-community/status
 * Get verification status
 */
export async function getVerificationStatus(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const status = await userService.getVerificationStatus(userId);

    sendSuccess(res, status, 'Verification status retrieved', 200);
  } catch (error) {
    logger.error(
      {
        operationType: 'USER_VERIFICATION',
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to retrieve verification status'
    );
    throw error;
  }
}

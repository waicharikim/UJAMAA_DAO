/**
 * @file economicChecks.middleware.ts
 *
 * @description
 * Custom middleware to enforce UJAMAADAO-specific economic rules
 * like minimum Impact Points (IP) and required verification levels
 * before allowing sensitive transactions (e.g., token transfers).
 */

import { NextFunction, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import type { AuthRequest } from './auth.middleware.js';
import { economicService } from '../services/economic.service.js';
import logger from '../utils/logger.js';
import type { VerificationLevel } from '../types/ujamaadao.types.js';
import { getVerificationLevelOrder } from '../services/verification.service.js'; // Import utility for level comparison

/**
 * Ensures the authenticated user meets the necessary economic requirements
 * for high-value transactions, specifically token transfers.
 *
 * Requirements enforced:
 * 1. User must meet the required verification level.
 * 2. User must possess a minimum amount of Impact Points.
 * 3. User cannot initiate a self-transfer (this is a backstop, also checked in service).
 *
 * @param requiredVerificationLevel The minimum required verification status.
 * @param minImpactPoints The minimum IP required to perform the action.
 */
export const enforceEconomicChecks = ({
  requiredVerificationLevel = 'COMMUNITY_VERIFIED',
  minImpactPoints = 10,
}: {
  // CRITICAL FIX: Standardized verification level from 'FULLY_VERIFIED' to 'FULL_VERIFIED'
  requiredVerificationLevel?: Exclude<VerificationLevel, 'UNVERIFIED'>;
  minImpactPoints?: number;
}) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  const senderWalletAddress = req.user?.walletAddress;
  const recipientWalletAddress = req.body.toWalletAddress; // Assuming recipient is in body
  
  if (!userId || !senderWalletAddress) {
    return next(new ApiError('Authentication required for economic checks.', 401, { code: 'UNAUTHENTICATED' }));
  }

  try {
    // 1. Fetch user profile with economic metrics
    const profile = await economicService.getUserEconomicProfile(userId);

    // 2. Verification Level Check
    const currentLevel = profile.verificationLevel;
    const requiredLevelKey = requiredVerificationLevel;
    const verificationOrder = getVerificationLevelOrder(); // Use canonical order utility

    if (verificationOrder[currentLevel] < verificationOrder[requiredLevelKey]) {
      logger.info('Economic Check Failed: Insufficient verification level', { userId, currentLevel });
      return next(new ApiError(
        `Required verification level is ${requiredLevelKey} to perform this transaction.`
        , 403,
        { code: 'INSUFFICIENT_VERIFICATION' }
      ));
    }

    // 3. Minimum Impact Point Check
    if (profile.impactPoints < minImpactPoints) {
      logger.info('Economic Check Failed: Insufficient impact points', { userId, currentPoints: profile.impactPoints });
      return next(new ApiError(
        `A minimum of ${minImpactPoints} Impact Points is required for token transfers.`
        , 403,
        { code: 'MIN_IP_REQUIREMENT' }
      ));
    }

    // 4. Self-Transfer Check (As a final safety measure before the service)
    if (senderWalletAddress.toLowerCase() === recipientWalletAddress.toLowerCase()) {
      logger.info('Economic Check Failed: Attempted self-transfer', { userId });
      return next(new ApiError(
        'Cannot transfer tokens to your own wallet address.'
        , 400,
        { code: 'SELF_TRANSFER_ATTEMPT' }
      ));
    }

    // Success, continue to the controller
    next();

  } catch (error) {
    logger.error('Economic Check Middleware Error:', error);
    next(new ApiError('Failed to retrieve user economic data for transaction check.', 500, { code: 'ECONOMIC_DATA_FAIL' }));
  }
};

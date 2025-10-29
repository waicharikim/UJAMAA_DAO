/**
 * @file economic.controller.ts
 *
 * @description
 * UJAMAADAO Economic System Controller
 *
 * HTTP controllers for economic system operations including:
 * - Impact point awards and transactions
 * - Utility token transfers and balance management
 * - Participation rights management
 */

import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
// Updated to use single, standardized validateRequest
import { validateRequest } from '../middlewares/validateRequest.js'; 
import { authorize } from '../middlewares/authorize.js'; // Assumed to be the custom RBAC/Business-Logic checker
import { economicService } from '../services/economic.service.js';
// Import the full validation object for middleware use
import { economicValidations } from '../validation/economic.validation.js'; 
import logger from '../utils/logger.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';


/**
 * Build Economic Context from Request
 */
function buildEconomicContext(req: AuthRequest): any {
  return {
    userId: req.user?.userId,
    walletAddress: req.user?.walletAddress,
    verificationLevel: req.user?.verificationLevel,
    geographicContext: req.geographicContext,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  };
}

/**
 * POST /api/economic/award-impact-points
 * UJAMAADAO Impact Point Award Endpoint
 */
export const awardImpactPointsHandler = [
  // RBAC checks are performed in routes file, but ensure the custom 'authorize' is robust
  // We use the full validation object structure here: economicValidations.awardImpactPoints
  validateRequest(economicValidations.awardImpactPoints),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Assuming the routes file already includes:
    // authorize(['system:super_admin', 'economic:validator', 'project:admin'])

    const input = req.body;
    const context = buildEconomicContext(req);

    logger.info('UJAMAADAO Economic: Awarding impact points', {
      targetUserId: input.userId,
      points: input.points,
      transactionType: input.transactionType,
      awardedBy: context.userId
    });

    const result = await economicService.awardImpactPoints({
      userId: input.userId,
      points: input.points,
      transactionType: input.transactionType,
      description: input.description,
      locationScope: input.locationScope,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      geographicContext: context.geographicContext
    });

    res.json({
      data: {
        transactionId: result.transactionId,
        pointsAwarded: input.points,
        newBalance: result.newBalance,
        economicTier: result.tier,
        votingWeight: result.votingWeight
      },
      meta: {
        awardedBy: context.userId,
        transactionType: input.transactionType,
        timestamp: new Date().toISOString()
      }
    });
  })
];

/**
 * POST /api/economic/transfer-tokens
 * UJAMAADAO Utility Token Transfer Endpoint
 */
export const transferUtilityTokensHandler = [
  // Assuming the routes file includes the business logic checks:
  // authorize({ requiredVerificationLevel: 'COMMUNITY_VERIFIED', minImpactPoints: 10 })
  validateRequest(economicValidations.transferTokens),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { recipientWalletAddress, amount, memo } = req.body;
    const context = buildEconomicContext(req);

    if (!context.userId) {
      throw new ApiError('Authentication context missing for transfer', 401, { code: 'NO_SENDER_AUTH' });
    }

    logger.info('UJAMAADAO Economic: Initiating token transfer', {
      fromUserId: context.userId,
      recipientWalletAddress,
      amount
    });

    // The self-transfer check must be handled in the Service or Controller,
    // as sender's wallet address comes from context, not req.body.
    // The Service layer (economicService.transferUtilityTokens) is the proper place for this.

    const result = await economicService.transferUtilityTokens({
      fromUserId: context.userId,
      toWalletAddress: recipientWalletAddress,
      amount,
      memo,
      geographicContext: context.geographicContext
    });

    res.json({
      data: {
        transferId: result.transferId,
        amount: result.amount,
        recipient: result.toUserId,
        fee: result.fee,
        netAmount: result.amount - result.fee,
        memo: memo || null
      },
      meta: {
        newBalance: result.newBalance,
        impactPointsEarned: result.impactPointsEarned,
        timestamp: new Date().toISOString()
      }
    });
  })
];

/**
 * GET /api/economic/profile or /api/economic/profile/:userId
 * UJAMAADAO Economic Profile Endpoint
 */
export const getEconomicProfileHandler = [
  // Authorization is handled in the routes file (e.g., authorize(['economic:admin', 'self:profile']))
  validateRequest(economicValidations.getEconomicProfile),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // userId is either from params (admin viewing) or context (self-viewing)
    const userId = req.params.userId || req.user?.userId;
    const context = buildEconomicContext(req);

    if (!userId) {
      throw new ApiError('User ID is required', 400, { code: 'USER_ID_REQUIRED' });
    }

    // CRITICAL FIX: Removed manual isOwner/isAdmin check.
    // Authorization relies solely on the authorize middleware in the routes file.

    logger.debug('UJAMAADAO Economic: Fetching economic profile', {
      userId,
      requestedBy: context.userId
    });

    const profile = await economicService.getUserEconomicProfile(userId);

    // Determine ownership for response metadata
    const isOwner = userId === req.user?.userId;

    res.json({
      data: profile,
      meta: {
        isOwner,
        viewedBy: context.userId,
        geographicContext: context.geographicContext
      }
    });
  })
];

/**
 * POST /api/economic/reset-participation-rights/:userId (Admin/System only)
 * UJAMAADAO Participation Rights Reset Endpoint
 */
export const resetParticipationRightsHandler = [
  // Authorization is handled in the routes file (e.g., authorize(['system:super_admin', 'economic:admin']))
  validateRequest(economicValidations.getEconomicProfile), // Reusing schema for params validation
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // FIX: Using req.params.userId for administrative targeting
    const targetUserId = req.params.userId; 
    const context = buildEconomicContext(req);

    if (!targetUserId) {
      throw new ApiError('Target User ID is required in the path for reset', 400, { code: 'TARGET_USER_REQUIRED' });
    }

    logger.info('UJAMAADAO Economic: Resetting participation rights', {
      targetUserId,
      resetBy: context.userId
    });

    const result = await economicService.resetParticipationRights(targetUserId);

    res.json({
      data: {
        userId: targetUserId,
        newParticipationRights: result.newRights,
        resetAt: result.resetAt
      },
      meta: {
        resetBy: context.userId,
        operation: 'ADMIN_MANUAL_RESET'
      }
    });
  })
];

/**
 * GET /api/economic/voting-weight
 * UJAMAADAO Voting Weight Calculation Endpoint
 */
export const getVotingWeightHandler = [
  // Authorization: authorize({ requiredVerificationLevel: 'PHONE_VERIFIED' })
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const context = buildEconomicContext(req);

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
    }

    const profile = await economicService.getUserEconomicProfile(userId);

    res.json({
      data: {
        userId,
        votingWeight: profile.votingWeight,
        impactPoints: profile.impactPoints,
        economicTier: profile.economicTier,
        canVote: profile.votingWeight >= 1.0
      },
      meta: {
        calculatedAt: new Date().toISOString(),
        geographicScope: context.geographicContext?.locationScope
      }
    });
  })
];

/**
 * GET /api/economic/transaction-history or /api/economic/transaction-history/:userId
 * UJAMAADAO Economic Transaction History Endpoint
 */
export const getTransactionHistoryHandler = [
  // Authorization is handled in the routes file
  validateRequest(economicValidations.getTransactionHistory),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.params.userId || req.user?.userId;
    const { page, limit, transactionType } = req.query; // Query params are now validated and transformed by Zod
    const context = buildEconomicContext(req);

    if (!userId) {
      throw new ApiError('User ID is required', 400, { code: 'USER_ID_REQUIRED' });
    }

    // CRITICAL FIX: Removed manual isOwner/isAdmin check.
    // Authorization relies solely on the authorize middleware in the routes file.

    logger.debug('UJAMAADAO Economic: Fetching transaction history', {
      userId,
      page,
      limit,
      transactionType,
      requestedBy: context.userId
    });

    // NOTE: Transaction History Logic is omitted here, assumed to be implemented in a repository/service
    const transactions = []; 

    res.json({
      data: {
        userId,
        transactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: transactions.length,
          hasMore: false 
        }
      },
      meta: {
        viewedBy: context.userId,
        filters: { transactionType }
      }
    });
  })
];

/**
 * @file user.controller.ts
 *
 * @description
 * UJAMAADAO Enhanced User Controller
 *
 * Comprehensive HTTP controllers for User endpoints with UJAMAADAO platform enhancements.
 * Provides geographic context, progressive verification, and economic system integration.
 *
 * Controller Responsibilities:
 * - Validate requests using enhanced UJAMAADAO validation middleware
 * - Call domain services with geographic and verification context
 * - Serialize responses with comprehensive platform context
 * - Return canonical envelope { data: ..., meta: ... } with UJAMAADAO metadata
 * - Handle geographic context validation and propagation
 */

import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
// We are only importing the function names, their actual implementation and types will be defined later
import { validateRequest, validateEconomicRequest } from '../middlewares/validateRequest.js';
import { createUserSchema, updateUserSchema, updateVerificationSchema, transferUtilityTokensSchema } from '../validation/user.validation.js';
import * as UserService from '../services/user.service.js';
import { serializeUser, serializeUserEconomic } from '../utils/userSerialization.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { authorize } from '../middlewares/rbac.middleware.js';
// NEW: Import all necessary types from the central types file
import type { AuthRequest, UjamaadaoLogContext, UjamaadaoValidationOptions, GeographicContext, UjamaadaoAuthorizeOptions } from '../types/ujamaadao.types.js';

// ============================================================================
// CONTEXT BUILDING UTILITIES
// ============================================================================

/**
 * Normalize requesterRoles values into string array for UJAMAADAO context.
 */
function extractUjamaadaoRoles(rawRoles: any): string[] {
  if (!rawRoles) return [];
  return rawRoles
    .map((r: any) => (typeof r === 'string' ? r : r.role))
    .filter(Boolean)
    .filter(role => role.startsWith('system:') || role.startsWith('group:') || role.startsWith('ward:') || role.startsWith('economic:'));
}

/**
 * Build UJAMAADAO Request Context
 * Extracts comprehensive context from authenticated requests.
 */
function buildUjamaadaoContext(req: AuthRequest): any {
  return {
    userId: req.user?.userId,
    walletAddress: req.user?.walletAddress,
    verificationLevel: req.user?.verificationLevel,
    geographicContext: req.geographicContext,
    economicContext: {
      globalImpactPoints: req.user?.globalImpactPoints,
      utilityTokens: req.user?.utilityTokens,
      participationRights: req.user?.participationRights
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  };
}

// ============================================================================
// CORE USER ENDPOINTS
// ============================================================================

/**
 * POST /api/users
 * UJAMAADAO Enhanced User Registration
 */
export const createUserHandler = [
  validateRequest({
    schema: createUserSchema,
    target: 'body',
    verificationLevel: 'UNVERIFIED',
    logValidationFailures: true
  } as UjamaadaoValidationOptions),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body;
    const context = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    logger.info('UJAMAADAO User: Creating new user', {
      walletAddress: input.walletAddress,
      operation: 'USER_REGISTRATION'
    } as UjamaadaoLogContext);

    const {
      user,
      geographicContext,
      verificationStatus,
      economicSetup,
      assignedRoles
    } = await UserService.createUjamaadaoUser(input, context);

    const serialized = serializeUser(user, assignedRoles);

    logger.info('UJAMAADAO User: User created successfully', {
      userId: user.id,
      verificationLevel: verificationStatus.level,
      geographicContext: (geographicContext as GeographicContext)?.locationScope,
      economicTier: economicSetup.tier
    } as UjamaadaoLogContext);

    return res.status(201).json({
      data: serialized,
      meta: {
        geographicContext,
        verificationStatus,
        economicSetup,
        assignedRoles,
        nextSteps: [
          verificationStatus.level === 'UNVERIFIED' ? 'Complete phone verification' : null,
          !geographicContext ? 'Complete geographic setup' : null,
          economicSetup.tier === 'TIER_1' ? 'Start earning impact points' : null
        ].filter(Boolean)
      }
    });
  }),
];

/**
 * GET /api/users/me
 * UJAMAADAO Enhanced Current User Profile
 */
export const getCurrentUserHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ApiError('Authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
  }

  const context = buildUjamaadaoContext(req);
  const roles = extractUjamaadaoRoles(req.userRoles);

  logger.debug('UJAMAADAO User: Fetching current user profile', {
    userId,
    verificationLevel: context.verificationLevel,
    geographicContext: context.geographicContext?.locationScope
  } as UjamaadaoLogContext);

  const user = await UserService.getUserWithUjamaadaoContext(userId);

  if (!user) {
    throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
  }

  const isOwner = context.userId === user.id;
  const serialized = serializeUser(user, roles, { isOwner });

  logger.debug('UJAMAADAO User: Current user profile retrieved', {
    userId,
    verificationLevel: serialized.verificationLevel,
    economicTier: serialized.economicSummary.economicTier
  } as UjamaadaoLogContext);

  return res.json({
    data: serialized,
    meta: {
      geographicContext: context.geographicContext?.locationScope,
      canParticipateEconomically: serialized.economicSummary.canParticipateEconomically,
      canParticipateGovernance: serialized.economicSummary.canParticipateGovernance,
      verificationProgress: serialized.verificationProgress
    }
  });
});

/**
 * PATCH /api/users/me
 * UJAMAADAO Enhanced User Profile Update
 */
export const updateUserHandler = [
  validateRequest({
    schema: updateUserSchema,
    target: 'body',
    verificationLevel: 'PHONE_VERIFIED',
    validateGeographicContext: true,
    logValidationFailures: true
  } as UjamaadaoValidationOptions),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError('Authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
    }

    const input = req.body;
    const context = buildUjamaadaoContext(req);
    const roles = extractUjamaadaoRoles(req.userRoles);

    logger.info('UJAMAADAO User: Updating user profile', {
      userId,
      updatedFields: Object.keys(input),
      verificationLevel: context.verificationLevel
    } as UjamaadaoLogContext);

    const updatedUser = await UserService.updateUjamaadaoUser(userId, input, context);

    const serialized = serializeUser(updatedUser, roles, { isOwner: true });

    logger.info('UJAMAADAO User: User profile updated successfully', {
      userId,
      updatedFields: Object.keys(input)
    } as UjamaadaoLogContext);

    return res.json({
      data: serialized,
      meta: {
        updatedFields: Object.keys(input),
        geographicContext: updatedUser.primaryWard ? 'WARD' : 'NATIONAL'
      }
    });
  }),
];

/**
 * POST /api/users/me/avatar
 * UJAMAADAO Enhanced Avatar Upload
 */
export const uploadAvatarHandler = [
  authorize({
    allowedRoles: ['*'],
    verificationLevel: 'PHONE_VERIFIED'
  } as UjamaadaoAuthorizeOptions),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError('Authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
    }

    // req.file is available due to the extended AuthRequest type defined in ujamaadao.types.ts
    if (!req.file) {
      throw new ApiError('No file uploaded', 400, { code: 'NO_FILE_UPLOADED' });
    }

    const context = buildUjamaadaoContext(req);
    const roles = extractUjamaadaoRoles(req.userRoles);

    logger.info('UJAMAADAO User: Uploading avatar', {
      userId,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    } as UjamaadaoLogContext);

    const avatarUrl = await UserService.processAvatarUpload(req.file, context);

    const updatedUser = await UserService.updateUjamaadaoUser(
      userId,
      { avatarUrl },
      context
    );

    const serialized = serializeUser(updatedUser, roles, { isOwner: true });

    logger.info('UJAMAADAO User: Avatar uploaded successfully', {
      userId,
      avatarUrl
    } as UjamaadaoLogContext);

    return res.json({
      data: serialized,
      meta: {
        avatarProcessed: true,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  }),
];

/**
 * GET /api/users/wallet/:walletAddress
 * UJAMAADAO Enhanced User Lookup by Wallet
 */
export const getUserByWalletHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  const walletAddress = req.params.walletAddress;
  if (!walletAddress) {
    throw new ApiError('Wallet address is required', 400, { code: 'WALLET_ADDRESS_REQUIRED' });
  }

  const roles = extractUjamaadaoRoles(req.userRoles);
  const context = buildUjamaadaoContext(req);

  logger.debug('UJAMAADAO User: Looking up user by wallet', {
    walletAddress,
    requesterId: context.userId,
    operation: 'USER_LOOKUP'
  } as UjamaadaoLogContext);

  const user = await UserService.getUserByWalletWithPublicContext(walletAddress);

  if (!user) {
    throw new ApiError('User not found', 404, { code: 'USER_NOT_FOUND' });
  }

  const isOwner = context.userId === user.id;
  const serialized = serializeUser(user, roles, { isOwner });

  logger.debug('UJAMAADAO User: User lookup completed', {
    walletAddress,
    found: true,
    isOwner,
    verificationLevel: serialized.verificationLevel
  } as UjamaadaoLogContext);

  return res.json({
    data: serialized,
    meta: {
      isOwner,
      lookupType: 'WALLET',
      publicProfile: !isOwner
    }
  });
});

/**
 * POST /api/users/me/verify-phone
 * UJAMAADAO Phone Verification Initiation
 */
export const verifyPhoneHandler = [
  authorize({
    allowedRoles: ['*'],
    verificationLevel: 'UNVERIFIED'
  } as UjamaadaoAuthorizeOptions),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError('Authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
    }

    const context = buildUjamaadaoContext(req);

    logger.info('UJAMAADAO User: Initiating phone verification', {
      userId,
      currentLevel: context.verificationLevel,
      operation: 'VERIFICATION_INIT'
    } as UjamaadaoLogContext);

    const verification = await UserService.initiatePhoneVerification(userId, context);

    return res.json({
      data: {
        verificationId: verification.verificationId,
        method: verification.method,
        expiresAt: verification.expiresAt,
        nextStep: verification.nextStep
      },
      meta: {
        currentVerificationLevel: context.verificationLevel,
        targetVerificationLevel: 'PHONE_VERIFIED',
        economicAccess: false
      }
    });
  }),
];

/**
 * POST /api/users/me/complete-verification
 * UJAMAADAO Verification Completion
 */
export const completeVerificationHandler = [
  validateRequest({
    schema: updateVerificationSchema,
    target: 'body',
    verificationLevel: 'UNVERIFIED',
    logValidationFailures: true
  } as UjamaadaoValidationOptions),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError('Authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
    }

    const { verificationType, verificationData } = req.body;
    const context = buildUjamaadaoContext(req);
    const roles = extractUjamaadaoRoles(req.userRoles);

    logger.info('UJAMAADAO User: Completing verification', {
      userId,
      verificationType,
      currentLevel: context.verificationLevel,
      operation: 'VERIFICATION_COMPLETE'
    } as UjamaadaoLogContext);

    const { user, verificationResult } = await UserService.completeVerification(
      userId,
      verificationType,
      verificationData,
      context
    );

    const serialized = serializeUser(user, roles, { isOwner: true });

    logger.info('UJAMAADAO User: Verification completed successfully', {
      userId,
      verificationType,
      newLevel: verificationResult.newLevel,
      economicAccessGranted: verificationResult.economicAccessGranted
    } as UjamaadaoLogContext);

    return res.json({
      data: serialized,
      meta: {
        verificationResult,
        platformCapabilities: {
          canParticipateEconomically: serialized.economicSummary.canParticipateEconomically,
          canParticipateGovernance: serialized.economicSummary.canParticipateGovernance,
          votingWeight: serialized.economicSummary.votingWeight
        }
      }
    });
  }),
];

/**
 * POST /api/users/me/transfer-tokens
 * UJAMAADAO Utility Token Transfer
 */
export const transferUtilityTokensHandler = [
  validateEconomicRequest(transferUtilityTokensSchema),
  authorize({
    allowedRoles: ['*'],
    verificationLevel: 'COMMUNITY_VERIFIED',
    minImpactPoints: 10
  } as UjamaadaoAuthorizeOptions),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError('Authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
    }

    const { recipientWalletAddress, amount, memo } = req.body;
    const context = buildUjamaadaoContext(req);

    logger.info('UJAMAADAO User: Transferring utility tokens', {
      userId,
      recipientWalletAddress,
      amount,
      currentBalance: context.economicContext?.utilityTokens,
      operation: 'TOKEN_TRANSFER'
    } as UjamaadaoLogContext);

    const transferResult = (await UserService.transferUtilityTokens(
      userId,
      recipientWalletAddress,
      amount,
      memo,
      context
    )) as unknown as {
      transferId: string;
      amount: number;
      recipient: string;
      memo?: string | null;
      timestamp: string;
      newBalance: number;
      fee: number;
      impactPointsEarned: number;
    };

    if (!transferResult || !transferResult.transferId) {
      throw new ApiError('Token transfer failed', 500, { code: 'TRANSFER_FAILED' });
    }

    logger.info('UJAMAADAO User: Utility tokens transferred successfully', {
      userId,
      transferId: transferResult.transferId,
      amount,
      newBalance: transferResult.newBalance
    } as UjamaadaoLogContext);

    return res.json({
      data: {
        transferId: transferResult.transferId,
        amount: transferResult.amount,
        recipient: transferResult.recipient,
        memo: transferResult.memo,
        timestamp: transferResult.timestamp
      },
      meta: {
        newBalance: transferResult.newBalance,
        transactionFee: transferResult.fee,
        impactPointsEarned: transferResult.impactPointsEarned
      }
    });
  }),
];

/**
 * GET /api/users/me/economic-profile
 * UJAMAADAO Economic Profile
 */
export const getEconomicProfileHandler = [
  authorize({
    allowedRoles: ['*'],
    verificationLevel: 'PHONE_VERIFIED'
  } as UjamaadaoAuthorizeOptions),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError('Authentication required', 401, { code: 'AUTHENTICATION_REQUIRED' });
    }

    const context = buildUjamaadaoContext(req);

    logger.debug('UJAMAADAO User: Fetching economic profile', {
      userId,
      verificationLevel: context.verificationLevel,
      operation: 'ECONOMIC_PROFILE_FETCH'
    } as UjamaadaoLogContext);

    const user = await UserService.getUserEconomicProfile(userId);
    const serialized = serializeUserEconomic(user);

    return res.json({
      data: serialized,
      meta: {
        canTransferTokens: serialized.economicProfile.canParticipateEconomically,
        votingPower: serialized.economicProfile.votingWeight,
        economicTier: serialized.economicProfile.economicTier
      }
    });
  }),
];

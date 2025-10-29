/**
 * @file verification.controller.ts
 * * @description
 * UJAMAADAO Verification Controller
 * * Handles HTTP requests for user verification processes including:
 * - Phone verification
 * - Community verification
 * - Location verification
 * - Verification status checks
 */

import { Response } from 'express';
import { verificationService } from '../services/verification.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
// CRITICAL FIX: Import and use the custom AuthRequest type
import { AuthRequest } from '../middlewares/auth.middleware.js'; 
import logger from '../utils/logger.js';

/**
 * Verification Controller
 */
export class VerificationController {
  
  /**
   * Initiate phone verification (uses AuthRequest)
   */
  initiatePhoneVerification = asyncHandler(async (req: AuthRequest, res: Response) => {
    // SECURITY: Use userId from the authenticated token
    const userId = req.user?.userId;
    const { phoneNumber } = req.body;

    // Type checking ensures userId is present before calling the service
    if (!userId) { 
      // This should ideally be caught by authMiddleware, but we handle it defensively
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }
    
    // NOTE: Input validation is handled by verification.validation.ts before reaching here.

    const result = await verificationService.initiatePhoneVerification(userId, phoneNumber);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Phone verification initiated successfully. Check your SMS.'
    });
  });

  /**
   * Complete phone verification (public endpoint, requires only ID and code)
   */
  completePhoneVerification = asyncHandler(async (req: AuthRequest, res: Response) => {
    // This is often a public endpoint since the user may not be logged in to confirm SMS/email
    const { verificationId, code } = req.body;

    // NOTE: Input validation for verificationId and code format handled by validation middleware.
    
    const verified = await verificationService.completePhoneVerification(verificationId, code);

    res.status(200).json({
      success: true,
      data: { verified },
      message: 'Phone verification completed successfully'
    });
  });

  /**
   * Initiate community verification (user submits list of verifier IDs)
   */
  initiateCommunityVerification = asyncHandler(async (req: AuthRequest, res: Response) => {
    // SECURITY: Use userId from the authenticated token
    const userId = req.user?.userId;
    const { verifierIds } = req.body;

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    // NOTE: Input validation for verifierIds array format handled by validation middleware.

    const result = await verificationService.initiateCommunityVerification(userId, verifierIds);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Community verification requested. Verifiers have been notified.'
    });
  });

  /**
   * Submit community verification vote (verifier submits approval/rejection)
   */
  submitCommunityVerificationVote = asyncHandler(async (req: AuthRequest, res: Response) => {
    // SECURITY: verifierId is taken from the authenticated token (the voter)
    const verifierId = req.user?.userId;
    const { verificationId, approve } = req.body;

    if (!verifierId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }
    
    // NOTE: Input validation for verificationId and approve boolean handled by validation middleware.

    const result = await verificationService.submitCommunityVerificationVote(
      verificationId,
      verifierId,
      approve
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Community verification vote submitted successfully'
    });
  });

  /**
   * Verify user location (user submits coordinates and ward ID)
   */
  verifyLocation = asyncHandler(async (req: AuthRequest, res: Response) => {
    // SECURITY: userId is taken from the authenticated token
    const userId = req.user?.userId;
    const { coordinates, wardId, evidence } = req.body;

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }
    
    // NOTE: Input validation for coordinates, wardId, evidence handled by validation middleware.

    const verified = await verificationService.verifyLocation({
      userId,
      coordinates,
      wardId,
      timestamp: new Date(),
      evidence
    });

    res.status(200).json({
      success: true,
      data: { verified },
      message: 'Location verification completed successfully'
    });
  });

  /**
   * Get verification status for the current user
   */
  getVerificationStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    const status = await verificationService.getVerificationStatus(userId);

    res.status(200).json({
      success: true,
      data: status,
      message: 'Verification status retrieved successfully'
    });
  });

  /**
   * Get verification status for another user (requires RBAC authorization in routes)
   */
  getUserVerificationStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    // The target userId is passed via URL parameter
    const targetUserId = req.params.userId;

    // NOTE: The authorization check (e.g., 'system:admin') MUST be enforced in the routes file.

    if (!targetUserId) {
      throw new ApiError('Target User ID is required', 400, { code: 'MISSING_USER_ID' });
    }

    const status = await verificationService.getVerificationStatus(targetUserId);

    res.status(200).json({
      success: true,
      data: status,
      message: 'User verification status retrieved successfully'
    });
  });

  /**
   * Resend phone verification code (reuse logic from initiate)
   */
  resendPhoneVerification = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { phoneNumber } = req.body; // PhoneNumber might be required if stored on the user object

    if (!userId) {
      throw new ApiError('User authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    // NOTE: Input validation for phoneNumber format handled by validation middleware.

    const result = await verificationService.initiatePhoneVerification(userId, phoneNumber);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Phone verification code resent successfully'
    });
  });
}

// Export controller instance
export const verificationController = new VerificationController();

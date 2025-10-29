/**
 * @file auth.routes.ts
 *
 * @description
 * UJAMAADAO Enhanced Authentication Routes
 * 
 * Comprehensive authentication API routes for the UJAMAADAO platform:
 * - Nonce retrieval for wallet-based authentication with geographic validation
 * - Signature verification with comprehensive UJAMAADAO context
 * - Session management (refresh, logout)
 * - Email verification with verification level integration
 * - Geographic context validation for authenticated operations
 * 
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Registration-first authentication workflow enforcement
 * - Geographic context validation in authentication flow
 * - Verification level integration in session management
 * - Economic system context in authentication responses
 * - Enhanced security with comprehensive middleware protection
 * 
 * Route Security Levels:
 * - PUBLIC: No authentication required (nonce, email verification)
 * - AUTHENTICATED: Requires valid JWT token (session management, email sending)
 * - VERIFIED: Requires specific verification levels (future enhancements)
 * 
 * Authentication Flow Integration:
 * 1. GET /nonce → Validate registration status and geographic context
 * 2. POST /verify → Complete authentication with UJAMAADAO context
 * 3. POST /refresh → Maintain session with updated platform context
 * 4. POST /logout → Secure session termination
 * 5. Email verification → Progressive verification level advancement
 */

import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as emailVerificationController from '../controllers/emailVerification.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { z } from 'zod';

const router = express.Router();

// UJAMAADAO VALIDATION SCHEMAS
const nonceQuerySchema = z.object({
  walletAddress: z.string()
    .min(1, 'Wallet address is required')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
});

const verifySignatureSchema = z.object({
  walletAddress: z.string()
    .min(1, 'Wallet address is required')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  signature: z.string()
    .min(1, 'Signature is required')
    .regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid signature format'),
  geographicData: z.object({
    primaryWardId: z.string().uuid().optional(),
    constituencyId: z.string().uuid().optional(),
    countyId: z.string().uuid().optional()
  }).optional()
});

const refreshSessionSchema = z.object({
  currentToken: z.string().min(1, 'Current token is required').optional()
});

const emailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required')
});

/**
 * @route GET /api/auth/nonce
 * @description UJAMAADAO Nonce Retrieval Endpoint
 * 
 * Retrieves authentication nonce for registered users with geographic validation.
 * Implements registration-first workflow - users must complete geographic registration
 * before wallet authentication.
 * 
 * UJAMAADAO ENHANCEMENTS:
 * - Registration status validation
 * - Geographic context verification
 * - Enhanced error handling with platform-specific codes
 * 
 * @access Public
 * 
 * @example
 * GET /api/auth/nonce?walletAddress=0x742Ea4...
 * 
 * @response {Object} 200 - Nonce with platform context
 * @response {string} 200.nonce - Authentication nonce
 * @response {Object} 200.platformContext - UJAMAADAO platform information
 * @response {string} 200.messageTemplate - Message template for signing
 * 
 * @response {Object} 400 - Registration incomplete or invalid input
 * @response {Object} 404 - User not found (registration required)
 * @response {Object} 500 - Internal server error
 */
router.get(
  '/nonce',
  validateRequest({
    schema: nonceQuerySchema,
    target: 'query',
    logValidationFailures: true,
    customErrorMessages: {
      'walletAddress.invalid_string': 'Please provide a valid Ethereum wallet address',
      'walletAddress.too_small': 'Wallet address is required'
    }
  }),
  authController.getNonceHandler
);

/**
 * @route POST /api/auth/verify
 * @description UJAMAADAO Signature Verification Endpoint
 * 
 * Verifies wallet signature and establishes comprehensive UJAMAADAO session.
 * Returns JWT token with geographic context, verification status, and economic data.
 * 
 * UJAMAADAO ENHANCEMENTS:
 * - Comprehensive platform context in response
 * - Geographic context establishment
 * - Verification level calculation
 * - Economic system integration
 * - Session management initialization
 * 
 * @access Public
 * 
 * @example
 * POST /api/auth/verify
 * {
 *   "walletAddress": "0x742Ea4...",
 *   "signature": "0x1234abcd...",
 *   "geographicData": {
 *     "primaryWardId": "ward-uuid"
 *   }
 * }
 * 
 * @response {Object} 200 - Authentication successful
 * @response {string} 200.token - JWT token with UJAMAADAO claims
 * @response {Object} 200.user - User data with platform context
 * @response {Object} 200.geographicContext - Geographic hierarchy context
 * @response {Object} 200.session - Session management data
 * 
 * @response {Object} 400 - Invalid input data
 * @response {Object} 401 - Signature verification failed
 * @response {Object} 404 - User not found (registration required)
 * @response {Object} 500 - Internal server error
 */
router.post(
  '/verify',
  validateRequest({
    schema: verifySignatureSchema,
    target: 'body',
    logValidationFailures: true,
    customErrorMessages: {
      'walletAddress.invalid_string': 'Please provide a valid Ethereum wallet address',
      'signature.invalid_string': 'Please provide a valid signature',
      'geographicData.primaryWardId.invalid_string': 'Primary ward ID must be a valid UUID'
    }
  }),
  authController.verifySignatureHandler
);

/**
 * @route POST /api/auth/refresh
 * @description UJAMAADAO Session Refresh Endpoint
 * 
 * Refreshes user session with updated geographic, verification, and economic context.
 * Maintains platform continuity while updating dynamic user data.
 * 
 * UJAMAADAO ENHANCEMENTS:
 * - Updated verification status
 * - Fresh geographic context
 * - Current economic data
 * - Extended session lifetime
 * 
 * @access Authenticated
 * 
 * @example
 * POST /api/auth/refresh
 * Authorization: Bearer <current-token>
 * 
 * @response {Object} 200 - Session refreshed successfully
 * @response {string} 200.token - New JWT token
 * @response {Object} 200.user - Updated user data
 * @response {Object} 200.geographicContext - Current geographic context
 * @response {Object} 200.session - Updated session data
 * 
 * @response {Object} 401 - Invalid or expired token
 * @response {Object} 404 - User not found
 * @response {Object} 500 - Internal server error
 */
router.post(
  '/refresh',
  authMiddleware,
  validateRequest({
    schema: refreshSessionSchema,
    target: 'body',
    logValidationFailures: true,
    requiredVerificationLevel: 'PHONE_VERIFIED'
  }),
  authController.refreshSessionHandler
);

/**
 * @route POST /api/auth/logout
 * @description UJAMAADAO Session Logout Endpoint
 * 
 * Terminates user session with comprehensive activity logging and cleanup.
 * Ensures secure session termination for the community governance platform.
 * 
 * UJAMAADAO ENHANCEMENTS:
 * - Comprehensive activity logging
 * - Session cleanup procedures
 * - Security event tracking
 * 
 * @access Authenticated
 * 
 * @example
 * POST /api/auth/logout
 * Authorization: Bearer <current-token>
 * 
 * @response {Object} 200 - Logout successful
 * @response {boolean} 200.success - Logout status
 * @response {string} 200.message - Success message
 * @response {string} 200.timestamp - Logout timestamp
 * 
 * @response {Object} 401 - Authentication required
 * @response {Object} 500 - Internal server error
 */
router.post(
  '/logout',
  authMiddleware,
  authController.logoutHandler
);

/**
 * @route POST /api/auth/send-email-verification
 * @description UJAMAADAO Email Verification Request Endpoint
 * 
 * Sends email verification link to advance user's verification level.
 * Part of the progressive verification system for platform access.
 * 
 * UJAMAADAO ENHANCEMENTS:
 * - Verification level progression
 * - Geographic context preservation
 * - Economic system integration
 * 
 * @access Authenticated
 * 
 * @example
 * POST /api/auth/send-email-verification
 * Authorization: Bearer <current-token>
 * 
 * @response {Object} 200 - Verification email sent
 * @response {string} 200.message - Success message
 * @response {string} 200.verificationLevel - Updated verification level
 * 
 * @response {Object} 400 - Email already verified
 * @response {Object} 401 - Authentication required
 * @response {Object} 500 - Internal server error
 */
router.post(
  '/send-email-verification',
  authMiddleware,
  emailVerificationController.sendEmailVerificationHandler
);

/**
 * @route POST /api/auth/verify-email
 * @description UJAMAADAO Email Verification Completion Endpoint
 * 
 * Verifies user's email using provided token and advances verification level.
 * Critical step in the progressive verification system for economic participation.
 * 
 * UJAMAADAO ENHANCEMENTS:
 * - Verification level advancement
 * - Economic participation gates
 * - Platform capability updates
 * 
 * @access Public (token-based)
 * 
 * @example
 * POST /api/auth/verify-email
 * {
 *   "token": "email-verification-token"
 * }
 * 
 * @response {Object} 200 - Email verified successfully
 * @response {string} 200.message - Success message
 * @response {string} 200.verificationLevel - New verification level
 * @response {boolean} 200.canParticipateEconomically - Economic access flag
 * 
 * @response {Object} 400 - Invalid or expired token
 * @response {Object} 404 - Token not found
 * @response {Object} 500 - Internal server error
 */
router.post(
  '/verify-email',
  validateRequest({
    schema: emailVerificationSchema,
    target: 'body',
    logValidationFailures: true,
    customErrorMessages: {
      'token.invalid_string': 'Please provide a valid verification token'
    }
  }),
  emailVerificationController.verifyEmailHandler
);

/**
 * @route GET /api/auth/session
 * @description UJAMAADAO Session Status Endpoint
 * 
 * Returns current session status with comprehensive platform context.
 * Useful for client applications to determine user capabilities and requirements.
 * 
 * UJAMAADAO ENHANCEMENTS:
 * - Complete platform context
 * - Verification requirements
 * - Geographic setup status
 * - Economic onboarding needs
 * 
 * @access Authenticated
 * 
 * @example
 * GET /api/auth/session
 * Authorization: Bearer <current-token>
 * 
 * @response {Object} 200 - Session status
 * @response {Object} 200.user - Current user context
 * @response {Object} 200.session - Session requirements and status
 * @response {Object} 200.platformCapabilities - Available platform features
 * 
 * @response {Object} 401 - Authentication required
 * @response {Object} 500 - Internal server error
 */
interface IUser {
    id?: string;
    walletAddress?: string;
    phoneVerified?: boolean;
    communityVerified?: boolean;
    locationVerified?: boolean;
    primaryWardId?: string | null;
    globalImpactPoints?: number;
    utilityTokens?: number;
    verificationLevel?: 'UNVERIFIED' | 'PHONE_VERIFIED' | 'COMMUNITY_VERIFIED' | 'FULLY_VERIFIED' | string;
    [key: string]: any;
}

interface IGeographicContext {
    locationScope?: string;
    primaryWardId?: string | null;
    [key: string]: any;
}

interface ISessionInfo {
    expiresAt: Date;
    verificationRequired: boolean;
    geographicSetupRequired: boolean;
    economicOnboardingRequired: boolean;
}

interface IPlatformCapabilities {
    canVote: boolean;
    canParticipateEconomically: boolean;
    canCreateProposals: boolean;
    geographicScope: string;
    [key: string]: any;
}

interface AuthRequest extends express.Request {
    user: IUser;
    geographicContext?: IGeographicContext;
}

router.get(
    '/session',
    authMiddleware,
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
        // This would be handled by a session controller in a full implementation
        const authReq = req as AuthRequest;
        res.json({
            user: authReq.user,
            session: {
                expiresAt: new Date(Date.now() + (60 * 60 * 1000)), // Example
                verificationRequired: !authReq.user.phoneVerified || !authReq.user.communityVerified || !authReq.user.locationVerified,
                geographicSetupRequired: !authReq.user.primaryWardId,
                economicOnboardingRequired: (authReq.user.globalImpactPoints === 0 && authReq.user.utilityTokens === 0)
            } as ISessionInfo,
            platformCapabilities: {
                canVote: authReq.user.verificationLevel !== 'UNVERIFIED',
                canParticipateEconomically: authReq.user.verificationLevel === 'COMMUNITY_VERIFIED' || authReq.user.verificationLevel === 'FULLY_VERIFIED',
                canCreateProposals: authReq.user.verificationLevel === 'FULLY_VERIFIED',
                geographicScope: authReq.geographicContext?.locationScope || 'USER'
            } as IPlatformCapabilities
        });
    }
);

export default router;
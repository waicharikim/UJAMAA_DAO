/**
 * @file user.routes.ts
 *
 * @description
 * UJAMAADAO Enhanced User Routes
 * 
 * Comprehensive Express routes for user operations in the UJAMAADAO platform including:
 * - User registration with geographic hierarchy integration
 * - Progressive verification system endpoints
 * - Three-tier economic system operations
 * - Geographic context validation and propagation
 * - Community governance role enforcement
 * 
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic hierarchy validation in user registration
 * - Progressive verification workflow endpoints
 * - Economic system transaction routes
 * - Location-based access control
 * - Enhanced privacy controls for community platform
 * 
 * Route Categories:
 * - PUBLIC: User registration and public profile lookups
 * - AUTHENTICATED: Profile management with verification level gates
 * - VERIFIED: Economic operations requiring community verification
 * - GEOGRAPHIC: Location-based operations with geographic validation
 * 
 * Security Model:
 * - Authentication middleware for all protected routes
 * - Role-based access control with geographic scoping
 * - Verification level gates for sensitive operations
 * - Geographic context validation for location-based operations
 */

import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { attachUserRoles } from '../middlewares/attachUserRoles.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { createUjamaadaoUploader } from '../middlewares/upload.middleware.js';
import { validateRequest, validateEconomicRequest, validateGeographicRequest } from '../middlewares/validateRequest.js';
import { createUserSchema, updateUserSchema, updateVerificationSchema, transferUtilityTokensSchema } from '../validation/user.validation.js';

const router = express.Router();

/**
 * UJAMAADAO Avatar Upload Configuration
 * 
 * Enhanced upload configuration for user avatars with geographic context
 * and verification level requirements.
 */
const uploadAvatar = createUjamaadaoUploader({
  folder: 'uploads/avatars',
  fieldName: 'avatar',
  allowedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  maxSizeMB: 5,
  requiredVerificationLevel: 'PHONE_VERIFIED',
  geographicScope: 'USER',
  uploadCategory: 'PROFILE',
  extractMetadata: true,
  enableSecurityScan: true,
  impactPointsAwarded: 0 // No IP for avatar uploads
});

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

/**
 * @route POST /api/users
 * @description UJAMAADAO User Registration Endpoint
 * 
 * Creates a new user with comprehensive UJAMAADAO platform context including
 * geographic hierarchy, progressive verification, and economic system setup.
 * 
 * @access Public
 * 
 * @example
 * POST /api/users
 * {
 *   "walletAddress": "0x742Ea4...",
 *   "email": "user@example.com",
 *   "name": "John Doe",
 *   "phoneNumber": "+254712345678",
 *   "primaryWardId": "ward-uuid",
 *   "industryId": "industry-uuid",
 *   "goodsServices": ["gs-uuid-1", "gs-uuid-2"]
 * }
 * 
 * @response {Object} 201 - User created successfully
 * @response {Object} 400 - Invalid input or geographic validation failed
 * @response {Object} 409 - User already exists
 */
router.post(
  '/',
  validateRequest({
    schema: createUserSchema,
    target: 'body',
    requiredVerificationLevel: 'UNVERIFIED',
    geographicScope: 'NATIONAL', // Allow national registration
    validateGeographicContext: true,
    logValidationFailures: true,
    customErrorMessages: {
      'primaryWardId.invalid_string': 'Please provide a valid primary ward identifier',
      'walletAddress.invalid_string': 'Please provide a valid Ethereum wallet address'
    }
  }),
  userController.createUserHandler
);

/**
 * @route GET /api/users/wallet/:walletAddress
 * @description UJAMAADAO Public User Lookup by Wallet
 * 
 * Returns public user profile with UJAMAADAO context including geographic
 * hierarchy, verification level, and economic summary.
 * 
 * @access Public
 * 
 * @example
 * GET /api/users/wallet/0x742Ea4...
 * 
 * @response {Object} 200 - User found
 * @response {Object} 404 - User not found
 */
router.get(
  '/wallet/:walletAddress',
  userController.getUserByWalletHandler
);

// ============================================================================
// AUTHENTICATED ROUTES (Require Authentication + Role Attachment)
// ============================================================================

// Protect all routes below with UJAMAADAO authentication and role context
router.use(authMiddleware);
router.use(attachUserRoles);

/**
 * @route GET /api/users/me
 * @description UJAMAADAO Enhanced Current User Profile
 * 
 * Returns comprehensive current user profile with full UJAMAADAO context
 * including geographic hierarchy, verification status, and economic data.
 * 
 * @access Authenticated
 * 
 * @example
 * GET /api/users/me
 * Authorization: Bearer <token>
 * 
 * @response {Object} 200 - User profile with full context
 * @response {Object} 401 - Authentication required
 */
router.get(
  '/me',
  authorize({
    allowedRoles: ['*'], // All authenticated users can access their own profile
    requiredVerificationLevel: 'UNVERIFIED' // Even unverified users can see their profile
  }),
  userController.getCurrentUserHandler
);

/**
 * @route PATCH /api/users/me
 * @description UJAMAADAO Enhanced User Profile Update
 * 
 * Updates current user profile with geographic context validation and
 * comprehensive audit logging.
 * 
 * @access Authenticated
 * 
 * @example
 * PATCH /api/users/me
 * Authorization: Bearer <token>
 * {
 *   "name": "Updated Name",
 *   "phoneNumber": "+254712345679",
 *   "primaryWardId": "new-ward-uuid"
 * }
 * 
 * @response {Object} 200 - Profile updated successfully
 * @response {Object} 400 - Invalid input or geographic validation failed
 * @response {Object} 401 - Authentication required
 */
router.patch(
  '/me',
  authorize({
    allowedRoles: ['*'],
    requiredVerificationLevel: 'PHONE_VERIFIED',
    geographicScope: 'WARD',
    validateGeographicContext: true
  }),
  validateRequest({
    schema: updateUserSchema,
    target: 'body',
    requiredVerificationLevel: 'PHONE_VERIFIED',
    validateGeographicContext: true,
    logValidationFailures: true
  }),
  userController.updateUserHandler
);

/**
 * @route POST /api/users/me/avatar
 * @description UJAMAADAO Enhanced Avatar Upload
 * 
 * Handles user avatar upload with geographic context and verification validation.
 * Includes platform-specific processing and metadata extraction.
 * 
 * @access Authenticated
 * 
 * @example
 * POST /api/users/me/avatar
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 * 
 * @response {Object} 200 - Avatar uploaded successfully
 * @response {Object} 400 - No file uploaded or invalid file type
 * @response {Object} 401 - Authentication required
 */
router.post(
  '/me/avatar',
  authorize({
    allowedRoles: ['*'],
    requiredVerificationLevel: 'PHONE_VERIFIED'
  }),
  uploadAvatar.single('avatar'),
  userController.uploadAvatarHandler
);

// ============================================================================
// VERIFICATION ROUTES (Progressive Verification System)
// ============================================================================

/**
 * @route POST /api/users/me/verify-phone
 * @description UJAMAADAO Phone Verification Initiation
 * 
 * Initiates phone verification process to advance verification level.
 * Part of the progressive verification system for economic participation.
 * 
 * @access Authenticated
 * 
 * @example
 * POST /api/users/me/verify-phone
 * Authorization: Bearer <token>
 * 
 * @response {Object} 200 - Verification initiated
 * @response {Object} 400 - Phone already verified
 * @response {Object} 401 - Authentication required
 */
router.post(
  '/me/verify-phone',
  authorize({
    allowedRoles: ['*'],
    requiredVerificationLevel: 'UNVERIFIED' // Only unverified users can initiate
  }),
  userController.verifyPhoneHandler
);

/**
 * @route POST /api/users/me/complete-verification
 * @description UJAMAADAO Verification Completion
 * 
 * Completes verification steps and advances user verification level.
 * Updates platform capabilities and economic participation rights.
 * 
 * @access Authenticated
 * 
 * @example
 * POST /api/users/me/complete-verification
 * Authorization: Bearer <token>
 * {
 *   "verificationType": "PHONE",
 *   "verificationData": {
 *     "code": "123456"
 *   }
 * }
 * 
 * @response {Object} 200 - Verification completed
 * @response {Object} 400 - Invalid verification data
 * @response {Object} 401 - Authentication required
 */
router.post(
  '/me/complete-verification',
  authorize({
    allowedRoles: ['*'],
    requiredVerificationLevel: 'UNVERIFIED'
  }),
  validateRequest({
    schema: updateVerificationSchema,
    target: 'body',
    requiredVerificationLevel: 'UNVERIFIED',
    logValidationFailures: true
  }),
  userController.completeVerificationHandler
);

// ============================================================================
// ECONOMIC SYSTEM ROUTES (Require Community Verification)
// ============================================================================

/**
 * @route POST /api/users/me/transfer-tokens
 * @description UJAMAADAO Utility Token Transfer
 * 
 * Transfers utility tokens between users with economic system validation.
 * Requires community verification level for economic participation.
 * 
 * @access Authenticated + Community Verified
 * 
 * @example
 * POST /api/users/me/transfer-tokens
 * Authorization: Bearer <token>
 * {
 *   "recipientWalletAddress": "0x9876...",
 *   "amount": 100,
 *   "memo": "Payment for services"
 * }
 * 
 * @response {Object} 200 - Transfer successful
 * @response {Object} 400 - Insufficient balance or invalid amount
 * @response {Object} 403 - Insufficient verification level
 * @response {Object} 401 - Authentication required
 */
router.post(
  '/me/transfer-tokens',
  authorize({
    allowedRoles: ['*'],
    requiredVerificationLevel: 'COMMUNITY_VERIFIED',
    minImpactPoints: 10 // Minimum IP required for economic participation
  }),
  validateEconomicRequest(transferUtilityTokensSchema),
  userController.transferUtilityTokensHandler
);

/**
 * @route GET /api/users/me/economic-profile
 * @description UJAMAADAO Economic Profile
 * 
 * Returns specialized economic profile with three-tier system data
 * and governance capabilities for economic operations.
 * 
 * @access Authenticated
 * 
 * @example
 * GET /api/users/me/economic-profile
 * Authorization: Bearer <token>
 * 
 * @response {Object} 200 - Economic profile data
 * @response {Object} 401 - Authentication required
 */
router.get(
  '/me/economic-profile',
  authorize({
    allowedRoles: ['*'],
    requiredVerificationLevel: 'PHONE_VERIFIED'
  }),
  userController.getEconomicProfileHandler
);

// ============================================================================
// GEOGRAPHIC ROUTES (Location-Based Operations)
// ============================================================================

/**
 * @route GET /api/users/ward/:wardId
 * @description UJAMAADAO Ward Members Lookup
 * 
 * Returns users belonging to a specific ward with public profile data.
 * Requires geographic context validation.
 * 
 * @access Authenticated
 * 
 * @example
 * GET /api/users/ward/ward-uuid
 * Authorization: Bearer <token>
 * 
 * @response {Object} 200 - List of ward members
 * @response {Object} 403 - Insufficient geographic access
 * @response {Object} 401 - Authentication required
 */
router.get(
  '/ward/:wardId',
  authorize({
    allowedRoles: ['ward:member', 'ward:admin', 'system:super_admin'],
    geographicScope: 'WARD',
    validateGeographicContext: true
  }),
  userController.getWardMembersHandler
);

/**
 * @route GET /api/users/constituency/:constituencyId
 * @description UJAMAADAO Constituency Members Lookup
 * 
 * Returns users belonging to a specific constituency with public profile data.
 * Requires appropriate geographic roles.
 * 
 * @access Authenticated + Geographic Roles
 * 
 * @example
 * GET /api/users/constituency/constituency-uuid
 * Authorization: Bearer <token>
 * 
 * @response {Object} 200 - List of constituency members
 * @response {Object} 403 - Insufficient geographic access
 * @response {Object} 401 - Authentication required
 */
router.get(
  '/constituency/:constituencyId',
  authorize({
    allowedRoles: ['constituency:member', 'constituency:admin', 'system:super_admin'],
    geographicScope: 'CONSTITUENCY'
  }),
  userController.getConstituencyMembersHandler
);

// ============================================================================
// ADMINISTRATIVE ROUTES (System Administration)
// ============================================================================

/**
 * @route GET /api/users
 * @description UJAMAADAO User Administration
 * 
 * Returns paginated list of users for administrative purposes.
 * Requires system administration privileges.
 * 
 * @access System Administrators Only
 * 
 * @example
 * GET /api/users?page=1&limit=20
 * Authorization: Bearer <token>
 * 
 * @response {Object} 200 - Paginated user list
 * @response {Object} 403 - Insufficient privileges
 * @response {Object} 401 - Authentication required
 */
router.get(
  '/',
  authorize({
    allowedRoles: ['system:super_admin', 'system:auditor'],
    requiredVerificationLevel: 'FULLY_VERIFIED'
  }),
  userController.getUsersAdminHandler
);

/**
 * @route PATCH /api/users/:userId/verification
 * @description UJAMAADAO Administrative Verification Override
 * 
 * Allows system administrators to manually update user verification status
 * for support and administrative purposes.
 * 
 * @access System Administrators Only
 * 
 * @example
 * PATCH /api/users/user-uuid/verification
 * Authorization: Bearer <token>
 * {
 *   "phoneVerified": true,
 *   "communityVerified": true
 * }
 * 
 * @response {Object} 200 - Verification status updated
 * @response {Object} 403 - Insufficient privileges
 * @response {Object} 401 - Authentication required
 */
router.patch(
  '/:userId/verification',
  authorize({
    allowedRoles: ['system:super_admin'],
    requiredVerificationLevel: 'FULLY_VERIFIED'
  }),
  userController.updateUserVerificationAdminHandler
);

export default router;
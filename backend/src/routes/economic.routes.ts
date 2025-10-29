/**
 * @file economic.routes.ts
 *
 * @description
 * Defines the API routes for the UJAMAADAO Economic System.
 * This file orchestrates the middleware chain for security, validation, and business logic.
 */

import { Router } from 'express';
import {
  awardImpactPointsHandler,
  transferUtilityTokensHandler,
  getEconomicProfileHandler,
  getVotingWeightHandler,
  resetParticipationRightsHandler,
  getTransactionHistoryHandler
} from '../controllers/economic.controller.js';
// Assuming these custom middlewares are available
import { authorize } from '../middlewares/authorize.js';
import { enforceEconomicChecks } from '../middlewares/economicChecks.middleware.js'; 
import { validateRequest } from '../middlewares/validateRequest.js'; 
import { economicValidations } from '../validation/economic.validation.js';

const router = Router();

// --- CRITICAL ECONOMIC ENDPOINT: TOKEN TRANSFER ---
/**
 * POST /api/v1/economic/transfer-tokens
 * Endpoint for utility token transfer. Requires multiple layers of checks.
 *
 * Middleware Chain Order (CRITICAL for security):
 * 1. RBAC (Authorize): Ensures only authenticated users can access.
 * 2. Economic Checks (Business Logic): Ensures user is verified, has min IP, and prevents self-transfer.
 * 3. Zod Validation (Schema): Ensures request body is correctly formatted and typed.
 * 4. Controller: Executes service logic.
 */
router.post(
  '/transfer-tokens',
  authorize({
    // Everyone verified can transfer, '*' role is allowed access to the route
    allowedRoles: ['*'], 
    requiredVerificationLevel: 'COMMUNITY_VERIFIED'
  } as unknown as any),
  // 1. Business Logic Gate: Min IP, Self-Transfer Check
  enforceEconomicChecks({
    requiredVerificationLevel: 'COMMUNITY_VERIFIED',
    minImpactPoints: 10 // Business rule: Require 10 IP for a transfer
  }),
  // 2. Schema Validation: Checks wallet format, amount range
  validateRequest(economicValidations.transferTokens),
  // 3. Controller
  transferUtilityTokensHandler
);

// --- ADMIN / SYSTEM ENDPOINTS ---

/**
 * POST /api/v1/economic/award-impact-points
 * Awards impact points. Requires high-level system permissions.
 */
router.post(
  '/award-impact-points',
  authorize({
    allowedRoles: ['system:super_admin', 'economic:validator', 'project:admin'],
    requiredVerificationLevel: 'COMMUNITY_VERIFIED'
  } as unknown as any),
  validateRequest(economicValidations.awardImpactPoints),
  awardImpactPointsHandler
);

/**
 * POST /api/v1/economic/reset-participation-rights/:userId
 * Resets participation rights for a user. Administrative action.
 */
router.post(
  '/reset-participation-rights/:userId',
  authorize({
    allowedRoles: ['system:super_admin', 'economic:admin'],
    // FIX: Changed 'FULLY_VERIFIED' to 'FULL_VERIFIED' to match types and middleware
    requiredVerificationLevel: 'FULL_VERIFIED' 
  } as unknown as any),
  validateRequest(economicValidations.getEconomicProfile), // Reusing param validation
  resetParticipationRightsHandler
);

// --- USER PROFILE / READ ENDPOINTS ---

/**
 * GET /api/v1/economic/profile/:userId (Admin view)
 * GET /api/v1/economic/profile (Self view)
 * Returns the comprehensive economic profile.
 */
router.get(
  '/profile/:userId?',
  authorize({
    // Allows admins to view anyone, and users to view themselves (self:profile)
    allowedRoles: ['economic:auditor', 'self:profile'], 
    requiredVerificationLevel: 'PHONE_VERIFIED'
  } as unknown as any),
  validateRequest(economicValidations.getEconomicProfile),
  getEconomicProfileHandler
);

/**
 * GET /api/v1/economic/transaction-history/:userId (Admin view)
 * GET /api/v1/economic/transaction-history (Self view)
 * Returns paginated transaction history.
 */
router.get(
  '/transaction-history/:userId?',
  authorize({
    allowedRoles: ['economic:auditor', 'self:profile'], 
    requiredVerificationLevel: 'COMMUNITY_VERIFIED'
  } as unknown as any),
  validateRequest(economicValidations.getTransactionHistory),
  getTransactionHistoryHandler
);

/**
 * GET /api/v1/economic/voting-weight
 * Calculates and returns the user's current voting weight.
 */
router.get(
  '/voting-weight',
  authorize({ 
    allowedRoles: ['*'], 
    requiredVerificationLevel: 'PHONE_VERIFIED' 
  } as unknown as any),
  getVotingWeightHandler
);


export default router;

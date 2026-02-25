/**
 * @file src/modules/economy/routes/economy.routes.ts
 * @description
 * Economy Module Routes - Participation Rights, Dues & Commitments
 *
 * Endpoints:
 * - PR balance & history
 * - Dues payment history
 * - Commitments list
 * - Opt-in to monthly dues commitment
 *
 * Version: 1.0 — January 2026
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/utils/response.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { buildRateLimiter } from '../../../core/middleware/rateLimiter.js';

// Validators
import { duesOptInSchema } from '../validators/economy.validators.js';

// Handlers
import {
  getPRBalance,
  getDuesHistory,
  getCommitments,
  optInDuesCommitment,
} from '../handlers/economy.handlers.js';

const router = Router();

// All economy routes require authentication
router.use(authenticate);

// ============================================================================
// PARTICIPATION RIGHTS
// ============================================================================

/**
 * GET /economy/pr
 * Get user's Participation Rights balance + recent history
 * Requires: COMMUNITY_VERIFIED
 */
router.get(
  '/pr',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getPRBalance)
);

// ============================================================================
// DUES HISTORY
// ============================================================================

/**
 * GET /economy/dues/history
 * Get user's dues payment history & totals
 * Requires: COMMUNITY_VERIFIED
 */
router.get(
  '/dues/history',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getDuesHistory)
);

// ============================================================================
// COMMITMENTS
// ============================================================================

/**
 * GET /economy/commitments
 * Get user's active and past commitments
 * Requires: COMMUNITY_VERIFIED
 */
router.get(
  '/commitments',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getCommitments)
);

/**
 * POST /economy/commitments/dues
 * Opt-in to monthly dues commitment (voluntary)
 * Requires: COMMUNITY_VERIFIED
 * Rate limited: 1 per month
 */
router.post(
  '/commitments/dues',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  buildRateLimiter({ windowMs: 30 * 24 * 60 * 60 * 1000, max: 1 }), // 1 per month
  validateRequest({ schema: duesOptInSchema, target: 'body' }),
  asyncHandler(optInDuesCommitment)
);

// ============================================================================
// FUTURE ENDPOINTS (placeholders)
// ============================================================================

// router.post("/pr/spend", authorize({ verificationLevel: 'FULL_VERIFIED' }), asyncHandler(spendPR));
// router.get("/transactions", authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }), asyncHandler(getTransactionHistory));

export default router;

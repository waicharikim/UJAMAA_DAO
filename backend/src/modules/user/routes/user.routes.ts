/**
 * @file src/modules/user/routes/user.routes.ts
 * @description
 * User Module Routes - Profile management + Community Verification
 * 
 * Updated: February 2026 — Added strong dual rate limiting (per-user + IP) on all write endpoints
 * Security: Full layered authorization (Layers 1–3) + rate limiting
 *
 * Version: 1.5 — February 2026
 */

import { Router } from "express";
import { asyncHandler } from "../../../core/utils/response.js";
import { validateRequest } from "../../../core/middleware/ValidateRequests.js";
import { authenticate } from "../../../core/middleware/auth.middleware.js";
import { authorize } from "../../../core/middleware/authorize.js";
import { buildRateLimiter } from "../../../core/middleware/rateLimiter.js";

// Validators
import {
  updateProfileSchema,
  userIdParamSchema,
  selectIndustriesSchema,
  selectGoodsServicesSchema,
  requestResidenceChangeSchema,
  setTemporaryLocationSchema,
  vouchRequestSchema,
  paymentVerificationSchema,
} from "../validators/user.validators.js";

// Handlers (split by domain)
import { getMyProfile, getUserProfile, updateProfile } from "../handlers/profile.handlers.js";
import { selectIndustries, getMyIndustries } from "../handlers/industries.handlers.js";
import { selectGoodsServices, getMyGoodsServices } from "../handlers/goods-services.handlers.js";
import { requestResidenceChange, getMyResidenceChangeRequests, setTemporaryLocation, clearTemporaryLocation } from "../handlers/residence.handlers.js";
import { getPrivacySettings, getAccessibilitySettings } from "../handlers/settings.handlers.js";
import { requestCommunityVerification, vouchForUser, processVerificationPayment, getVerificationStatus } from "../handlers/verification.handlers.js";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

router.get(
  "/me",
  authorize({ verificationLevel: 'EMAIL_VERIFIED' }),
  asyncHandler(getMyProfile)
);

router.patch(
  "/me/profile",
  authorize({ verificationLevel: 'EMAIL_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 10 }), // global IP limit
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  validateRequest({ schema: updateProfileSchema, target: 'body' }),
  asyncHandler(updateProfile)
);

// ============================================================================
// INDUSTRIES & GOODS/SERVICES
// ============================================================================

router.get(
  "/me/industries",
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getMyIndustries)
);

router.post(
  "/me/industries",
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }), // global IP limit
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  validateRequest({ schema: selectIndustriesSchema, target: 'body' }),
  asyncHandler(selectIndustries)
);

router.get(
  "/me/goods-services",
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getMyGoodsServices)
);

router.post(
  "/me/goods-services",
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }), // global IP limit
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  validateRequest({ schema: selectGoodsServicesSchema, target: 'body' }),
  asyncHandler(selectGoodsServices)
);

// ============================================================================
// RESIDENCE & LOCATION
// ============================================================================

router.get(
  "/me/residence-change-requests",
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getMyResidenceChangeRequests)
);

router.post(
  "/me/request-residence-change",
  authenticate,
  buildRateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 1 }), // global IP limit
  buildRateLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    max: 1,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  authorize({
    verificationLevel: 'COMMUNITY_VERIFIED',
    minParticipationRights: 50,
  }),
  validateRequest({ schema: requestResidenceChangeSchema, target: 'body' }),
  asyncHandler(requestResidenceChange)
);

router.post(
  "/me/temporary-location",
  authenticate,
  buildRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }), // global IP limit
  buildRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: setTemporaryLocationSchema, target: 'body' }),
  asyncHandler(setTemporaryLocation)
);

router.delete(
  "/me/temporary-location",
  authenticate,
  buildRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }), // global IP limit
  buildRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(clearTemporaryLocation)
);

// ============================================================================
// PRIVACY & ACCESSIBILITY (read-only — no rate limit needed)
// ============================================================================

router.get(
  "/me/privacy-settings",
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getPrivacySettings)
);

router.get(
  "/me/accessibility",
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(getAccessibilitySettings)
);

// ============================================================================
// COMMUNITY VERIFICATION (Hybrid: Vouching + M-Pesa + Admin)
// ============================================================================

router.post(
  "/verify-community/request",
  authenticate,
  buildRateLimiter({ windowMs: 30 * 24 * 60 * 60 * 1000, max: 3 }), // global IP limit
  buildRateLimiter({
    windowMs: 30 * 24 * 60 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  authorize({ verificationLevel: 'PHONE_VERIFIED' }),
  asyncHandler(requestCommunityVerification)
);

router.post(
  "/verify-community/vouch",
  authenticate,
  buildRateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 5 }), // global IP limit
  buildRateLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: vouchRequestSchema, target: 'body' }),
  asyncHandler(vouchForUser)
);

router.post(
  "/verify-community/payment",
  authenticate,
  buildRateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 3 }), // global IP limit
  buildRateLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.user?.userId || req.ip,
  }), // per-user limit
  authorize({ verificationLevel: 'PHONE_VERIFIED' }),
  validateRequest({ schema: paymentVerificationSchema, target: 'body' }),
  asyncHandler(processVerificationPayment)
);

router.get(
  "/verify-community/status",
  authorize({ verificationLevel: 'PHONE_VERIFIED' }),
  asyncHandler(getVerificationStatus)
);

// ============================================================================
// PUBLIC PROFILE (last to avoid conflicts)
// ============================================================================

router.get(
  "/:userId",
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: userIdParamSchema, target: 'params' }),
  asyncHandler(getUserProfile)
);

export default router;
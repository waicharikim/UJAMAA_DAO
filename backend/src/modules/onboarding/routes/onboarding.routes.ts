/**
 * @file src/modules/onboarding/routes/onboarding.routes.ts
 * @description
 * Onboarding Routes
 * Version: 2.0 — December 2025
 */

import { Router } from "express";
import { OnboardingController } from "../controllers/onboarding.controller.js";
import { authenticate } from "../../../core/middleware/auth.middleware.js";
import { asyncHandler } from "../../../core/utils/response.js";

const router = Router();

router.use(authenticate);

router.get("/progress", asyncHandler(OnboardingController.getProgress));
router.post("/tutorial/:tutorialKey/complete", asyncHandler(OnboardingController.completeTutorial));
router.post("/milestone", asyncHandler(OnboardingController.markMilestone));

export default router;
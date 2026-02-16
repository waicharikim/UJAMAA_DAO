/**
 * @file src/modules/onboarding/controllers/onboarding.controller.ts
 * @description
 * Onboarding Controller
 * Version: 2.0 — December 2025
 */

import { Request, Response } from "express";
import { sendSuccess } from "../../../core/utils/response.js";
import { onboardingService } from "../services/onboarding.service.js";

export class OnboardingController {
  static async getProgress(req: Request, res: Response) {
    const userId = req.user!.userId;
    const progress = await onboardingService.getProgress(userId);
    sendSuccess(res, progress, "Onboarding progress");
  }

  static async completeTutorial(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { tutorialKey } = req.params;
    const completion = await onboardingService.completeTutorial(userId, tutorialKey);
    sendSuccess(res, completion, "Tutorial completed");
  }

  static async markMilestone(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { milestoneKey } = req.body;
    const milestone = await onboardingService.markMilestone(userId, milestoneKey);
    sendSuccess(res, milestone, "Milestone achieved");
  }
}
/**
 * @file src/modules/user/handlers/settings.handlers.ts
 * @description
 * Handlers for user privacy and accessibility settings retrieval
 * 
 * Version: 1.0 — February 2026
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { userService } from "../services/user.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { logger } from "../../../core/logger/logger.js";

/**
 * GET /users/me/privacy-settings
 * Get user's privacy settings
 */
export async function getPrivacySettings(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const settings = await userService.getPrivacySettings(userId);

    sendSuccess(
      res,
      settings,
      "Privacy settings retrieved successfully",
      200
    );
  } catch (error) {
    logger.error(
      { operationType: "USER_SETTINGS", userId, error: error instanceof Error ? error.message : String(error) },
      "Failed to retrieve privacy settings"
    );
    throw error;
  }
}

/**
 * GET /users/me/accessibility
 * Get user's accessibility settings
 */
export async function getAccessibilitySettings(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  try {
    const settings = await userService.getAccessibilitySettings(userId);

    sendSuccess(
      res,
      settings,
      "Accessibility settings retrieved successfully",
      200
    );
  } catch (error) {
    logger.error(
      { operationType: "USER_SETTINGS", userId, error: error instanceof Error ? error.message : String(error) },
      "Failed to retrieve accessibility settings"
    );
    throw error;
  }
}
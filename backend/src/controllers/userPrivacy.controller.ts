/**
 * @file userPrivacy.controller.ts
 *
 * @description
 * Controller for handling user privacy settings APIs.
 * - Provides routes to get and update a user's privacy settings.
 * - Ensures authentication and input validation.
 */

import type { Request, Response, NextFunction } from 'express';
import { privacySettingsSchema } from '../validation/privacySettings.validation.js';
import * as userPrivacyService from '../services/userPrivacy.service.js';
import { ZodError } from 'zod';

/**
 * GET /api/user-privacy/me/privacy
 * Retrieves the authenticated user's current privacy settings.
 */
export async function getPrivacySettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const privacySettings = await userPrivacyService.getUserPrivacySettings(userId);
    res.json(privacySettings);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/user-privacy/me/privacy
 * Updates the authenticated user's privacy settings.
 * Validates input against privacySettingsSchema.
 */
export async function updatePrivacySettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Validate request body with Zod schema
    const validatedSettings = privacySettingsSchema.parse(req.body);

    const updateSettings = await userPrivacyService.updateUserPrivacySettings(userId, validatedSettings, userId);
    res.json(updateSettings);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: (error as ZodError).errors });
    }
    next(error);
  }
}
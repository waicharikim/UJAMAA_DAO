/**
 * @file notification.controller.ts
 *
 * @description
 * Controller handling user notification preferences API endpoints.
 * - Exposes routes to get and update user preferences.
 * - Validates input and enforces authentication.
 */

import type { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service.js';

/**
 * GET /api/notifications/preferences
 * Retrieve notification preferences for authenticated user.
 */
export async function getNotificationPreferencesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const prefs = await notificationService.getUserNotificationPreferences(userId);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preference for authenticated user.
 * Expects JSON body: { channel, eventType, enabled }
 */
export async function updateNotificationPreferenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { channel, eventType, enabled } = req.body;
    if (!channel || !eventType || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const updated = await notificationService.updateUserNotificationPreference(userId, channel, eventType, enabled);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
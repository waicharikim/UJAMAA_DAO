/**
 * @file userActivity.controller.ts
 *
 * @description
 * Controller handling API requests related to user activity logs.
 * - Retrieves activity logs for a specified user.
 * - Requires authenticated access with proper authorization.
 */

import type { Request, Response, NextFunction } from 'express';
import * as userActivityService from '../services/userActivity.service.js';

/**
 * GET /api/user-activity/:userId
 * Fetches recent activity logs for the requested user.
 * Typically protected for admin or authorized roles.
 */
export async function getUserActivityLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const logs = await userActivityService.getUserActivities(userId);
    res.json(logs);
  } catch (error) {
    next(error);
  }
}
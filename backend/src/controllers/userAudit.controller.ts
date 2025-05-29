/**
 * @file userAudit.controller.ts
 *
 * @description
 * Controller responsible for handling API requests related to user audit logs.
 * - Fetches audit logs for a specified user.
 * - Validates input parameters.
 */

import type { Request, Response, NextFunction } from 'express';
import { getUserAuditLogs } from '../services/userAudit.service.js';

/**
 * GET /api/user-audit/:userId
 * Returns audit logs for the specified user.
 */
export async function getUserAuditLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const logs = await getUserAuditLogs(userId);
    res.json(logs);
  } catch (error) {
    next(error);
  }
}
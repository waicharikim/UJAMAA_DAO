/**
 * @file userConsent.controller.ts
 *
 * @description
 * Controller handling API endpoints for user consent management.
 * - Record a user's consent to a specified policy and version.
 * - Retrieve all consents given by the authenticated user.
 */

import type { Request, Response, NextFunction } from 'express';
import * as userConsentService from '../services/userConsent.service.js';
import { recordConsentSchema } from '../validation/consent.validation.js';
import { ZodError } from 'zod';

/**
 * POST /api/user-consent/consent
 * Records the authenticated user's consent to a policy.
 */
export async function recordConsentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Validate request body
    const validated = recordConsentSchema.parse(req.body);

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent']?.toString() ?? '';

    const result = await userConsentService.recordUserConsent(
      userId,
      validated.policyType,
      validated.version,
      ipAddress,
      userAgent,
    );

    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Invalid input',
        details: (error as ZodError).errors,
      });
    }
    next(error);
  }
}

/**
 * GET /api/user-consent/consents
 * Returns all consent records for the authenticated user.
 */
export async function getUserConsentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const consents = await userConsentService.getUserConsents(userId);
    res.json(consents);
  } catch (error) {
    next(error);
  }
}
/**
 * @file emailVerification.controller.ts
 *
 * @description
 * Controller for handling email verification related endpoints.
 * - Sends verification emails with tokens.
 * - Verifies user emails based on tokens.
 */

import type { Request, Response, NextFunction } from 'express';
import * as emailVerificationService from '../services/emailVerification.service.js';
import * as emailService from '../services/email.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * POST /api/auth/send-email-verification
 * Sends a verification email with a secure token to the authenticated user.
 */
export async function sendEmailVerificationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get user email from database
    const user = await req.app.locals.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError('User not found', 404);
    if (!user.email) throw new ApiError('User email not set', 400);

    // Generate verification token and send email
    const token = await emailVerificationService.generateEmailVerificationToken(userId);
    await emailService.sendVerificationEmail(user.email, token);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/verify-email
 * Verifies a user’s email using the provided verification token.
 */
export async function verifyEmailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Verification token is required' });

    await emailVerificationService.verifyEmailWithToken(token);

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
}
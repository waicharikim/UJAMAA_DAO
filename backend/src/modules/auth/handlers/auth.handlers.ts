/**
 * @file src/modules/auth/handlers/auth.handlers.ts
 * @description
 * Request handlers for magic link authentication
 *
 * Version: 2.1 — January 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { SendMagicLinkDto } from '../types.js';

/**
 * POST /auth/magic-link/send
 * Send magic link (registration or login)
 */
export async function sendMagicLink(req: AuthRequest, res: Response) {
  const params: SendMagicLinkDto = req.body;

  const result = await authService.sendMagicLink(params);

  sendSuccess(
    res,
    result,
    result.newUser
      ? 'Verification email sent. Please check your inbox.'
      : 'Login link sent. Please check your inbox.',
    200
  );
}

/**
 * GET /auth/verify-email?token=...
 * Verify email verification token
 */
export async function verifyEmail(req: AuthRequest, res: Response) {
  const { token } = req.query as { token: string };

  const context = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };

  const result = await authService.verifyEmailToken(token, context);

  sendSuccess(
    res,
    result,
    'Email verified successfully. Welcome to UjamaaDAO!',
    200
  );
}

/**
 * GET /auth/login?token=...
 * Verify magic link login token
 */
export async function verifyMagicLink(req: AuthRequest, res: Response) {
  const { token } = req.query as { token: string };

  const context = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };

  const result = await authService.verifyMagicLink(token, context);

  sendSuccess(res, result, 'Login successful. Welcome back!', 200);
}

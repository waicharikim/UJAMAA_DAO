/**
 * @file src/modules/auth/handlers/refresh-token.handlers.ts
 * @description
 * Request handlers for token refresh
 *
 * Version: 1.0 — January 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { refreshTokenService } from '../services/refresh-token.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { ApiError } from '../../../core/errors/ApiError.js';

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 *
 * Body: { refreshToken: string }
 */
export async function refreshToken(req: AuthRequest, res: Response) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw ApiError.badRequest('Refresh token is required');
  }

  const context = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };

  const result = await refreshTokenService.refresh(refreshToken, context);

  sendSuccess(res, result, 'Token refreshed successfully', 200);
}

/**
 * POST /auth/revoke-refresh-tokens
 * Revoke all refresh tokens for current user (logout all devices)
 * Requires authentication
 */
export async function revokeAllRefreshTokens(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  await refreshTokenService.revokeAllForUser(userId);

  sendSuccess(
    res,
    { success: true },
    'All refresh tokens revoked successfully',
    200
  );
}

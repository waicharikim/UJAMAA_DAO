/**
 * @file src/modules/auth/routes/auth.routes.extended.ts
 * @description
 * Extended authentication routes - Refresh tokens, session management, phone verification
 *
 * Endpoints:
 * - POST /refresh - Refresh access token
 * - GET /sessions - List active sessions
 * - POST /sessions/:id/rename - Rename session
 * - POST /sessions/:id/trust - Trust device
 * - DELETE /sessions/:id - Revoke specific session
 * - DELETE /sessions/others - Revoke all other sessions
 * - POST /phone/send-code - Send SMS verification code
 * - POST /phone/verify - Verify SMS code
 *
 * Version: 1.0 — January 2026
 */

import { Response, Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateBody } from '../../../core/middleware/validateRequest.js';
import {
  authRateLimit,
  strictRateLimit,
} from '../../../core/middleware/rateLimiter.js';
import { refreshTokenService } from '../services/refresh-token.service.js';
import { sessionDeviceService } from '../services/session-device.service.js';
import { phoneVerificationService } from '../services/phone-verification.service.js';
import { sendSuccess, sendError } from '../../../core/utils/response.js';
import { catchAsync } from '../../../core/middleware/errorHandler.js';
import type { AuthRequest } from '../../../core/types/Ujamaadao.types.js';

const router = Router();

// ==========================================================================
// REFRESH TOKEN
// ==========================================================================

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  authRateLimit(),
  validateBody(refreshTokenSchema),
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const { refreshToken } = req.body;

      const result = await refreshTokenService.refresh(refreshToken, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, result, 'Token refreshed successfully');
    }
  )
);

// ==========================================================================
// SESSION MANAGEMENT
// ==========================================================================

/**
 * GET /api/v1/auth/sessions
 * List all active sessions for current user
 */
router.get(
  '/sessions',
  authRateLimit(),
  authenticate,
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const currentSessionId = req.sessionId;

      const sessions = await sessionDeviceService.getUserSessions(
        userId,
        currentSessionId
      );

      sendSuccess(res, sessions, 'Sessions retrieved successfully');
    }
  )
);

/**
 * GET /api/v1/auth/sessions/suspicious
 * Detect suspicious sessions
 */
router.get(
  '/sessions/suspicious',
  authRateLimit(),
  authenticate,
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;

      const suspicious =
        await sessionDeviceService.detectSuspiciousSessions(userId);

      sendSuccess(res, suspicious, 'Suspicious sessions detected');
    }
  )
);

const renameSessionSchema = z.object({
  deviceName: z.string().min(1).max(100),
});

/**
 * POST /api/v1/auth/sessions/:sessionId/rename
 * Give session a friendly name
 */
router.post(
  '/sessions/:sessionId/rename',
  authRateLimit(),
  authenticate,
  validateBody(renameSessionSchema),
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const { sessionId } = req.params;
      const { deviceName } = req.body;

      await sessionDeviceService.renameSession(userId, sessionId, deviceName);

      sendSuccess(res, null, 'Session renamed successfully');
    }
  )
);

/**
 * POST /api/v1/auth/sessions/:sessionId/trust
 * Mark device as trusted
 */
router.post(
  '/sessions/:sessionId/trust',
  authRateLimit(),
  authenticate,
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      await sessionDeviceService.trustDevice(userId, sessionId);

      sendSuccess(res, null, 'Device marked as trusted');
    }
  )
);

/**
 * DELETE /api/v1/auth/sessions/:sessionId/trust
 * Untrust device
 */
router.delete(
  '/sessions/:sessionId/trust',
  authRateLimit(),
  authenticate,
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      await sessionDeviceService.untrustDevice(userId, sessionId);

      sendSuccess(res, null, 'Device untrusted');
    }
  )
);

/**
 * DELETE /api/v1/auth/sessions/:sessionId
 * Revoke specific session (logout from one device)
 */
router.delete(
  '/sessions/:sessionId',
  authRateLimit(),
  authenticate,
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      await sessionDeviceService.revokeSession(userId, sessionId);

      sendSuccess(res, null, 'Session revoked successfully');
    }
  )
);

/**
 * DELETE /api/v1/auth/sessions/others
 * Logout from all other devices
 */
router.delete(
  '/sessions/others',
  authRateLimit(),
  authenticate,
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const currentSessionId = req.sessionId;

      if (!currentSessionId) {
        sendError(res, { message: 'No active session found' }, 400);
        return;
      }

      const count = await sessionDeviceService.revokeOtherSessions(
        userId,
        currentSessionId
      );

      sendSuccess(
        res,
        { revokedCount: count },
        `Logged out from ${count} other device(s)`
      );
    }
  )
);

// ==========================================================================
// PHONE VERIFICATION
// ==========================================================================

const sendCodeSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
});

/**
 * POST /api/v1/auth/phone/send-code
 * Send SMS verification code
 */
router.post(
  '/phone/send-code',
  strictRateLimit(), // Very strict - prevent SMS spam
  authenticate,
  validateBody(sendCodeSchema),
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const { phoneNumber } = req.body;

      const result = await phoneVerificationService.sendVerificationCode(
        phoneNumber,
        userId
      );

      sendSuccess(res, result, 'Verification code sent successfully');
    }
  )
);

const verifyCodeSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  code: z.string().length(6),
});

/**
 * POST /api/v1/auth/phone/verify
 * Verify SMS code
 */
router.post(
  '/phone/verify',
  strictRateLimit(),
  authenticate,
  validateBody(verifyCodeSchema),
  catchAsync(
    async (req: AuthRequest, res: Response<any, Record<string, any>>) => {
      const userId = req.user!.userId;
      const { phoneNumber, code } = req.body;

      await phoneVerificationService.verifyCode(phoneNumber, code, userId);

      sendSuccess(res, null, 'Phone number verified successfully');
    }
  )
);

export default router;

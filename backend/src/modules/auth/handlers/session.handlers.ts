/**
 * @file src/modules/auth/handlers/session.handlers.ts
 * @description
 * Request handlers for session management
 *
 * Version: 2.1 — January 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sessionService } from '../services/session.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { verifyJwtToken, JwtPayload } from '../../../core/utils/jwt.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';

/**
 * GET /auth/sessions
 * Get user's active sessions
 */
export async function getUserSessions(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  // Get current session ID from JWT
  const token = req.headers.authorization?.replace('Bearer ', '');
  let currentSessionId: string | undefined;

  if (token) {
    try {
      const payload = verifyJwtToken<JwtPayload>(token);
      currentSessionId = payload.sessionId;
    } catch {
      // Ignore token errors - just won't mark current session
    }
  }

  const sessions = await sessionService.getUserSessions(userId);

  // Mark current session
  const sessionsWithCurrent = sessions.map((session) => ({
    ...session,
    isCurrent: session.id === currentSessionId,
  }));

  sendSuccess(res, sessionsWithCurrent, 'Sessions retrieved successfully', 200);
}

/**
 * DELETE /auth/sessions/:sessionId
 * Revoke specific session
 */
export async function revokeSession(req: AuthRequest, res: Response) {
  const { sessionId } = req.params;
  const userId = req.user!.userId;

  await sessionService.revokeSession(sessionId, userId, req.correlationId);

  sendSuccess(res, { success: true }, 'Session revoked successfully', 200);
}

/**
 * DELETE /auth/sessions
 * Revoke all sessions except current (logout from all other devices)
 */
export async function revokeAllSessions(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  // Get current session ID from JWT
  const token = req.headers.authorization?.replace('Bearer ', '');
  let currentSessionId: string | undefined;

  if (token) {
    try {
      const payload = verifyJwtToken<JwtPayload>(token);
      currentSessionId = payload.sessionId;
    } catch {
      throw ApiError.authenticationError('Invalid token');
    }
  }

  const count = await sessionService.revokeAllUserSessions(
    userId,
    currentSessionId,
    req.correlationId
  );

  sendSuccess(
    res,
    { revokedCount: count },
    `${count} session(s) revoked successfully`,
    200
  );
}

/**
 * POST /auth/logout
 * Logout (revoke current session)
 */
export async function logout(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  // Get current session ID from JWT
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw ApiError.authenticationError('No session to logout');
  }

  try {
    const payload = verifyJwtToken<JwtPayload>(token);

    if (!payload.sessionId) {
      throw ApiError.authenticationError('Invalid session');
    }

    await sessionService.revokeSession(
      payload.sessionId,
      userId,
      req.correlationId
    );

    sendSuccess(res, { success: true }, 'Logged out successfully', 200);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.authenticationError('Invalid token');
  }
}

/**
 * @file src/modules/auth/handlers/password-reset.handlers.ts
 * @description
 * Request handlers for password reset (admin accounts only)
 * 
 * Version: 1.0 — January 2026
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { passwordResetService } from "../services/password-reset.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { ApiError } from "../../../core/errors/ApiError.js";

/**
 * POST /auth/password/request-reset
 * Request password reset email
 * 
 * Body: { email: string }
 * 
 * Note: Always returns success to prevent email enumeration
 */
export async function requestPasswordReset(req: AuthRequest, res: Response) {
  const { email } = req.body;

  if (!email) {
    throw ApiError.badRequest("Email is required");
  }

  // This always returns success (even if email doesn't exist) to prevent enumeration
  await passwordResetService.requestReset(email);

  sendSuccess(
    res,
    { success: true },
    "If an account exists with this email, a password reset link has been sent.",
    200
  );
}

/**
 * GET /auth/password/verify-token?token=...
 * Verify reset token validity (before showing reset form)
 */
export async function verifyResetToken(req: AuthRequest, res: Response) {
  const { token } = req.query as { token: string };

  if (!token) {
    throw ApiError.badRequest("Reset token is required");
  }

  // This will throw if token is invalid/expired
  const userId = await passwordResetService.verifyResetToken(token);

  sendSuccess(
    res,
    { valid: true },
    "Reset token is valid",
    200
  );
}

/**
 * POST /auth/password/reset
 * Reset password with token
 * 
 * Body: { token: string, newPassword: string }
 */
export async function resetPassword(req: AuthRequest, res: Response) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw ApiError.badRequest("Token and new password are required");
  }

  await passwordResetService.resetPassword(token, newPassword);

  sendSuccess(
    res,
    { success: true },
    "Password reset successfully. Please login with your new password.",
    200
  );
}
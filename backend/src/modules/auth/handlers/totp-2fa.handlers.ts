/**
 * @file src/modules/auth/handlers/totp-2fa.handlers.ts
 * @description
 * Request handlers for TOTP-based 2FA (Google Authenticator)
 * 
 * Version: 1.0 — January 2026
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { totp2FAService } from "../services/totp-2fa.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { ApiError } from "../../../core/errors/ApiError.js";

/**
 * POST /auth/2fa/enable
 * Enable 2FA for user - generates secret and QR code
 * Requires authentication
 */
export async function enable2FA(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const userEmail = req.user!.email;

  if (!userEmail) {
    throw ApiError.badRequest("Email is required to enable 2FA");
  }

  const result = await totp2FAService.enable(userId, userEmail);

  sendSuccess(
    res,
    result,
    "2FA setup initiated. Scan the QR code with your authenticator app and verify.",
    200
  );
}

/**
 * POST /auth/2fa/verify
 * Verify TOTP code to complete 2FA setup
 * 
 * Body: { code: string }
 */
export async function verify2FA(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { code } = req.body;

  if (!code) {
    throw ApiError.badRequest("Verification code is required");
  }

  const result = await totp2FAService.verify(userId, code);

  sendSuccess(
    res,
    { enabled: result },
    "2FA enabled successfully",
    200
  );
}

/**
 * POST /auth/2fa/disable
 * Disable 2FA for user
 * 
 * Body: { code: string }
 */
export async function disable2FA(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { code } = req.body;

  if (!code) {
    throw ApiError.badRequest("Verification code is required to disable 2FA");
  }

  await totp2FAService.disable(userId, code);

  sendSuccess(
    res,
    { success: true },
    "2FA disabled successfully",
    200
  );
}

/**
 * POST /auth/2fa/regenerate-backup-codes
 * Regenerate backup codes
 * 
 * Body: { code: string }
 */
export async function regenerateBackupCodes(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { code } = req.body;

  if (!code) {
    throw ApiError.badRequest("Verification code is required");
  }

  const backupCodes = await totp2FAService.regenerateBackupCodes(userId, code);

  sendSuccess(
    res,
    { backupCodes },
    "Backup codes regenerated. Save these in a secure location.",
    200
  );
}

/**
 * GET /auth/2fa/status
 * Get 2FA status for current user
 */
export async function get2FAStatus(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  const status = await totp2FAService.getStatus(userId);

  sendSuccess(
    res,
    status,
    "2FA status retrieved successfully",
    200
  );
}
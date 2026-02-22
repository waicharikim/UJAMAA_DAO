/**
 * @file src/modules/auth/handlers/phone-verification.handlers.ts
 * @description
 * Request handlers for phone verification
 *
 * Version: 1.0 — January 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { phoneVerificationService } from '../services/phone-verification.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { ApiError } from '../../../core/errors/ApiError.js';

/**
 * POST /auth/phone/send-code
 * Send SMS verification code
 *
 * Body: { phoneNumber: string }
 */
export async function sendVerificationCode(req: AuthRequest, res: Response) {
  const { phoneNumber } = req.body;
  const userId = req.user?.userId; // Optional - can be used during onboarding or profile update

  if (!phoneNumber) {
    throw ApiError.badRequest('Phone number is required');
  }

  const result = await phoneVerificationService.sendVerificationCode(
    phoneNumber,
    userId
  );

  sendSuccess(
    res,
    {
      success: result.success,
      expiresIn: result.expiresIn,
    },
    'Verification code sent successfully',
    200
  );
}

/**
 * POST /auth/phone/verify-code
 * Verify SMS code
 *
 * Body: { phoneNumber: string, code: string }
 */
export async function verifyCode(req: AuthRequest, res: Response) {
  const { phoneNumber, code } = req.body;
  const userId = req.user?.userId;

  if (!phoneNumber || !code) {
    throw ApiError.badRequest('Phone number and code are required');
  }

  const isValid = await phoneVerificationService.verifyCode(
    phoneNumber,
    code,
    userId
  );

  sendSuccess(
    res,
    { verified: isValid },
    'Phone number verified successfully',
    200
  );
}

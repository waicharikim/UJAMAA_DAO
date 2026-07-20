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
  const { phoneNumber, channel = 'sms' } = req.body;
  const userId = req.user?.userId;

  if (!phoneNumber) {
    throw ApiError.badRequest('Phone number is required');
  }

  const result = await phoneVerificationService.sendVerificationCode(
    phoneNumber,
    userId,
    channel
  );

  sendSuccess(
    res,
    {
      success: result.success,
      expiresIn: result.expiresIn,
      ...(result.devCode !== undefined && { devCode: result.devCode }),
      ...(result.telegramCode !== undefined && {
        telegramCode: result.telegramCode,
      }),
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

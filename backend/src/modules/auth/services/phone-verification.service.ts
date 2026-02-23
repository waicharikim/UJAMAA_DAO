/**
 * @file src/modules/auth/services/phone-verification.service.ts
 * @description
 * Phone Verification Service using SMS codes
 *
 * Features:
 * - Send SMS verification codes (Twilio / Africa's Talking / mock)
 * - Verify codes with rate limiting & attempt tracking
 * - Code expiry and resend cooldown
 * - Periodic cleanup of expired codes
 *
 * Version: 1.1 — February 2026
 * Updated: Enhanced cleanup logic, better logging, safe error handling
 */

import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { generateRandomHex } from '../../../core/utils/crypto.js';
import { userService } from '../../user/services/user.service.js';

// SMS Provider Configuration
const SMS_CONFIG = {
  enabled: process.env.ENABLE_SMS === 'true',
  provider: process.env.SMS_PROVIDER || 'twilio', // twilio, africastalking, mock
  codeLength: 6,
  codeExpiry: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  resendCooldown: 60 * 1000, // 1 minute
  cleanupRetentionDays: 30, // delete unverified codes older than 30 days
};

// Kenyan phone number validation (strict E.164 preferred)
const KENYA_PHONE_REGEX = /^\+254[17]\d{8}$/;

class PhoneVerificationService {
  /**
   * Send SMS verification code
   */
  async sendVerificationCode(
    phoneNumber: string,
    userId?: string
  ): Promise<{ success: boolean; expiresIn: number }> {
    // Validate phone number format
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      throw ApiError.badRequest('Invalid phone number format');
    }

    // Check if SMS is enabled
    if (!SMS_CONFIG.enabled) {
      logger.warn(
        { operationType: 'SMS_MOCK', phoneNumber: normalized },
        'SMS not enabled - using mock verification'
      );

      const mockCode = this.generateCode();
      console.log(`[SMS MOCK] To: ${normalized}, Code: ${mockCode}`);

      await this.storeVerificationCode(normalized, mockCode, userId);

      return {
        success: true,
        expiresIn: SMS_CONFIG.codeExpiry / 1000,
      };
    }

    // Check resend cooldown
    await this.checkResendCooldown(normalized);

    // Generate verification code
    const code = this.generateCode();

    // Store code in database
    await this.storeVerificationCode(normalized, code, userId);

    // Send SMS via provider
    try {
      await this.sendSMS(normalized, code);

      logger.info(
        {
          operationType: 'SMS_SENT',
          userId,
          metadata: { phoneNumber: normalized },
        },
        'SMS verification code sent'
      );

      return {
        success: true,
        expiresIn: SMS_CONFIG.codeExpiry / 1000,
      };
    } catch (error) {
      logger.error(
        {
          operationType: 'SMS_FAILURE',
          userId,
          metadata: {
            phoneNumber: normalized,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Failed to send SMS'
      );

      throw ApiError.externalServiceError('Failed to send SMS');
    }
  }

  /**
   * Verify SMS code
   */
  async verifyCode(
    phoneNumber: string,
    code: string,
    userId?: string
  ): Promise<boolean> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      throw ApiError.badRequest('Invalid phone number format');
    }

    // Sanitize code
    const sanitizedCode = code.replace(/[\s-]/g, '');

    if (sanitizedCode.length !== SMS_CONFIG.codeLength) {
      throw ApiError.badRequest('Invalid code format');
    }

    try {
      // Find latest valid verification record
      const verification = await prisma.phoneVerification.findFirst({
        where: {
          phoneNumber: normalized,
          ...(userId && { userId }),
          verified: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!verification) {
        logger.warn(
          {
            operationType: 'VERIFICATION',
            userId,
            metadata: { phoneNumber: normalized },
          },
          'No valid verification code found'
        );
        throw ApiError.badRequest('Invalid or expired code');
      }

      // Check max attempts
      if (verification.attempts >= SMS_CONFIG.maxAttempts) {
        logger.warn(
          {
            operationType: 'SECURITY',
            userId,
            metadata: {
              phoneNumber: normalized,
              attempts: verification.attempts,
            },
          },
          'Max verification attempts exceeded'
        );
        throw ApiError.badRequest('Too many attempts. Request a new code.');
      }

      // Verify code
      const isValid = verification.code === sanitizedCode;

      if (isValid) {
        await prisma.phoneVerification.update({
          where: { id: verification.id },
          data: {
            verified: true,
            verifiedAt: new Date(),
          },
        });

        // Update user if userId provided
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              phoneNumber: normalized,
              phoneVerified: true,
            },
          });

          // Check if all four flags now met → promote to FULL_VERIFIED
          await userService.checkFullVerification(userId);
        }

        logger.info(
          {
            operationType: 'VERIFICATION_SUCCESS',
            userId,
            metadata: { phoneNumber: normalized },
          },
          'Phone number verified successfully'
        );

        return true;
      } else {
        // Increment attempts
        await prisma.phoneVerification.update({
          where: { id: verification.id },
          data: { attempts: { increment: 1 } },
        });

        logger.warn(
          {
            operationType: 'VERIFICATION_ATTEMPT',
            userId,
            metadata: {
              phoneNumber: normalized,
              attempts: verification.attempts + 1,
            },
          },
          'Invalid verification code attempt'
        );

        throw ApiError.badRequest('Invalid code');
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Failed to verify code'
      );

      throw ApiError.systemError('Verification failed');
    }
  }

  // ─────────────────────────────────────────────
  // HELPER METHODS (unchanged from your original)
  // ─────────────────────────────────────────────

  private normalizePhoneNumber(phoneNumber: string): string | null {
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `+254${cleaned.substring(1)}`;
    }

    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return `+${cleaned}`;
    }

    if (cleaned.startsWith('+254') || KENYA_PHONE_REGEX.test(phoneNumber)) {
      return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`;
    }

    return null;
  }

  private generateCode(): string {
    const randomBytes = generateRandomHex(8);
    const number = parseInt(randomBytes.slice(0, 8), 16) % 1000000;
    return number.toString().padStart(6, '0');
  }

  private async storeVerificationCode(
    phoneNumber: string,
    code: string,
    userId?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + SMS_CONFIG.codeExpiry);

    await prisma.phoneVerification.create({
      data: {
        phoneNumber,
        code,
        expiresAt,
        userId,
        attempts: 0,
      },
    });
  }

  private async checkResendCooldown(phoneNumber: string): Promise<void> {
    const recent = await prisma.phoneVerification.findFirst({
      where: {
        phoneNumber,
        createdAt: { gte: new Date(Date.now() - SMS_CONFIG.resendCooldown) },
      },
    });

    if (recent) {
      const waitTime = Math.ceil(
        (recent.createdAt.getTime() + SMS_CONFIG.resendCooldown - Date.now()) /
          1000
      );

      throw ApiError.rateLimitError(
        `Please wait ${waitTime} seconds before requesting a new code`,
        waitTime
      );
    }
  }

  private async sendSMS(phoneNumber: string, code: string): Promise<void> {
    const message = `Your UjamaaDAO verification code is: ${code}. Valid for 15 minutes.`;

    switch (SMS_CONFIG.provider) {
      case 'twilio':
        await this.sendViaTwilio(phoneNumber, message);
        break;

      case 'africastalking':
        await this.sendViaAfricasTalking(phoneNumber, message);
        break;

      case 'mock':
        console.log(`[SMS Mock] To: ${phoneNumber}, Message: ${message}`);
        break;

      default:
        throw new Error(`Unsupported SMS provider: ${SMS_CONFIG.provider}`);
    }
  }

  private async sendViaTwilio(to: string, message: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // TODO: Implement actual Twilio API call
    console.log(`[Twilio] Would send to ${to}: ${message}`);
  }

  private async sendViaAfricasTalking(
    to: string,
    message: string
  ): Promise<void> {
    const apiKey = process.env.AT_API_KEY;
    const username = process.env.AT_USERNAME;

    if (!apiKey || !username) {
      throw new Error("Africa's Talking credentials not configured");
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — africastalking has no TypeScript type declarations
    const AfricasTalking = (await import('africastalking')).default;
    const at = AfricasTalking({ apiKey, username });
    await at.SMS.send({
      to: [to],
      message,
      from: process.env.AT_SENDER_ID || undefined,
    });
  }

  // ─────────────────────────────────────────────
  // CLEANUP METHODS (for BullMQ job)
  // ─────────────────────────────────────────────

  /**
   * Clean up expired phone verification codes
   * Deletes records where expiresAt < now
   * Also deletes very old unverified records (older than 30 days) to prevent table bloat
   * @returns Number of records deleted
   */
  async cleanupExpiredCodes(): Promise<number> {
    try {
      const now = new Date();

      // Delete expired codes
      const expiredResult = await prisma.phoneVerification.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });

      // Optional: also delete very old unverified records (safety net)
      const oldUnverifiedCutoff = new Date();
      oldUnverifiedCutoff.setDate(
        oldUnverifiedCutoff.getDate() - SMS_CONFIG.cleanupRetentionDays
      );

      const oldResult = await prisma.phoneVerification.deleteMany({
        where: {
          verified: false,
          createdAt: { lt: oldUnverifiedCutoff },
        },
      });

      const totalDeleted = expiredResult.count + oldResult.count;

      if (totalDeleted > 0) {
        logger.info(
          {
            operationType: 'CLEANUP',
            metadata: {
              expiredDeleted: expiredResult.count,
              oldUnverifiedDeleted: oldResult.count,
              totalDeleted,
            },
          },
          'Expired / stale phone verification codes cleaned up'
        );
      }

      return totalDeleted;
    } catch (error) {
      logger.error(
        {
          operationType: 'CLEANUP_ERROR',
          task: 'phone-verification',
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to clean up expired phone verification codes'
      );
      return 0;
    }
  }
}

export const phoneVerificationService = new PhoneVerificationService();
export default phoneVerificationService;

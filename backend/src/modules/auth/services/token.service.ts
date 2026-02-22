/**
 * @file src/modules/auth/services/token.service.ts
 * @description
 * Token Service — Handles creation, validation, and cleanup of various short-lived tokens
 *
 * Supported token types:
 * - Email verification / registration tokens (DB stored, one-time use)
 * - Magic link tokens (JWT, short-lived)
 * - Password reset tokens (DB stored, short-lived)
 * - Refresh tokens (if stored separately from sessions)
 *
 * Responsibilities:
 * - Secure token generation
 * - Validation & one-time use enforcement
 * - Periodic cleanup of expired tokens
 * - Logging & audit trail
 *
 * Version: 1.1 — February 2026
 * Updated: Added full cleanup methods for BullMQ integration
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import {
  signMagicLinkToken,
  JwtPayload,
} from '../../../core/utils/jwt.service.js';
import { generateRandomHex } from '../../../core/utils/crypto.js';

const TOKEN_CONFIG = {
  verificationExpiryHours: 24, // Email verification / registration
  magicLinkExpiryMinutes: 15, // Magic link JWT
  passwordResetExpiryHours: 2, // Password reset
  refreshTokenRetentionDays: 90, // Old refresh tokens cleanup
  cleanupRetentionDays: 30, // Safety net for unverified old tokens
};

export class TokenService {
  // ─────────────────────────────────────────────
  // TOKEN CREATION
  // ─────────────────────────────────────────────

  /**
   * Create verification token for new users / email confirmation
   * Stored in DB, one-time use, deleted after validation
   */
  async createVerificationToken(userId: string): Promise<string> {
    const token = generateRandomHex(32);
    const expiresAt = new Date(
      Date.now() + TOKEN_CONFIG.verificationExpiryHours * 60 * 60 * 1000
    );

    await prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    logger.info(
      { operationType: 'TOKEN_CREATE', type: 'verification', userId },
      'Verification token created'
    );

    return token;
  }

  /**
   * Create magic link token (short-lived JWT)
   * Contains minimal payload (userId, email)
   */
  async createMagicLinkToken(payload: JwtPayload): Promise<string> {
    const token = signMagicLinkToken(payload);

    logger.info(
      {
        operationType: 'TOKEN_CREATE',
        type: 'magic-link',
        userId: payload.sub,
      },
      'Magic link token created'
    );

    return token;
  }

  /**
   * Create password reset token (DB stored)
   */
  async createPasswordResetToken(_userId: string): Promise<string> {
    // Password reset is handled by passwordResetService which stores a tokenHash.
    // This stub exists for interface compatibility only.
    throw new Error('Use passwordResetService.requestReset() instead');
  }

  // ─────────────────────────────────────────────
  // TOKEN VALIDATION
  // ─────────────────────────────────────────────

  /**
   * Validate email verification / registration token
   * One-time use — deletes token after successful validation
   */
  async validateVerificationToken(token: string) {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      return null;
    }

    // One-time use: delete immediately
    await prisma.emailVerificationToken.delete({ where: { token } });

    logger.info(
      {
        operationType: 'TOKEN_VALIDATE',
        type: 'verification',
        userId: record.userId,
      },
      'Verification token validated and deleted'
    );

    return record.user;
  }

  /**
   * Validate password reset token
   * One-time use — deletes after validation
   */
  async validatePasswordResetToken(_token: string) {
    // Password reset validation is handled by passwordResetService.verifyResetToken().
    // This stub exists for interface compatibility only.
    throw new Error('Use passwordResetService.verifyResetToken() instead');
  }

  // ─────────────────────────────────────────────
  // TOKEN CLEANUP METHODS (for BullMQ)
  // ─────────────────────────────────────────────

  /**
   * Clean up expired email verification / registration tokens
   */
  async cleanupExpiredVerificationTokens(): Promise<number> {
    try {
      const result = await prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      if (result.count > 0) {
        logger.info(
          {
            operationType: 'TOKEN_CLEANUP',
            type: 'verification',
            count: result.count,
          },
          'Expired verification tokens cleaned up'
        );
      }

      return result.count;
    } catch (err) {
      logger.error(
        {
          operationType: 'CLEANUP_ERROR',
          task: 'verification-tokens',
          error: err instanceof Error ? err.message : String(err),
        },
        'Failed to clean up expired verification tokens'
      );
      return 0;
    }
  }

  /**
   * Clean up expired magic link tokens (if stored in DB)
   * (Usually magic links are JWTs and don't need DB cleanup — but added for completeness)
   */
  async cleanupExpiredMagicLinks(): Promise<number> {
    // If you store magic link tokens in DB (not just JWT), implement here
    // Most implementations use stateless JWT → no cleanup needed
    return 0; // placeholder — replace if needed
  }

  /**
   * Clean up expired password reset tokens
   */
  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    try {
      const result = await prisma.passwordReset.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      if (result.count > 0) {
        logger.info(
          {
            operationType: 'TOKEN_CLEANUP',
            type: 'password-reset',
            count: result.count,
          },
          'Expired password reset tokens cleaned up'
        );
      }

      return result.count;
    } catch (err) {
      logger.error(
        {
          operationType: 'CLEANUP_ERROR',
          task: 'password-reset-tokens',
          error: err instanceof Error ? err.message : String(err),
        },
        'Failed to clean up expired password reset tokens'
      );
      return 0;
    }
  }

  /**
   * Clean up very old refresh tokens (safety net)
   * Only needed if refresh tokens are stored separately from sessions
   */
  async cleanupOldRefreshTokens(): Promise<number> {
    // Refresh tokens are stored in Sessions (no separate RefreshToken model).
    // Session cleanup is handled by sessionService.cleanupExpiredSessions().
    return 0;
  }

  /**
   * Generate random session token (used when creating sessions)
   */
  generateSessionToken(): string {
    return generateRandomHex(48); // 96 characters hex
  }
}

export const tokenService = new TokenService();

/**
 * @file emailVerification.service.js
 *
 * @description
 * UJAMAADAO Email Verification Service (Progressive Verification Step 1)
 *
 * Manages the lifecycle of email verification tokens, ensuring:
 * 1. Secure, time-bound token generation and storage.
 * 2. Token validation and atomic updates to the user's 'emailVerified' status.
 * 3. Integration with the core user service to trigger progressive verification level advancement and Impact Point awards.
 * 4. Cache invalidation for immediate role/capability updates.
 */

import { randomBytes } from 'crypto';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import * as userService from './user.service.js';
import { clearUserRolesCache } from '../middlewares/attachUserRoles.middleware.js'; 

const TOKEN_EXPIRY_HOURS = 24;
const TOKEN_TYPE = 'EMAIL_VERIFICATION';

/**
 * Generate Email Verification Token
 *
 * Creates a secure, time-bound token and stores it in the database.
 *
 * @param {string} userId - The ID of the user requesting verification.
 * @returns {Promise<string>} The generated token string.
 */
export async function generateEmailVerificationToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }
  if (user.emailVerified) {
    throw new ApiError('Email is already verified.', 400, { code: 'EMAIL_ALREADY_VERIFIED' });
  }

  // Generate secure token (Base64 URL-safe)
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  try {
    // Use a transaction to ensure atomic invalidation and creation
    await prisma.$transaction(async (tx) => {
      // 1. Soft-invalidate any remaining active tokens for this user and type
      await tx.verificationToken.updateMany({
        where: {
          userId: userId,
          type: TOKEN_TYPE,
          usedAt: null,
          expiresAt: { gt: new Date() }
        },
        data: {
          expiresAt: new Date(Date.now() - 1), // Set expiry to the past
        },
      });

      // 2. Create the new token
      await tx.verificationToken.create({
        data: {
          token,
          userId,
          type: TOKEN_TYPE,
          expiresAt,
        },
      });
    });

    logger.info('UJAMAADAO Email Verification: Token generated', { userId, expiresAt });
    return token;
  } catch (error) {
    logger.error('UJAMAADAO Email Verification: Token generation failed', { userId, error });
    throw new ApiError('Failed to generate verification token.', 500);
  }
}

/**
 * Verify Email With Token
 *
 * Validates the token, marks the email as verified, and updates the user's
 * progressive verification level via the user service.
 *
 * @param {string} token - The verification token.
 * @returns {Promise<void>}
 */
export async function verifyEmailWithToken(token: string): Promise<void> {
  const verificationRecord = await prisma.verificationToken.findFirst({
    where: {
      token,
      type: TOKEN_TYPE,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!verificationRecord || !verificationRecord.user) {
    throw new ApiError('Invalid or expired verification token.', 400, {
      code: 'INVALID_TOKEN',
    });
  }

  const { user } = verificationRecord;
  const { id: userId } = user;

  try {
    // 1. Mark the token as used and update user status in a single transaction
    await prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.verificationToken.update({
        where: { id: verificationRecord.id },
        data: { usedAt: new Date() },
      });

      // Update user's email status (if not already verified)
      if (!user.emailVerified) {
        // Delegate to user.service to handle progressive verification, IP awards, and level calculation
        await userService.completeVerification(
            userId,
            'EMAIL', 
            { token },
            {
                ipAddress: 'SYSTEM', 
                userAgent: 'SYSTEM'
            }
        );
      }
    });

    // 2. Clear user roles cache for immediate capability updates
    clearUserRolesCache(userId);

    logger.info('UJAMAADAO Email Verification: User email status updated', { userId });

  } catch (error) {
    logger.error('UJAMAADAO Email Verification: Failed to complete verification transaction', { userId, error });
    throw error;
  }
}
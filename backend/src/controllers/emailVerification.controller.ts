/**
 * @file emailVerification.controller.js
 *
 * @description
 * UJAMAADAO Email Verification Service (Progressive Verification Step 1)
 *
 * This service manages the lifecycle of email verification tokens and the subsequent
 * update to the user's verification status, aligning with UJAMAADAO's progressive
 * verification system, Impact Point economy, and role-based access.
 *
 * Dependencies:
 * - prisma (for DB operations)
 * - logger (for audit and monitoring)
 * - crypto (for secure token generation)
 * - userService (for complex verification/economic updates)
 * - attachUserRoles.middleware (for cache invalidation)
 */

import { randomBytes } from 'crypto';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import * as userService from '../services/user.service.js'; // Assuming core updates are delegated here
import { clearUserRolesCache } from '../middlewares/attachUserRoles.middleware.js'; // For role update

const TOKEN_EXPIRY_HOURS = 24;
const TOKEN_TYPE = 'EMAIL_VERIFICATION';

/**
 * Generate Email Verification Token
 *
 * Creates a secure, time-bound token and stores it in the database,
 * replacing any existing unverified token for the user.
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

  // Generate secure token (Base64 URL-safe for use in URL query params)
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Use a transaction to ensure atomic upsert/creation
  await prisma.$transaction(async (tx) => {
    // 1. Invalidate any existing tokens for this user and type
    await tx.verificationToken.updateMany({
      where: {
        userId: userId,
        type: TOKEN_TYPE,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: {
        // Soft-invalidate remaining active tokens
        expiresAt: new Date(Date.now() - 1),
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
}

/**
 * Verify Email With Token
 *
 * Validates the token, marks the email as verified, advances the
 * progressive verification level, and grants related platform privileges.
 *
 * @param {string} token - The verification token received from the user.
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

  if (!verificationRecord) {
    throw new ApiError('Invalid or expired verification token.', 400, {
      code: 'INVALID_TOKEN',
      details: 'The token provided is either invalid, has expired, or has already been used.',
    });
  }

  const { user } = verificationRecord;
  if (!user) {
    throw new ApiError('Verification token linked to a non-existent user.', 404, {
      code: 'USER_NOT_FOUND',
    });
  }

  if (user.emailVerified) {
    // Log a warning but don't error out, just mark the token as used
    logger.warn('UJAMAADAO Email Verification: Attempted to verify already verified email', { userId: user.id });
  }

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
        // Note: This relies on a function in user.service.js to handle
        // the progressive verification logic (setting emailVerified to true,
        // calculating new level, awarding IP, etc.)
        await userService.completeVerification(
            userId,
            'EMAIL', // Use 'EMAIL' as the verification type
            { token },
            {
                ipAddress: 'SYSTEM', // Context for audit logging if available
                userAgent: 'SYSTEM'
            }
        );
      }
    });

    // 2. Clear user roles cache since verification status affects roles/capabilities
    clearUserRolesCache(userId);

    logger.info('UJAMAADAO Email Verification: User email status updated', { userId });

  } catch (error) {
    logger.error('UJAMAADAO Email Verification: Failed transaction', { userId, error });
    // Re-throw any errors encountered during the transaction (e.g., from userService)
    throw error;
  }
}
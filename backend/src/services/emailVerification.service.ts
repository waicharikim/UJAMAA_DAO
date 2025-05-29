/**
 * @file emailVerification.service.ts
 * 
 * @description
 * Service handling generation and verification of email verification tokens.
 * - Creates secure tokens with expiration used to confirm user emails.
 * - Updates user status upon successful verification.
 */

import prisma from '../prismaClient.js';
import { randomBytes } from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const VERIFICATION_TOKEN_SIZE = 32; // bytes
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

/**
 * Generates a secure email verification token for the specified user.
 * Stores token and expiration time in the user record.
 * 
 * @param userId - ID of the user to generate token for
 * @returns The generated token string
 */
export async function generateEmailVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(VERIFICATION_TOKEN_SIZE).toString('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 3600 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: token,
      emailVerificationTokenExpires: expiresAt,
      emailVerified: false,
    },
  });

  return token;
}

/**
 * Verifies a user’s email using the provided token.
 * Validates token existence and expiration.
 * Updates user record to mark email as verified.
 * 
 * @param token - The verification token to validate
 * @throws ApiError if token is missing, invalid, or expired
 */
export async function verifyEmailWithToken(token: string): Promise<void> {
  if (!token) throw new ApiError('Verification token is required', 400);

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationTokenExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new ApiError('Invalid or expired token', 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    },
  });

  logger.info(`Email verified for user ${user.id}`);
}
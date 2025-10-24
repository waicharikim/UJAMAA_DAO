/**
 * @file auth.service.ts
 *
 * @description
 * Service layer handling wallet-based authentication logic.
 *
 * Responsibilities include:
 * - Generating or retrieving nonce challenges tied to wallet addresses for login.
 * - Verifying signed nonces to authenticate users and issue JWT tokens.
 * - Rotating nonces post successful authentication to prevent replay attacks.
 *
 * Notes:
 * - When creating a new user for the first time (via /api/auth/nonce), we must
 *   populate required non-null UUID fields (constituencyOrigin, countyOrigin,
 *   constituencyLive, countyLive) to satisfy the Prisma schema. Those fields
 *   are not enforced as FK by Prisma in your schema, so generating random UUIDs
 *   is safe and keeps DB constraints happy.
 *
 * Security:
 * - JWT_SECRET must be set in env for production; tests default to 'your_jwt_secret_here'
 *   but in CI you should provide a real secret via environment variable.
 */

import prisma from '../prismaClient.js';
import { randomBytes, randomUUID } from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret_here';

/**
 * Retrieves or creates a user by wallet address and returns the current nonce.
 * If user not present, create a minimal user with valid UUIDs for required
 * location fields and a newly generated nonce.
 *
 * @param walletAddress - wallet address (string, case-insensitive)
 * @returns nonce string for signing by client
 */
export async function getNonce(walletAddress) {
  const normalizedWallet = String(walletAddress).toLowerCase();

  // **ENHANCED**: Always find existing user (created via /api/users)
  let user = await prisma.user.findUnique({ where: { walletAddress: normalizedWallet } });

  if (!user) {
    // **RARE CASE**: User exists in auth but not registration flow
    throw new ApiError('Please complete registration first', 400);
  }

  // **ENHANCED**: Always generate fresh nonce (no placeholder user creation)
  const nonce = randomBytes(16).toString('hex');
  
  await prisma.user.update({
    where: { walletAddress: normalizedWallet },
    data: { nonce }
  });

  return nonce;
}

/**
 * Verifies that the provided signature is a valid signature of the nonce for the given wallet.
 * On success:
 *  - rotates the nonce
 *  - issues a JWT token
 *  - returns { token, user } (user object excluding nonce)
 *
 * Throws ApiError(404) if user not found; ApiError(401) if signature invalid/mismatch.
 *
 * @param walletAddress - string wallet address
 * @param signature - signature string produced by wallet signMessage
 */
export async function verifySignature(walletAddress, signature) {
  const normalizedWallet = String(walletAddress).toLowerCase();

  // Fetch user (must exist; nonce challenge previously created)
  const user = await prisma.user.findUnique({ where: { walletAddress: normalizedWallet } });

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  const message = `Login nonce: ${user.nonce}`;

  let recoveredAddress;
  try {
    // ethers.verifyMessage returns the address that signed the message
    recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
  } catch (err) {
    // signature parse / verification error
    console.error('Error verifying signature:', err);
    throw new ApiError('Invalid signature', 401);
  }

  if (recoveredAddress !== normalizedWallet) {
    console.error(
      `Signature mismatch: recovered address ${recoveredAddress} does NOT match expected wallet ${normalizedWallet}`
    );
    throw new ApiError('Signature does not match wallet address', 401);
  }

  // Rotate nonce to prevent replay attacks
  const newNonce = randomBytes(16).toString('hex');
  await prisma.user.update({
    where: { walletAddress: normalizedWallet },
    data: { nonce: newNonce },
  });

  // Sign JWT token
  const token = jwt.sign(
    { walletAddress: normalizedWallet, userId: user.id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Remove nonce from returned user object
  const { nonce: _nonce, ...userSafe } = user;

  return { token, user: userSafe };
}
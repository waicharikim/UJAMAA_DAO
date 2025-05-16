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
 * This module normalizes wallet addresses to lowercase for consistent storage and verification.
 * Throws ApiError for authentication-related errors.
 */

import prisma from '../prismaClient.js';
import { randomBytes } from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret_here';

/**
 * Retrieves or creates a user by wallet address and returns a nonce for signing.
 * The walletAddress is normalized to lowercase for consistent storage and lookup.
 * @param walletAddress - User's wallet address (case-insensitive)
 * @returns The current nonce string associated with the user
 */
export async function getNonce(walletAddress: string): Promise<string> {
  const normalizedWallet = walletAddress.toLowerCase();

  let user = await prisma.user.findUnique({ where: { walletAddress: normalizedWallet } });

  if (!user) {
    const nonce = randomBytes(16).toString('hex');

    // Create a new user with default placeholder data and generated nonce
    user = await prisma.user.create({
      data: {
        walletAddress: normalizedWallet,
        email: `user_${Date.now()}@placeholder.local`, // You can update this to proper email later
        name: 'New User',
        constituencyOrigin: '',
        countyOrigin: '',
        constituencyLive: '',
        countyLive: '',
        nonce,
      },
    });
  }

  return user.nonce;
}

/**
 * Verifies the signature of the nonce signed by the user using their wallet private key.
 * If valid, generates a new nonce to prevent replay attacks and issues a JWT token.
 * @param walletAddress - Wallet address of the user (case-insensitive)
 * @param signature - Signature over the current nonce
 * @throws ApiError 401 if signature mismatch or other authorization fails
 * @throws ApiError 404 if user not found
 * @returns Object containing JWT token and user info (excluding nonce)
 */
export async function verifySignature(walletAddress: string, signature: string) {
  const normalizedWallet = walletAddress.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { walletAddress: normalizedWallet },
  });

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  const message = `Login nonce: ${user.nonce}`;

  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
  } catch (error) {
    console.error('Error verifying signature:', error);
    throw new ApiError('Invalid signature', 401);
  }

  if (recoveredAddress !== normalizedWallet) {
    console.error(
      `Signature mismatch: recovered address ${recoveredAddress} does NOT match expected wallet ${normalizedWallet}`
    );
    console.error(`Signature: ${signature}`);
    console.error(`Message signed: ${message}`);
    throw new ApiError('Signature does not match wallet address', 401);
  }

  // (Optional) Remove redundant nonce equality check — it is implicit above
  
  // (Optional) Add your 'already logged in' check here if you track it in DB, e.g.:
  // if (user.isLoggedIn) {
  //   console.error(`User ${normalizedWallet} is already logged in`);
  //   throw new ApiError('User already logged in', 401);
  // }

  // Rotate nonce for next login challenge to prevent replay
  const newNonce = randomBytes(16).toString('hex');

  await prisma.user.update({
    where: { walletAddress: normalizedWallet },
    data: { nonce: newNonce },
  });

  // Sign JWT token with relevant claims
  const token = jwt.sign(
    { walletAddress: normalizedWallet, userId: user.id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Return user info excluding sensitive nonce
  const { nonce, ...userSafe } = user as any;

  return { token, user: userSafe };
}
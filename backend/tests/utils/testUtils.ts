/**
 * @file testUtils.ts
 * 
 * @description
 * Utility helper functions for tests, including JWT token generation
 * using the app's JWT_SECRET to create valid tokens for authenticated requests.
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret';

/**
 * Generate a JWT token for use in tests.
 * 
 * @param userId - The ID of the user
 * @param walletAddress - The wallet address of the user
 * @param roles - Array of string roles assigned to the user
 * @returns JWT string signed with app secret, valid for 1 hour
 */
export function generateTestToken(userId: string, walletAddress: string, roles: string[] = []) {
  const payload = { userId, walletAddress, roles };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}
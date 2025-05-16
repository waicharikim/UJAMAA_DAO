import prisma from '../prismaClient.js';
import { randomBytes } from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret_here';

export async function getNonce(walletAddress: string): Promise<string> {
  let user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) {
    // Create user with a fresh nonce
    const nonce = randomBytes(16).toString('hex');
    user = await prisma.user.create({
      data: {
        walletAddress,
        email: `user_${Date.now()}@placeholder.local`, // Dummy email, update or require later
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

export async function verifySignature(walletAddress: string, signature: string): Promise<{ token: string; user: object }> {
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) throw new ApiError('User not found', 404);

  const message = `Login nonce: ${user.nonce}`;

  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch {
    throw new ApiError('Invalid signature', 401);
  }

  if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new ApiError('Signature does not match wallet address', 401);
  }

  // Generate new nonce to prevent replay attacks
  const newNonce = randomBytes(16).toString('hex');
  await prisma.user.update({
    where: { walletAddress },
    data: { nonce: newNonce },
  });

  // Sign JWT token
  const token = jwt.sign(
    { walletAddress, userId: user.id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Remove sensitive fields if you want before returning user object
  const userSafe = { ...user };
  delete (userSafe as any).nonce;

  return { token, user: userSafe };
}
// tests/helpers/superAdminHelper.ts

import prisma from '../../src/prismaClient.js';  // adjust path as needed
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret';

// Replace these IDs with valid seeded location IDs from your database
const CONSTITUENCY_ID = '0b5f1b20-db10-4331-ab15-27f8282bcbd1';  // Embakasi South
const COUNTY_ID = 'bf6e0838-0445-4650-9c5a-8295f540ab6f';        // Nairobi

// Wallet and email for super admin user
const SUPER_ADMIN_WALLET = '0x14efcd468C101B9d64a65a7a1C9d01f6e6896145';
const SUPER_ADMIN_EMAIL = 'superadmin@example.com';
const SUPER_ADMIN_NAME = 'Super Admin';

export async function getOrCreateSuperAdmin() {
  // Try to find existing super admin user
  let user = await prisma.user.findUnique({
    where: { walletAddress: SUPER_ADMIN_WALLET.toLowerCase() },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress: SUPER_ADMIN_WALLET.toLowerCase(),
        email: SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_NAME,
        nonce: crypto.randomUUID(),
        constituencyLive: CONSTITUENCY_ID,
        countyLive: COUNTY_ID,
        constituencyOrigin: CONSTITUENCY_ID,
        countyOrigin: COUNTY_ID,
      },
    });
  }

  // Check if super admin role exists
  const existingRole = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      role: 'SUPER_ADMIN',
    },
  });

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        role: 'SUPER_ADMIN',
        scope: null,
      },
    });
  }

  // Create JWT token for this user
  const tokenPayload = {
    userId: user.id,
    walletAddress: user.walletAddress,
    roles: ['system:super_admin'],
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  return { user, token };
}
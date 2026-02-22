import request from 'supertest';
import app from '../src/app.js'; // Adjust path as needed
import { Wallet } from 'ethers';
import crypto from 'crypto';
import prisma from '../src/prismaClient.js';

interface TestUser {
  id: string;
  walletAddress: string;
  email: string;
  jwtToken: string;
}

const TEST_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945384df71b1f68d0e3fcb7e3c54e920f2f11c';
const wallet = new Wallet(TEST_PRIVATE_KEY);

const UJAMAA_GROUP_ID = '00000000-0000-0000-0000-000000000001'; // Replace if different

const DEFAULTS = {
  walletAddress: wallet.address.toLowerCase(),
  email: 'testuser@example.com',
  name: 'Test User',
  countyLive: 'b92b823d-6a73-421a-9ce1-8c8b1852b134',
  constituencyLive: '2e48187f-5909-4403-9b07-6b0f951b1bc8',
  countyOrigin: 'b92b823d-6a73-421a-9ce1-8c8b1852b134',
  constituencyOrigin: '2e48187f-5909-4403-9b07-6b0f951b1bc8',
  industryId: '68c72509-6ebf-413f-8fba-5706cdc9c389',
  goodsServices: [
    'cc97b229-4642-4e8b-9502-7a1d6e4c7637',
    'c1f469fb-a22e-4726-8a9d-1dcd9488817e',
  ],
};

export async function createTestUser(): Promise<TestUser> {
  const walletAddress = DEFAULTS.walletAddress;
  const email = DEFAULTS.email;

  // Look for existing user by wallet
  let user = await prisma.user.findUnique({ where: { walletAddress } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress,
        email,
        name: DEFAULTS.name,
        countyLive: DEFAULTS.countyLive,
        constituencyLive: DEFAULTS.constituencyLive,
        countyOrigin: DEFAULTS.countyOrigin,
        constituencyOrigin: DEFAULTS.constituencyOrigin,
        industryId: DEFAULTS.industryId,
        goodsServices: { connect: DEFAULTS.goodsServices.map(id => ({ id })) },
        nonce: crypto.randomUUID(),
      },
    });

    // Assign default global role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        role: 'GENERAL_USER',
        scope: null,
      },
    });

    // Add user to Ujamaa Group
    await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: UJAMAA_GROUP_ID,
        role: 'MEMBER',
        active: true,
        joinedAt: new Date(),
      },
    });
  }

  // Fetch nonce for login flow
  const nonceRes = await request(app).get('/api/auth/nonce').query({ walletAddress });
  if (nonceRes.status !== 200) {
    throw new Error('Failed to get nonce from backend');
  }
  const nonce = nonceRes.body.nonce;

  // Sign nonce with wallet private key
  const message = `Login nonce: ${nonce}`;
  const signature = await wallet.signMessage(message);

  // Verify signature to obtain JWT
  const verifyRes = await request(app).post('/api/auth/verify').send({ walletAddress, signature });
  if (verifyRes.status !== 200) {
    throw new Error('Signature verification failed during test user login');
  }

  return {
    id: user.id,
    walletAddress,
    email,
    jwtToken: `Bearer ${verifyRes.body.token}`,
  };
}
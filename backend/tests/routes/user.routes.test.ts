import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/prismaClient.js';
import { Wallet } from 'ethers';

const TEST_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945384df71b1f68d0e3fcb7e3c54e920f2f11c';
const wallet = new Wallet(TEST_PRIVATE_KEY);

function signMessage(message: string) {
  return wallet.signMessage(message);
}

async function loginAndGetToken() {
  const walletAddress = wallet.address.toLowerCase();

  // Get nonce
  const nonceRes = await request(app).get('/api/auth/nonce').query({ walletAddress });
  if (nonceRes.status !== 200) throw new Error('Failed to get nonce');
  const nonce = nonceRes.body.nonce;

  // Sign nonce
  const message = `Login nonce: ${nonce}`;
  const signature = await signMessage(message);

  // Verify signature and get JWT token
  const verifyRes = await request(app)
    .post('/api/auth/verify')
    .send({ walletAddress, signature });
  if (verifyRes.status !== 200) throw new Error('Failed to verify signature');

  return `Bearer ${verifyRes.body.token}`;
}

describe('User Route Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Obtain a valid JWT token by logging in as the test user
    authToken = await loginAndGetToken();
  }, 30000); // Allow more time for login process

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should allow user registration (public route)', async () => {
    const payload = {
      walletAddress: '0x' + (Math.random().toString(16).slice(2).padEnd(40, '0')),
      email: `newuser${Date.now()}@example.com`,
      name: 'New User',
      countyLive: 'b92b823d-6a73-421a-9ce1-8c8b1852b134',
      constituencyLive: '2e48187f-5909-4403-9b07-6b0f951b1bc8',
      countyOrigin: 'b92b823d-6a73-421a-9ce1-8c8b1852b134',
      constituencyOrigin: '2e48187f-5909-4403-9b07-6b0f951b1bc8',
      industryId: '68c72509-6ebf-413f-8fba-5706cdc9c389',
      goodsServices: [
        'cc97b229-4642-4e8b-9502-7a1d6e4c7637',
        'c1f469fb-a22e-4726-8a9d-1dcd9488817e',
      ],
      phoneNumber: '1234567890',
    };

    const res = await request(app).post('/api/users').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.walletAddress.toLowerCase()).toBe(payload.walletAddress.toLowerCase());
  });

  it('should reject access to /me without auth token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should reject invalid auth token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid.token');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should allow authenticated user to fetch their profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', authToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('walletAddress');
    expect(res.body.walletAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it('should allow authenticated user to update their profile', async () => {
    const newName = 'Updated Name';
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authToken)
      .send({ name: newName });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', newName);
  });

  it('should return 400 on invalid update input', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authToken)
      .send({ countyLive: 'invalid-county-id' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
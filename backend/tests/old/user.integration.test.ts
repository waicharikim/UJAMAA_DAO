import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import prisma from '../src/prismaClient.js';
import app from '../../src/app.js';
import { generateTestToken } from '../utils/testUtils.js';

const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

describe('Canonical User API Integration Tests', () => {
  let createdUserId: string;
  let jwtToken: string;
  const testWallet = '0xf1eae4a2011695ab127f73b7e910c45ca4b30e5a';
  const testEmail = `integration_${Date.now()}@example.com`;

  // Replace these seeded IDs with whatever is appropriate in your test environment
  const seededCountyLive = '7378d182-26c6-45c1-864e-dee1ed8a3ffd';
  const seededConstituencyLive = '524de848-f940-406d-894d-df8c6bee6fa8';
  const seededCountyOrigin = '80ed8e1d-db92-409b-b004-2c3099ef094d';
  const seededConstituencyOrigin = 'c12317c3-cb0a-4a3b-ba8c-2f288b012858';
  const seededIndustryId = '20e7b855-4de8-46b3-8000-c01c8f28ac0c';
  const seededGoodsServices = [
    '0168c1b6-8957-4fc7-b25f-0d2ea8bba623',
    '7ebfa3cf-5459-454a-9765-67a44f7f85f9',
  ];

  beforeAll(async () => {
    // Ensure DB connection
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a user (POST /api/users) and return canonical shape', async () => {
    const payload = {
      walletAddress: testWallet,
      email: testEmail,
      name: 'Canonical Integration User',
      phoneNumber: '+254712345678', // +254 format per canonical decision
      constituencyOrigin: seededConstituencyOrigin,
      countyOrigin: seededCountyOrigin,
      constituencyLive: seededConstituencyLive,
      countyLive: seededCountyLive,
      industryId: seededIndustryId, // canonical field
      goodsServices: seededGoodsServices,
      avatarUrl: 'https://example.com/avatar.png',
    };

    const res = await request(app).post('/api/users').send(payload);
    expect(res.status).toBe(201);
    // canonical shape: { data: user }
    expect(res.body).toHaveProperty('data');
    const user = res.body.data;
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('walletAddress', testWallet.toLowerCase());
    expect(user).toHaveProperty('email', testEmail);
    expect(user).toHaveProperty('phoneNumber'); // normalized phone present

    createdUserId = user.id;

    // generate token for this user for subsequent authenticated calls
    jwtToken = generateTestToken(createdUserId, testWallet, ['system:general_user']);
  });

  it('should return current user profile at GET /api/users/me (canonical envelope)', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const user = res.body.data;
    expect(user).toHaveProperty('id', createdUserId);
    expect(user).toHaveProperty('name', 'Canonical Integration User');
    // phone returned in canonical +254 format
    expect(user.phoneNumber).toMatch(/^\+254[17]\d{7}$/);
  });

  it('should update the current user profile (PATCH /api/users/me)', async () => {
    const newPhone = '+254700123456';
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ phoneNumber: newPhone });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const user = res.body.data;
    expect(user).toHaveProperty('phoneNumber', newPhone);
  });

  it('should reject access without authorization', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('should upload avatar (multipart) and return data.avatarUrl inside canonical envelope', async () => {
    const filePath = path.join(__dirname, 'test-files', 'avatar.png');
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const pngBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
          '1f15c4890000000a49444154789c636001000000ffff03000006000557' +
          '0a2c0000000049454e44ae426082',
        'hex'
      );
      fs.writeFileSync(filePath, pngBuffer);
    }

    const res = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${jwtToken}`)
      .attach('avatar', filePath);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const user = res.body.data;
    expect(user).toHaveProperty('avatarUrl');
    // simple assertion that avatarUrl is a string and points under uploads (if your storage uses different, adapt)
    expect(typeof user.avatarUrl).toBe('string');
  });

  it('should fetch user by wallet address (GET /api/users/wallet/:wallet)', async () => {
    const res = await request(app)
      .get(`/api/users/wallet/${testWallet}`)
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const user = res.body.data;
    expect(user).toHaveProperty('id', createdUserId);
    expect(user).toHaveProperty('walletAddress', testWallet.toLowerCase());
  });
});
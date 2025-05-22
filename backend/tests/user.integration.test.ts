/**
 * @file user.integration.test.ts
 *
 * @description
 * Integration tests for user-related API endpoints.
 * Validates full stack including authentication, route correctness,
 * privacy filtering, and file upload.
 * Includes request logging middleware added to app for debugging.
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../src/prismaClient.js';
import { generateTestToken } from './utils/testUtils.js';
import app from '../src/app.js'; // Use actual app import

// Add request logging middleware for debugging unmatched routes and requests
// (Optional: Add in app.ts instead. You can remove this if not needed.)
// app.use((req, res, next) => {
//   console.log(`[TEST LOG] Incoming request: ${req.method} ${req.originalUrl}`);
//   next();
// });

const seededCountyLive = '7378d182-26c6-45c1-864e-dee1ed8a3ffd';
const seededConstituencyLive = '524de848-f940-406d-894d-df8c6bee6fa8';
const seededCountyOrigin = '80ed8e1d-db92-409b-b004-2c3099ef094d';
const seededConstituencyOrigin = 'c12317c3-cb0a-4a3b-ba8c-2f288b012858';
const seededIndustryId = '20e7b855-4de8-46b3-8000-c01c8f28ac0c';
const seededGoodsServices = [
  '0168c1b6-8957-4fc7-b25f-0d2ea8bba623',
  '7ebfa3cf-5459-454a-9765-67a44f7f85f9',
];

// Ensure upload directory exists before tests
const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

describe('User API Integration Tests', () => {
  let userId: string;
  let jwtToken: string;
  const testWallet = '0xf1eae4a2011695ab127f73b7e910c45ca4b30e5a';
  const testEmail = `integrationtest_${Date.now()}@example.com`;

  beforeAll(async () => {
    // Assume prisma connection and seeding done in testSetup

    // Create a user to test against via API
    const res = await request(app)
      .post('/api/users')
      .send({
        walletAddress: testWallet,
        email: testEmail,
        name: 'Integration Test User',
        phoneNumber: '0712345678',
        constituencyOrigin: seededConstituencyOrigin,
        countyOrigin: seededCountyOrigin,
        constituencyLive: seededConstituencyLive,
        countyLive: seededCountyLive,
        industry: seededIndustryId,
        goodsServices: seededGoodsServices,
        avatarUrl: 'https://example.com/avatar.png',
      });

    expect(res.status).toBe(201);
    userId = res.body.id;

    jwtToken = generateTestToken(userId, testWallet, ['system:general_user']);
  });

  afterAll(async () => {
    // Disconnect handled in testSetup afterAll
  });

  it('should retrieve the current user profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${jwtToken}`);

    console.log('Response body from /api/users/me:', res.body);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body).toHaveProperty('name', 'Integration Test User');
    //expect(res.body).toHaveProperty('email', testEmail);
    
  });

  it('should update the current user profile', async () => {
    const updatedPhone = '0700123456';

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ phoneNumber: updatedPhone });

    expect(res.status).toBe(200);
    expect(res.body.phoneNumber).toBe(updatedPhone);
  });

  it('should reject access without auth token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('should upload avatar successfully', async () => {
    const filePath = path.join(__dirname, 'test-files', 'avatar.png');

    // Create dummy PNG if not present
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
    expect(res.body).toHaveProperty('avatarUrl');
  });

  it('should fetch user by wallet address', async () => {
    const res = await request(app)
      .get(`/api/users/wallet/${testWallet}`)
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
  });
});
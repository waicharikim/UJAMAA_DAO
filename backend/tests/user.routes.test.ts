import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/prismaClient.js';

describe('User API', () => {

  beforeAll(async () => {
    // Optionally clear relevant tables before testing
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Close connection after tests
    await prisma.$disconnect();
  });

  it('GET /health - should return OK status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'OK' });
  });

  it('POST /api/users - should create a new user', async () => {
    const newUser = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      email: 'testuser@example.com',
      name: 'Test User',
      constituencyOrigin: 'ConstituencyX',
      countyOrigin: 'CountyY',
      constituencyLive: 'ConstituencyX',
      countyLive: 'CountyY',
      industry: 'Education',
      goodsServices: ['Teaching', 'Eggs']
    };

    const res = await request(app).post('/api/users').send(newUser);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      walletAddress: newUser.walletAddress,
      email: newUser.email,
      name: newUser.name
    });
    expect(res.body).toHaveProperty('id');
  });

  // Further tests can include invalid data, update, get profile, etc.
});
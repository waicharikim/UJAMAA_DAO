import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/prismaClient.js';
import { createTestUser } from './testHelpers.js';
import logger from '../src/utils/logger.js';

describe('Token Balance API', () => {
  let testUser: { jwtToken: string; id: string };

  beforeAll(async () => {
    logger.info('Cleaning db before Token Balance tests');
    await prisma.groupMember.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.user.deleteMany({});

    testUser = await createTestUser('tokenuser@test.com', 'Token User');
    logger.info('Test user created for Token Balance tests', { userId: testUser.id });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should update token balance for a user', async () => {
    const data = {
      holderType: 'USER',
      holderId: testUser.id,
      amount: 50,
    };

    const res = await request(app)
      .post('/api/token-balance')
      .set('Authorization', testUser.jwtToken)
      .send(data);

    logger.info('Update token balance response', { status: res.status, body: res.body });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance', 50);
  });

  it('should reject token balance update with invalid data', async () => {
    const invalidData = {
      holderType: 'INVALID_TYPE',
      holderId: 'bad-id',
      amount: 'not-a-number',
    };

    const res = await request(app)
      .post('/api/token-balance')
      .set('Authorization', testUser.jwtToken)
      .send(invalidData);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('should retrieve token balance for a user', async () => {
    const res = await request(app)
      .get('/api/token-balance')
      .set('Authorization', testUser.jwtToken)
      .query({
        holderType: 'USER',
        holderId: testUser.id,
      });

    logger.info('Get token balance response', { status: res.status, body: res.body });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
    expect(typeof res.body.balance).toBe('number');
  });
});
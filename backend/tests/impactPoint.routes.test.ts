import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/prismaClient.js';
import { createTestUser } from './testHelpers';
import logger from '../src/utils/logger.js';

describe('Impact Points API', () => {
  let testUser: { jwtToken: string; id: string };

  beforeAll(async () => {
    logger.info('Cleaning db before Impact Points tests');
    await prisma.groupMember.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.user.deleteMany({});

    testUser = await createTestUser('impactuser@test.com', 'Impact User');
    logger.info('Test user created for Impact Points tests', { userId: testUser.id });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should add impact points for a user and return the updated record', async () => {
    const data = {
      holderType: 'USER',
      holderId: testUser.id,
      points: 10,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
    };

    const res = await request(app)
      .post('/api/impact-points')
      .set('Authorization', testUser.jwtToken)
      .send(data);

    logger.info('Add impact points request response', { status: res.status, body: res.body });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('points', 10);
    expect(res.body).toHaveProperty('holderType', 'USER');
  });

  it('should reject adding impact points with invalid data', async () => {
    const invalidData = {
      holderType: 'USER',
      holderId: 'invalid-uuid',
      points: 'not-a-number',
    };

    const res = await request(app)
      .post('/api/impact-points')
      .set('Authorization', testUser.jwtToken)
      .send(invalidData);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('should get impact points for a user', async () => {
    const res = await request(app)
      .get('/api/impact-points')
      .set('Authorization', testUser.jwtToken)
      .query({
        holderType: 'USER',
        holderId: testUser.id,
        locationScope: 'CONSTITUENCY',
      });

    logger.info('Get impact points response', { status: res.status, body: res.body });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('points');
    expect(typeof res.body.points).toBe('number');
  });
});
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/prismaClient.js';
import { createTestUser } from './testHelpers';

describe('User API with authentication', () => {
  let testUser: { jwtToken: string; id: string; email: string };

  beforeAll(async () => {
    console.log('Cleaning database before user tests...');
    await prisma.groupMember.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.user.deleteMany({});
    

    console.log('Creating test user...');
    testUser = await createTestUser(`user${Date.now()}@test.com`, `User Test ${Date.now()}`);
    console.log('Test user created with ID:', testUser.id);
  });

  afterAll(async () => {
    console.log('Disconnecting prisma client...');
    await prisma.$disconnect();
  });

  it('should get current user profile with valid token', async () => {
    console.log('Testing GET /api/users/me with valid token');
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', testUser.jwtToken);

    console.log('Response status:', res.status);
    console.log('Response body:', res.body);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testUser.email);
  });

  it('should update current user profile', async () => {
    const newName = 'Updated User Name';
    console.log('Testing PATCH /api/users/me to update name');

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', testUser.jwtToken)
      .send({ name: newName });

    console.log('Response status:', res.status);
    console.log('Response body:', res.body);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(newName);
  });

  it('should fail to access protected route without token', async () => {
    console.log('Testing GET /api/users/me without token');
    const res = await request(app).get('/api/users/me');

    console.log('Response status:', res.status);
    expect(res.status).toBe(401);
  });
});
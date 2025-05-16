import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/prismaClient.js';
import { createTestUser } from './testHelpers';

describe('Group API with authentication', () => {
  let testUser: { jwtToken: string; id: string; walletAddress: string };
  let createdGroupId: string;

  beforeAll(async () => {
    console.log('Cleaning database before group tests...');
    await prisma.groupMember.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('Creating test user for group tests...');
    testUser = await createTestUser(
      `groupuser${Date.now()}@test.com`,
      `Group User ${Date.now()}`,
      'TestConstituency',
      'TestCounty',
      'TestConstituency',
      'TestCounty'
    );
    console.log('Test user created with ID:', testUser.id);
  });

  afterAll(async () => {
    console.log('Disconnecting prisma client after group tests...');
    await prisma.$disconnect();
  });

  it('should create a new group', async () => {
    const groupName = `Test Group ${Date.now()}`;
    console.log('Creating group:', groupName);

    const newGroup = {
      name: groupName,
      walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
      constituency: 'TestConstituency',
      county: 'TestCounty',
      industryFocus: 'Test Industry',
      productsServices: ['ServiceA', 'ProductB'],
    };

    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', testUser.jwtToken)
      .send(newGroup);

    console.log('Response status:', res.status);
    console.log('Response body:', res.body);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(groupName);
    createdGroupId = res.body.id;
  });

  it('should invite a user to the group', async () => {
    console.log(`Inviting user ${testUser.id} to group ${createdGroupId}`);

    const res = await request(app)
      .post(`/api/groups/${createdGroupId}/invite`)
      .set('Authorization', testUser.jwtToken)
      .send({ userId: testUser.id });

    console.log('Invite response status:', res.status);
    console.log('Invite response body:', res.body);

    expect([201, 400]).toContain(res.status);
  });
});
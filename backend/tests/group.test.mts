/**
 * Integration tests for Group Management API.
 * 
 * Covers group creation, user joining,
 * uniqueness constraints, fetching group info with correct member counts.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';  // Prisma client instance
import GroupRole from '../src/prismaClient';  // Default export for GroupRole
import groupRoutes from '../src/routes/group';         // Route handler (ESM with .js in source imports)

const app = express();
app.use(express.json());
app.use('/api/groups', groupRoutes);

beforeAll(async () => {
  // Clear all relevant DB tables before starting test suite
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Disconnect from database
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean DB tables before each test for isolation
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

describe('Group Management API', () => {
  it('should return 400 when required fields are missing during group creation', async () => {
    const res = await request(app).post('/api/groups/create').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should create a group successfully with unique data', async () => {
    const uniqueSuffix = Date.now();
    const groupData = {
      name: `Test Group ${uniqueSuffix}`,
      walletAddress: `0xwallet${uniqueSuffix}`,
      constituency: 'Nairobi West',
      county: 'Nairobi',
      industryFocus: 'Technology',
      productsServices: ['Software', 'Education'],
    };

    const res = await request(app).post('/api/groups/create').send(groupData);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.groupId).toBeDefined();
  });

  it('should not allow creating duplicate groups (by wallet or name)', async () => {
    const uniqueSuffix = Date.now();
    const groupData = {
      name: `Unique Group ${uniqueSuffix}`,
      walletAddress: `0xwallet${uniqueSuffix}`,
      constituency: 'Nairobi West',
      county: 'Nairobi',
      industryFocus: 'Technology',
      productsServices: ['Software'],
    };

    // First creation should succeed
    const firstRes = await request(app).post('/api/groups/create').send(groupData);
    expect(firstRes.status).toBe(201);

    // Duplicate by wallet address should fail
    const dupWalletRes = await request(app)
      .post('/api/groups/create')
      .send({ ...groupData, name: `Another Name ${uniqueSuffix}` });
    expect(dupWalletRes.status).toBe(409);
    expect(dupWalletRes.body.success).toBe(false);

    // Duplicate by name should fail
    const dupNameRes = await request(app)
      .post('/api/groups/create')
      .send({ ...groupData, walletAddress: `0xwallet${uniqueSuffix}x` });
    expect(dupNameRes.status).toBe(409);
    expect(dupNameRes.body.success).toBe(false);
  });

  it('should add a user to a group successfully', async () => {
    const uniqueSuffix = Date.now();

    // Create a user first to be added to group
    const user = await prisma.user.create({
      data: {
        walletAddress: `0xuser${uniqueSuffix}`,
        email: `user${uniqueSuffix}@example.com`,
        name: 'User Test',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      }
    });

    // Create a group to join
    const group = await prisma.group.create({
      data: {
        name: `Joinable Group ${uniqueSuffix}`,
        walletAddress: `0xgroup${uniqueSuffix}`,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Technology',
        productsServices: [],
      }
    });

    // Add user to group
    const res = await request(app).post('/api/groups/join').send({
      groupId: group.id,
      userId: user.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when trying to add user to a non-existent group', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: `0xuser${Date.now()}`,
        email: `usertest@example.com`,
        name: 'User Test',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      }
    });

    const res = await request(app).post('/api/groups/join').send({
      groupId: 'non-existent-id',
      userId: user.id,
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when trying to add a non-existent user to a group', async () => {
    const group = await prisma.group.create({
      data: {
        name: `TestGroup${Date.now()}`,
        walletAddress: `0xgroup${Date.now()}`,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Technology',
        productsServices: [],
      }
    });

    const res = await request(app).post('/api/groups/join').send({
      groupId: group.id,
      userId: 'non-existent-user-id',
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should fetch group details including member count', async () => {
    const group = await prisma.group.create({
      data: {
        name: `MemberGroup${Date.now()}`,
        walletAddress: `0xgroup${Date.now()}`,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Technology',
        productsServices: [],
      }
    });

    // Create members to add to the group
    const user1 = await prisma.user.create({
      data: {
        walletAddress: `0xuser1${Date.now()}`,
        email: `user1${Date.now()}@example.com`,
        name: 'User One',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      }
    });

    const user2 = await prisma.user.create({
      data: {
        walletAddress: `0xuser2${Date.now()}`,
        email: `user2${Date.now()}@example.com`,
        name: 'User Two',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      }
    });

    // Add members to the group
    await prisma.groupMember.createMany({
      data: [
        { userId: user1.id, groupId: group.id, role: GroupRole.MEMBER },
        { userId: user2.id, groupId: group.id, role: GroupRole.MEMBER },
      ]
    });

    const res = await request(app).get(`/api/groups/${group.id}`);

    expect(res.status).toBe(200);
    expect(res.body.groupId).toBe(group.id);
    expect(res.body.memberCount).toBe(2);
  });

  it('should return 404 when fetching non-existent group', async () => {
    const res = await request(app).get('/api/groups/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
/**
 * Integration tests for Group API routes.
 *
 * These tests check the behavior of group creation, user joining, and group retrieval
 * with real database operations via Prisma.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import groupRoutes from '../src/routes/group';

const app = express();
app.use(express.json());
app.use('/api/groups', groupRoutes);

beforeAll(async () => {
  // Start fresh by clearing groups and memberships
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
});

afterAll(async () => {
  // Disconnect Prisma client when done
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up before each test to maintain isolation
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
});

describe('Group API', () => {
  it('should fail to create a group if required fields are missing', async () => {
    const res = await request(app).post('/api/groups/create').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('should create a group successfully with valid data', async () => {
    const groupData = {
      name: 'Test Group',
      walletAddress: '0x1234567890abcdef',
      constituency: 'Nairobi West',
      county: 'Nairobi',
      industryFocus: 'Technology',
      productsServices: ['Software', 'Education'],
    };
    const res = await request(app).post('/api/groups/create').send(groupData);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.groupId).toBe('string');
  });

  it('should not allow creating groups with duplicate wallet addresses or names', async () => {
    const groupData = {
      name: 'Duplicate Group',
      walletAddress: '0xabcdefabcdef',
      constituency: 'Nairobi West',
      county: 'Nairobi',
      industryFocus: 'Agriculture',
      productsServices: ['Farming'],
    };
    await request(app).post('/api/groups/create').send(groupData);

    // Try creating again with same wallet
    const res1 = await request(app).post('/api/groups/create').send({
      ...groupData,
      name: 'Another Name',
    });
    expect(res1.status).toBe(409);
    expect(res1.body.success).toBe(false);

    // Try creating again with same name
    const res2 = await request(app).post('/api/groups/create').send({
      ...groupData,
      walletAddress: '0xuniqueaddress',
    });
    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
  });

  it('should add a user to a group via join endpoint', async () => {
    // First, create user and group
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xuserwallet123',
        email: 'user@example.com',
        name: 'User One',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });
    const group = await prisma.group.create({
      data: {
        name: 'Joinable Group',
        walletAddress: '0xgroupwallet123',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Tech',
      },
    });

    const res = await request(app).post('/api/groups/join').send({
      groupId: group.id,
      userId: user.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/added to group/i);
  });

  it('should not add a user to a non-existent group', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xsomeuser',
        email: 'someuser@example.com',
        name: 'Some User',
        constituency: 'Nairobi East',
        county: 'Nairobi',
      },
    });

    const res = await request(app).post('/api/groups/join').send({
      groupId: 'non-existent-group-id',
      userId: user.id,
    });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/group not found/i);
  });

  it('should not add a non-existent user to a group', async () => {
    const group = await prisma.group.create({
      data: {
        name: 'Another Group',
        walletAddress: '0xgroupwallet456',
        constituency: 'Nairobi East',
        county: 'Nairobi',
        industryFocus: 'Tech',
      },
    });

    const res = await request(app).post('/api/groups/join').send({
      groupId: group.id,
      userId: 'non-existent-user-id',
    });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/user not found/i);
  });

  it('should return group details with member count', async () => {
    // Create group
    const group = await prisma.group.create({
      data: {
        name: 'Detail Group',
        walletAddress: '0xdetailwallet',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Tech',
      },
    });

    // Create member users and add to group
    const user1 = await prisma.user.create({
      data: {
        walletAddress: '0xuser1',
        email: 'user1@example.com',
        name: 'User One',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });
    const user2 = await prisma.user.create({
      data: {
        walletAddress: '0xuser2',
        email: 'user2@example.com',
        name: 'User Two',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });
    await prisma.groupMember.createMany({
      data: [
        { userId: user1.id, groupId: group.id, role: 'MEMBER' },
        { userId: user2.id, groupId: group.id, role: 'MEMBER' },
      ],
    });

    const res = await request(app).get(`/api/groups/${group.id}`);
    expect(res.status).toBe(200);
    expect(res.body.groupId).toBe(group.id);
    expect(res.body.memberCount).toBe(2);
  });

  it('should return 404 for non-existent group', async () => {
    const res = await request(app).get('/api/groups/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });
});
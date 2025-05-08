/**
 * Integration tests for User Registration API.
 *
 * Tests user registration covers validation, successful creation,
 * and duplicate user detection with real database interaction.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import userRoutes from '../src/routes/user.js';

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

beforeAll(async () => {
  // Clear user data before all tests
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Disconnect Prisma client
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clear user data before each test to isolate side effects
  await prisma.user.deleteMany();
});

describe('User Registration API', () => {
  it('should return 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/users/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should create a new user with unique data', async () => {
    // Use unique data to avoid collisions
    const unique = Date.now();
    const newUser = {
      walletAddress: `0x${unique}abcdef1234567890`,
      email: `test${unique}@example.com`,
      name: 'Test User',
      constituency: 'Nairobi West',
      county: 'Nairobi',
      industry: 'Technology',
      goodsServices: ['Consulting'],
    };

    const res = await request(app).post('/api/users/register').send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.userId).toBeDefined();

    // Verify user exists in DB
    const userInDb = await prisma.user.findUnique({ where: { id: res.body.userId } });
    expect(userInDb).not.toBeNull();
    expect(userInDb?.email).toBe(newUser.email);
  });

  it('should reject user creation with duplicate wallet address', async () => {
    const unique = Date.now();
    const userData = {
      walletAddress: `0x${unique}abcdef1234567890`,
      email: `unique${unique}@example.com`,
      name: 'Existing User',
      constituency: 'Nairobi West',
      county: 'Nairobi',
    };
    // Create user first time
    await prisma.user.create({ data: userData });

    // Attempt to create with same wallet, different email
    const res = await request(app).post('/api/users/register').send({
      ...userData,
      email: `new${unique}@example.com`,
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject user creation with duplicate email address', async () => {
    const unique = Date.now();
    const userData = {
      walletAddress: `0x${unique}abcdef1234567890`,
      email: `duplicate${unique}@example.com`,
      name: 'Existing User',
      constituency: 'Nairobi West',
      county: 'Nairobi',
    };
    // Create user first time
    await prisma.user.create({ data: userData });

    // Attempt to create with same email, different wallet
    const res = await request(app).post('/api/users/register').send({
      ...userData,
      walletAddress: `0xdeadbeef${unique}`,
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});
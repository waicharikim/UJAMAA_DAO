import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import userRoutes from '../src/routes/user.js';

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

beforeAll(async () => {
  // Setup if needed
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.user.deleteMany();
});

describe('User Registration API', () => {
  it('should fail validation on missing fields', async () => {
    const response = await request(app).post('/api/users/register').send({});
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should register a new user', async () => {
    const newUser = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      email: 'test@example.com',
      name: 'Tester',
      constituency: 'Nairobi West',
      county: 'Nairobi'
    };

    const response = await request(app).post('/api/users/register').send(newUser);
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.userId).toBeDefined();
  });
});
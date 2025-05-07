/**
 * Unit and Integration tests for User Registration API endpoint.
 */

import request from 'supertest';
import express, { Express } from 'express';
import userRoutes from '../src/routes/user';

// Setup an Express app instance for testing with JSON middleware
const app: Express = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('POST /api/users/register', () => {

  it('should return 400 Bad Request on missing required fields', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send({}); // empty request body

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/Missing required fields/);
  });

  it('should return 201 Created on valid input', async () => {
    const validUserData = {
      walletAddress: '0x123abc456def7890abcdef1234567890abcdef12',
      email: 'test@example.com',
      name: 'Test User',
      constituency: 'Nairobi West',
      county: 'Nairobi',
      industry: 'Technology',
      goodsServices: ['Software Development'],
    };

    const response = await request(app)
      .post('/api/users/register')
      .send(validUserData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.userId).toBe('string');
  });

});
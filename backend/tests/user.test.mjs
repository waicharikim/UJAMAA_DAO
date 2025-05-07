/**
 * Integration tests for User Registration API.
 *
 * These tests interact with the real database via Prisma to ensure full coverage of business logic,
 * including validation, duplicate detection, and database persistence.
 */
import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient'; // Ensure import path and .js extension for ESM compatibility
import userRoutes from '../src/routes/user';
const app = express();
// Middleware to parse JSON bodies
app.use(express.json());
// Mount the user routes at /api/users
app.use('/api/users', userRoutes);
beforeAll(async () => {
    // Optional setup before all tests run (e.g., database connection)
});
afterAll(async () => {
    // Close Prisma client connection after all tests to prevent open handles
    await prisma.$disconnect();
});
beforeEach(async () => {
    // Clean up User table before each test to ensure isolation and idempotency
    await prisma.user.deleteMany();
});
describe('POST /api/users/register', () => {
    it('should return 400 if required fields are missing in the request', async () => {
        const response = await request(app).post('/api/users/register').send({});
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Missing required fields');
    });
    it('should successfully create a new user when provided valid data', async () => {
        const newUser = {
            walletAddress: '0x123abc456def7890abcdef1234567890abcdef12',
            email: 'test@example.com',
            name: 'Test User',
            constituency: 'Nairobi West',
            county: 'Nairobi',
            industry: 'Technology',
            goodsServices: ['Web Development'],
        };
        const response = await request(app).post('/api/users/register').send(newUser);
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(typeof response.body.userId).toBe('string');
        // Verify the user was saved in the database
        const userInDb = await prisma.user.findUnique({ where: { id: response.body.userId } });
        expect(userInDb).not.toBeNull();
        expect(userInDb?.email).toBe(newUser.email);
    });
    it('should return 409 conflict when attempting to register with an existing wallet address', async () => {
        const existingUser = {
            walletAddress: '0x123abc456def7890abcdef1234567890abcdef12',
            email: 'existing@example.com',
            name: 'Existing User',
            constituency: 'Nairobi West',
            county: 'Nairobi',
        };
        // Seed existing user
        await prisma.user.create({ data: existingUser });
        // Attempt to register new user with same wallet but different email
        const response = await request(app).post('/api/users/register').send({
            walletAddress: existingUser.walletAddress,
            email: 'newemail@example.com',
            name: 'New User',
            constituency: 'Nairobi West',
            county: 'Nairobi',
        });
        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('already exists');
    });
    it('should return 409 conflict when attempting to register with an existing email', async () => {
        const existingUser = {
            walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
            email: 'test@example.com',
            name: 'Existing User',
            constituency: 'Nairobi West',
            county: 'Nairobi',
        };
        // Seed existing user
        await prisma.user.create({ data: existingUser });
        // Attempt to register new user with same email but different wallet
        const response = await request(app).post('/api/users/register').send({
            walletAddress: '0x9999999999999999999999999999999999999999',
            email: existingUser.email,
            name: 'New User',
            constituency: 'Nairobi West',
            county: 'Nairobi',
        });
        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('already exists');
    });
});
//# sourceMappingURL=user.test.mjs.map
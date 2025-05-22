/**
 * @file user.service.test.ts
 *
 * @description
 * Unit tests for user.service.ts.
 * Utilizes partial database cleanup and single reference data seeding.
 * Tests user creation, updating with audit logging, and duplicate prevention.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import * as userService from '../../src/services/user.service.js';
import * as userAuditService from '../../src/services/userAudit.service.js';
import prisma from '../../src/prismaClient.js';
import { seedAll } from '../../prisma/seedAll';

// Mock audit logging
vi.mock('../../src/services/userAudit.service.js', () => ({
  logUserAudit: vi.fn().mockResolvedValue(undefined),
}));



// Reference data IDs (adjust these as per your seed data)
const seededCountyLive = '7378d182-26c6-45c1-864e-dee1ed8a3ffd';
const seededConstituencyLive = '524de848-f940-406d-894d-df8c6bee6fa8';
const seededCountyOrigin = '80ed8e1d-db92-409b-b004-2c3099ef094d';
const seededConstituencyOrigin = 'c12317c3-cb0a-4a3b-ba8c-2f288b012858';
const seededIndustryId = '20e7b855-4de8-46b3-8000-c01c8f28ac0c';
const seededGoodsServices = [
  '0168c1b6-8957-4fc7-b25f-0d2ea8bba623',
  '7ebfa3cf-5459-454a-9765-67a44f7f85f9',
];

describe('User Service Unit Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await seedAll(); // Seed reference data only once
  });

  beforeEach(async () => {
    // Clean only user-related tables before each test
    await prisma.$transaction([
      prisma.groupMember.deleteMany(),
      prisma.userRole.deleteMany(),
      prisma.userAudit.deleteMany(),
      prisma.userConsent.deleteMany(),
      prisma.userActivityLog.deleteMany(),
      prisma.userPrivacySettings.deleteMany(),
      prisma.notificationPreference.deleteMany(),
      prisma.tokenBalance.deleteMany(),
      prisma.projectParticipant.deleteMany(),
      prisma.groupMemberVote.deleteMany(),
      prisma.vote.deleteMany(),
      prisma.proposal.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a new user successfully', async () => {
    const input = {
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      email: `testuser_${Date.now()}@example.com`,
      name: 'Test User',
      phoneNumber: '0712345678',
      constituencyOrigin: seededConstituencyOrigin,
      countyOrigin: seededCountyOrigin,
      constituencyLive: seededConstituencyLive,
      countyLive: seededCountyLive,
      industryId: seededIndustryId,
      goodsServices: seededGoodsServices,
      avatarUrl: 'https://example.com/avatar.png',
    };

    const user = await userService.createUser(input);

    expect(user).toHaveProperty('id');
    expect(user.walletAddress).toBe(input.walletAddress.toLowerCase());
    expect(user.email).toBe(input.email);
  });

  it('should fetch user by ID and apply privacy filter', async () => {
    // First create a user to fetch
    const input = {
      walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      email: `testuser2_${Date.now()}@example.com`,
      name: 'Second Test User',
      phoneNumber: '0712345679',
      constituencyOrigin: seededConstituencyOrigin,
      countyOrigin: seededCountyOrigin,
      constituencyLive: seededConstituencyLive,
      countyLive: seededCountyLive,
      industryId: seededIndustryId,
      goodsServices: seededGoodsServices,
      avatarUrl: 'https://example.com/avatar2.png',
    };
    const newUser = await userService.createUser(input);

    const user = await userService.getUserById(newUser.id, ['system:general_user']);

    expect(user).toHaveProperty('id', newUser.id);
    expect(user).toHaveProperty('name');
  });

  it('should update user and log audits for changed fields', async () => {
    // Create user first
    const input = {
      walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      email: `testuser3_${Date.now()}@example.com`,
      name: 'Third Test User',
      phoneNumber: '0712345680',
      constituencyOrigin: seededConstituencyOrigin,
      countyOrigin: seededCountyOrigin,
      constituencyLive: seededConstituencyLive,
      countyLive: seededCountyLive,
      industryId: seededIndustryId,
      goodsServices: seededGoodsServices,
      avatarUrl: 'https://example.com/avatar3.png',
    };
    const newUser = await userService.createUser(input);

    const updatedPhone = '0700000001';
    const updateData = { phoneNumber: updatedPhone };

    const updatedUser = await userService.updateUser(newUser.id, updateData, newUser.id);

    expect(updatedUser).toHaveProperty('phoneNumber', updatedPhone);
    expect(userAuditService.logUserAudit).toHaveBeenCalled();
  });

  it('should reject creating user with duplicate email or wallet', async () => {
    const input = {
      walletAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
      email: `testuser4_${Date.now()}@example.com`,
      name: 'Duplicate User',
      constituencyOrigin: seededConstituencyOrigin,
      countyOrigin: seededCountyOrigin,
      constituencyLive: seededConstituencyLive,
      countyLive: seededCountyLive,
    };

    // Create user first time - success
    await userService.createUser(input);

    // Second creation should throw an error
    await expect(userService.createUser(input)).rejects.toThrow(/already exists/);
  });
});
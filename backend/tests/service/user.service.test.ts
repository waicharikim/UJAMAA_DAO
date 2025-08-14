/**
 * @file user.service.test.ts
 *
 * @description
 * Integration-style tests for user.service.ts using seeded master data IDs.
 * - Calls seedAll() and derives IDs dynamically from the returned mapping.
 * - Cleans user-related tables between tests.
 * - Verifies creation, update, duplicate prevention, and transactional audit logging.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as userService from '../../src/services/user.service.js';
import prisma from '../../src/prismaClient.js';
import { seedAll } from '../../prisma/seedAll.js';
import { createUserSchema } from '../../src/validation/user.validation.js';

let seeded; // will hold the ids mapping returned by seedAll()

beforeAll(async () => {
  await prisma.$connect();
  const result = await seedAll();
  seeded = result.ids;
});

beforeEach(async () => {
  // Clean user-related tables before each test
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

describe('User Service Integration Tests (with seeded IDs)', () => {
  function pickFirstCountyAndConstituency() {
    const countyNames = Object.keys(seeded.counties);
    if (countyNames.length === 0) throw new Error('No seeded counties found');
    const countyName = countyNames[0];
    const countyObj = seeded.counties[countyName];
    const constituencyNames = Object.keys(countyObj.constituencies);
    if (constituencyNames.length === 0) throw new Error('No constituencies seeded for county ' + countyName);
    const constituencyName = constituencyNames[0];
    return {
      countyId: countyObj.id,
      constituencyId: countyObj.constituencies[constituencyName],
    };
  }

  function pickIndustryAndGoods() {
    const industryIds = Object.values(seeded.industries);
    if (industryIds.length === 0) throw new Error('No seeded industries found');
    const industryId = industryIds[0];

    const goodsValues = Object.values(seeded.goodsServices || {});
    if (goodsValues.length < 1) throw new Error('No seeded goodsServices found');
    const goodsServiceIds = goodsValues.slice(0, 2);
    return { industryId, goodsServiceIds };
  }

  it('should create a new user successfully and write a creation audit', async () => {
    const { countyId, constituencyId } = pickFirstCountyAndConstituency();
    const { industryId, goodsServiceIds } = pickIndustryAndGoods();

    const input = {
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      email: `testuser_${Date.now()}@example.com`,
      name: 'Test User',
      phoneNumber: '0712345678',
      constituencyOrigin: constituencyId,
      countyOrigin: countyId,
      constituencyLive: constituencyId,
      countyLive: countyId,
      industryId,
      goodsServices: goodsServiceIds,
      avatarUrl: 'https://example.com/avatar.png',
    };

    // Apply validation transforms (normalization) as controllers would
    const validated = createUserSchema.parse(input);

    const user = await userService.createUser(validated);

    expect(user).toHaveProperty('id');
    expect(user.walletAddress).toBe(input.walletAddress.toLowerCase());
    expect(user.email).toBe(input.email);

    // Assert creation audit row exists (transactional)
    const audits = await prisma.userAudit.findMany({ where: { userId: user.id } });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.some(a => a.field === 'created')).toBeTruthy();
  });

  it('should fetch user by ID and return raw user (service) that includes name', async () => {
    const { countyId, constituencyId } = pickFirstCountyAndConstituency();
    const { industryId, goodsServiceIds } = pickIndustryAndGoods();

    const input = {
      walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      email: `testuser2_${Date.now()}@example.com`,
      name: 'Second Test User',
      phoneNumber: '0712345679',
      constituencyOrigin: constituencyId,
      countyOrigin: countyId,
      constituencyLive: constituencyId,
      countyLive: countyId,
      industryId,
      goodsServices: goodsServiceIds,
      avatarUrl: 'https://example.com/avatar2.png',
    };

    const validated = createUserSchema.parse(input);
    const newUser = await userService.createUser(validated);

    const user = await userService.getUserById(newUser.id);

    expect(user).toHaveProperty('id', newUser.id);
    expect(user).toHaveProperty('name', input.name);
  });

  it('should update user and create audit rows for changed fields', async () => {
    const { countyId, constituencyId } = pickFirstCountyAndConstituency();
    const { industryId, goodsServiceIds } = pickIndustryAndGoods();

    const input = {
      walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      email: `testuser3_${Date.now()}@example.com`,
      name: 'Third Test User',
      phoneNumber: '0712345680',
      constituencyOrigin: constituencyId,
      countyOrigin: countyId,
      constituencyLive: constituencyId,
      countyLive: countyId,
      industryId,
      goodsServices: goodsServiceIds,
      avatarUrl: 'https://example.com/avatar3.png',
    };

    const validated = createUserSchema.parse(input);
    const newUser = await userService.createUser(validated);

    const updatedPhone = '0700000001';
    const updateData = { phoneNumber: updatedPhone };

    const updatedUser = await userService.updateUser(newUser.id, updateData, newUser.id);

    expect(updatedUser).toHaveProperty('phoneNumber', updatedPhone);

    // Verify audit row was created for phoneNumber field
    const audits = await prisma.userAudit.findMany({ where: { userId: newUser.id } });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.some(a => a.field === 'phoneNumber')).toBeTruthy();
  });

  it('should reject creating user with duplicate email or wallet', async () => {
    const { countyId, constituencyId } = pickFirstCountyAndConstituency();
    const { industryId, goodsServiceIds } = pickIndustryAndGoods();

    const input = {
      walletAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
      email: `testuser4_${Date.now()}@example.com`,
      name: 'Duplicate User',
      constituencyOrigin: constituencyId,
      countyOrigin: countyId,
      constituencyLive: constituencyId,
      countyLive: countyId,
      industryId,
      goodsServices: goodsServiceIds,
    };

    const validated = createUserSchema.parse(input);

    // Create user first time - success
    await userService.createUser(validated);

    // Second creation should throw an error
    await expect(userService.createUser(validated)).rejects.toThrow(/already exists/);
  });
});
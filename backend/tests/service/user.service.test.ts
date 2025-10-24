/**
 * @file user.service.test.ts
 * @description Integration tests for user.service.ts - REAL DB SEED
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as userService from '../../src/services/user.service.js';
import prisma from '../../src/prismaClient.js';
import { createUserSchema } from '../../src/validation/user.validation.js';
import { seeded } from '../testSetup.js';

describe('User Service Integration Tests (REAL DB)', () => {
  beforeEach(async () => {
    await prisma.$transaction([
      prisma.user.deleteMany(),
      prisma.userRole.deleteMany(),
      prisma.impactPoint.deleteMany(),
      prisma.userHolding.deleteMany(),
    ]);
    console.log('Database cleared for user service test');
  });

  function pickOriginLiveDifferent() {
    return {
      origin: { 
        countyId: seeded.holdings.nairobiCounty, // UUID
        constituencyId: seeded.holdings.kibraConst, // UUID
        wardId: seeded.holdings.kibraWard // UUID
      },
      live: { 
        countyId: seeded.holdings.nakuruCounty, // UUID
        constituencyId: seeded.holdings.nakuruTownConst, // UUID
        wardId: seeded.holdings.nakuruTownWestWard // UUID
      },
    };
  }

  it('should create user with different origin/live locations (50 points)', async () => {
    const { origin, live } = pickOriginLiveDifferent();

    const input = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      email: `test_${Date.now()}@ujamaa.co.ke`,
      name: 'Test User',
      phoneNumber: '0712345678',
      countyCode: seeded.holdings.nairobiCounty,
      constituencyName: 'Kibra',
      wardName: 'Kibra Ward',
      countyLiveCode: seeded.holdings.nakuruCounty,
      constituencyLiveName: 'Nakuru Town',
      wardLiveName: 'Nakuru Town West Ward',
    };

    const validated = createUserSchema.parse(input);
    const user = await userService.createUser(validated);

    expect(user).toHaveProperty('id');
    expect(user.impactPoints).toBe(50);

    const roles = await prisma.userRole.findMany({ where: { userId: user.id } });
    expect(roles.length).toBe(5);

    const holdings = await prisma.userHolding.findMany({ where: { userId: user.id } });
    expect(holdings.length).toBe(3);
  });

  it('should create national-only user (25 points)', async () => {
    const input = {
      walletAddress: '0x234567890abcdef1234567890abcdef12345678',
      email: `national_${Date.now()}@ujamaa.co.ke`,
      name: 'National User',
    };

    const validated = createUserSchema.parse(input);
    const user = await userService.createUser(validated);

    expect(user.impactPoints).toBe(25);
    const roles = await prisma.userRole.findMany({ where: { userId: user.id } });
    expect(roles.length).toBe(2);
  });

  it('should reject duplicate email', async () => {
    const input = {
      walletAddress: '0x34567890abcdef1234567890abcdef12345678',
      email: `dup_${Date.now()}@ujamaa.co.ke`,
      name: 'Duplicate User',
      countyCode: seeded.holdings.nairobiCounty,
      constituencyName: 'Kibra',
      wardName: 'Kibra Ward',
    };

    const validated = createUserSchema.parse(input);
    await userService.createUser(validated);

    await expect(userService.createUser(validated)).rejects.toThrow('already exists');
  });

  it('should reject invalid ward', async () => {
    const input = {
      walletAddress: '0x4567890abcdef1234567890abcdef123456789',
      email: `invalid_${Date.now()}@ujamaa.co.ke`,
      name: 'Invalid Ward User',
      countyCode: '99',
      constituencyName: 'Fake',
      wardName: 'Fake Ward',
    };

    const validated = createUserSchema.parse(input);
    await expect(userService.createUser(validated)).rejects.toThrow('Invalid location');
  });
});
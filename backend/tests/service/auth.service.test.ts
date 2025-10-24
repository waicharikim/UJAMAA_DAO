/**
 * @file auth.service.test.ts
 * @description Unit tests for auth.service.ts - REAL DB SEED
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as authService from '../../src/services/auth.service.js';
import prisma from '../../src/prismaClient.js';
import { ApiError } from '../../src/utils/ApiError.js';
import { ethers, Wallet } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { seeded } from '../testSetup.js';

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      utils: {
        ...actual.ethers.utils,
        verifyMessage: vi.fn()
      }
    }
  };
});

describe('Auth Service Tests (REAL DB)', () => {
  beforeEach(async () => {
    await prisma.$transaction([
      prisma.user.deleteMany(),
      prisma.userRole.deleteMany(),
      prisma.impactPoint.deleteMany(),
    ]);
    console.log('Database cleared for test');
  });

  it('getNonce() - should generate fresh nonce for existing user', async () => {
    const userId = uuidv4().replace(/-/g, '');
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const user = await prisma.user.create({
      data: {
        id: userId,
        walletAddress,
        email: 'test@ujamaa.co.ke',
        name: 'Test User',
        countyOrigin: seeded.holdings.nairobiCounty,
        constituencyOrigin: seeded.holdings.kibraConst,
        countyLive: seeded.holdings.nakuruCounty,
        constituencyLive: seeded.holdings.nakuruTownConst,
        nonce: 'old-nonce',
      }
    });
    console.log('Created user with ID:', userId);

    const nonce = await authService.getNonce(user.walletAddress);

    expect(typeof nonce).toBe('string');
    expect(nonce).not.toBe('old-nonce');
    expect(nonce.length).toBe(32);

    const updatedUser = await prisma.user.findUnique({
      where: { walletAddress: user.walletAddress }
    });
    expect(updatedUser?.nonce).toBe(nonce);
  });

  it('getNonce() - should throw 400 if user not registered', async () => {
    await expect(
      authService.getNonce('0xnonexistent')
    ).rejects.toThrow('Please complete registration first');
  });

  it('verifySignature() - should return token for valid signature', async () => {
    const wallet = Wallet.createRandom();
    const userAddress = wallet.address;
    const nonce = 'test-nonce';
    const message = `Login nonce: ${nonce}`;
    const signature = await wallet.signMessage(message);

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: uuidv4().replace(/-/g, ''),
      walletAddress: userAddress,
      nonce,
      email: 'test@ujamaa.co.ke',
      name: 'Test User',
      countyOrigin: seeded.holdings.nairobiCounty,
      constituencyOrigin: seeded.holdings.kibraConst,
      countyLive: seeded.holdings.nakuruCounty,
      constituencyLive: seeded.holdings.nakuruTownConst
    });

    vi.spyOn(prisma.user, 'update').mockResolvedValue({});

    vi.mocked(ethers.utils.verifyMessage).mockRestore();

    const result = await authService.verifySignature(userAddress, signature);

    expect(result.token).toBeDefined();
    expect(result.user).toHaveProperty('email', 'test@ujamaa.co.ke');
    expect(result.user).not.toHaveProperty('nonce');
  });

  it('verifySignature() - should throw 401 for invalid signature', async () => {
    const wrongWallet = Wallet.createRandom();
    const userAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const nonce = 'test-nonce';
    const message = `Login nonce: ${nonce}`;
    const invalidSignature = await wrongWallet.signMessage(message);

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: uuidv4().replace(/-/g, ''),
      walletAddress: userAddress,
      nonce,
      countyOrigin: seeded.holdings.nairobiCounty,
      constituencyOrigin: seeded.holdings.kibraConst,
      countyLive: seeded.holdings.nakuruCounty,
      constituencyLive: seeded.holdings.nakuruTownConst
    });

    await expect(
      authService.verifySignature(userAddress, invalidSignature)
    ).rejects.toThrow('Signature does not match wallet address');
  });
});
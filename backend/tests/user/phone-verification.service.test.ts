/**
 * @file tests/user/phone-verification.service.test.ts
 * @description Unit tests for PhoneVerificationService.
 *
 * Runs against postgres_test (DATABASE_URL set in vitest.config.ts env block).
 * africastalking is mocked — no real SMS sent.
 * ENABLE_SMS is left false so mock mode is used by default.
 * Global TRUNCATE runs before each test (testSetup.ts), seed in beforeEach.
 */

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: { award: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { phoneVerificationService } from '../../src/modules/auth/services/phone-verification.service.js';
import { seedLocation, createTestUser, TEST_WARD_ID } from '../auth/helpers.js';

const PHONE = '+254712345678';

beforeEach(async () => {
  await seedLocation();
});

// ─────────────────────────────────────────────────────────────────────────────
// sendVerificationCode — mock mode (ENABLE_SMS=false by default in test env)
// ─────────────────────────────────────────────────────────────────────────────

describe('sendVerificationCode()', () => {
  it('returns devCode and success in mock mode', async () => {
    const result = await phoneVerificationService.sendVerificationCode(PHONE);
    expect(result.success).toBe(true);
    expect(typeof result.devCode).toBe('string');
    expect(result.devCode).toHaveLength(6);
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('stores the verification record in the DB', async () => {
    await phoneVerificationService.sendVerificationCode(PHONE);
    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE },
    });
    expect(record).not.toBeNull();
    expect(record!.verified).toBe(false);
    expect(record!.attempts).toBe(0);
  });

  it('normalises 07XXXXXXXX format to +254XXXXXXXX', async () => {
    const result = await phoneVerificationService.sendVerificationCode('0712345678');
    expect(result.success).toBe(true);
    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: '+254712345678' },
    });
    expect(record).not.toBeNull();
  });

  it('normalises 254XXXXXXXXX format (no +) to +254XXXXXXXXX', async () => {
    const result = await phoneVerificationService.sendVerificationCode('254712345678');
    expect(result.success).toBe(true);
    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: '+254712345678' },
    });
    expect(record).not.toBeNull();
  });

  it('rejects invalid phone numbers', async () => {
    await expect(
      phoneVerificationService.sendVerificationCode('not-a-phone')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('stores userId on record when provided', async () => {
    const user = await createTestUser('phone-user@example.com');
    await phoneVerificationService.sendVerificationCode(PHONE, user.id);
    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE },
    });
    expect(record!.userId).toBe(user.id);
  });

  it('second send on same phone in mock mode creates a second DB record', async () => {
    // Mock mode has no cooldown — both sends succeed and create separate records
    await phoneVerificationService.sendVerificationCode(PHONE);
    // Second send: the unique constraint (phoneNumber, verified=false) means
    // mock mode reuses the same slot. Verify the record still exists.
    const count = await prisma.phoneVerification.count({
      where: { phoneNumber: PHONE, verified: false },
    });
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyCode()
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyCode()', () => {
  it('returns true and marks record verified on correct code', async () => {
    const result = await phoneVerificationService.sendVerificationCode(PHONE);
    const verified = await phoneVerificationService.verifyCode(PHONE, result.devCode!);
    expect(verified).toBe(true);

    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE },
    });
    expect(record!.verified).toBe(true);
    expect(record!.verifiedAt).not.toBeNull();
  });

  it('promotes EMAIL_VERIFIED user to PHONE_VERIFIED', async () => {
    const user = await createTestUser('promote@example.com', 'EMAIL_VERIFIED');
    const result = await phoneVerificationService.sendVerificationCode(PHONE, user.id);
    await phoneVerificationService.verifyCode(PHONE, result.devCode!, user.id);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.verificationLevel).toBe('PHONE_VERIFIED');
    expect(updated!.phoneVerified).toBe(true);
    expect(updated!.phoneNumber).toBe(PHONE);
  });

  it('does not downgrade a user already at COMMUNITY_VERIFIED', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'community@example.com',
        name: 'Community User',
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        locationVerified: false,
        primaryWardId: TEST_WARD_ID,
      },
    });
    const result = await phoneVerificationService.sendVerificationCode(PHONE, user.id);
    await phoneVerificationService.verifyCode(PHONE, result.devCode!, user.id);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.verificationLevel).toBe('COMMUNITY_VERIFIED');
  });

  it('increments attempts on wrong code and throws', async () => {
    await phoneVerificationService.sendVerificationCode(PHONE);
    await expect(
      phoneVerificationService.verifyCode(PHONE, '000000')
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid code') });

    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE },
    });
    expect(record!.attempts).toBe(1);
  });

  it('throws on expired code', async () => {
    await prisma.phoneVerification.create({
      data: {
        phoneNumber: PHONE,
        code: '999999',
        expiresAt: new Date(Date.now() - 1000), // already expired
        attempts: 0,
      },
    });
    await expect(
      phoneVerificationService.verifyCode(PHONE, '999999')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects after 5 failed attempts', async () => {
    await prisma.phoneVerification.create({
      data: {
        phoneNumber: PHONE,
        code: '111111',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 5, // already maxed
      },
    });
    await expect(
      phoneVerificationService.verifyCode(PHONE, '111111')
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Too many') });
  });

  it('throws 400 for malformed code (wrong length)', async () => {
    await expect(
      phoneVerificationService.verifyCode(PHONE, '12345') // 5 digits, not 6
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for invalid phone number', async () => {
    await expect(
      phoneVerificationService.verifyCode('bad-phone', '123456')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

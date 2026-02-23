// tests/auth/phone-verification.test.ts
//
// ENABLE_SMS is set to 'true' via vi.hoisted so that the module-level SMS_CONFIG.enabled
// is true when the service is first imported. africastalking is mocked so no real SMS
// is sent. The cooldown check only fires when SMS is enabled.

const _env = vi.hoisted(() => {
  process.env.ENABLE_SMS = 'true';
  process.env.SMS_PROVIDER = 'africastalking';
  process.env.AT_API_KEY = 'test-api-key';
  process.env.AT_USERNAME = 'test-user';
});

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: {
      send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
  })),
}));

vi.mock('../../src/core/utils/eventBus.js', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { phoneVerificationService } from '../../src/modules/auth/services/phone-verification.service.js';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser } from './helpers.js';

const PHONE_1 = '+254711000001';
const PHONE_2 = '+254711000002';
const PHONE_3 = '+254711000003';
const PHONE_4 = '+254711000004';
const PHONE_5 = '+254711000005';
const PHONE_6 = '+254711000006';
const PHONE_7 = '+254711000007';

describe('PhoneVerificationService', () => {
  beforeEach(seedLocation);

  // ── 1. sendVerificationCode → creates row, returns expiresIn ─────────────
  it('creates a PhoneVerification row and returns expiresIn seconds', async () => {
    const result = await phoneVerificationService.sendVerificationCode(PHONE_1);

    expect(result.success).toBe(true);
    expect(typeof result.expiresIn).toBe('number');
    expect(result.expiresIn).toBeGreaterThan(0);

    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE_1 },
    });
    expect(record).toBeTruthy();
    expect(record!.code).toHaveLength(6);
    expect(record!.verified).toBe(false);
  });

  // ── 2. sendVerificationCode resend within cooldown → throws 429 ──────────
  it('throws 429 when resending within the cooldown window', async () => {
    // First send creates the cooldown record
    await phoneVerificationService.sendVerificationCode(PHONE_2);

    // Immediate resend should hit cooldown
    await expect(
      phoneVerificationService.sendVerificationCode(PHONE_2)
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  // ── 3. verifyCode (correct code) → true, marks verified=true ─────────────
  it('returns true and marks verified=true for a correct code', async () => {
    await phoneVerificationService.sendVerificationCode(PHONE_3);

    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE_3 },
    });
    const code = record!.code;

    const isValid = await phoneVerificationService.verifyCode(PHONE_3, code);
    expect(isValid).toBe(true);

    const updated = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE_3 },
    });
    expect(updated!.verified).toBe(true);
  });

  // ── 4. verifyCode (wrong code) → throws 400, increments attempts ──────────
  it('throws 400 for a wrong code and increments attempts counter', async () => {
    await phoneVerificationService.sendVerificationCode(PHONE_4);

    const before = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE_4 },
    });
    expect(before!.attempts).toBe(0);

    await expect(
      phoneVerificationService.verifyCode(PHONE_4, '000000')
    ).rejects.toMatchObject({ statusCode: 400 });

    const after = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE_4 },
    });
    expect(after!.attempts).toBe(1);
  });

  // ── 5. verifyCode (expired code) → throws 400 ────────────────────────────
  it('throws 400 for an expired verification code', async () => {
    // Insert an expired record directly in DB
    await prisma.phoneVerification.create({
      data: {
        phoneNumber: PHONE_5,
        code: '123456',
        expiresAt: new Date(Date.now() - 1000), // already expired
        attempts: 0,
      },
    });

    await expect(
      phoneVerificationService.verifyCode(PHONE_5, '123456')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── 6. verifyCode with userId → updates User.phoneVerified ───────────────
  it('updates user.phoneVerified when userId is provided and code is correct', async () => {
    const user = await createTestUser('phone-user@ujamaa.test');
    await phoneVerificationService.sendVerificationCode(PHONE_6, user.id);

    const record = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE_6 },
    });
    const code = record!.code;

    await phoneVerificationService.verifyCode(PHONE_6, code, user.id);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.phoneVerified).toBe(true);
  });

  // ── 7. cleanupExpiredCodes → deletes only expired rows ───────────────────
  it('deletes only expired PhoneVerification rows, leaves valid ones', async () => {
    // Expired record
    await prisma.phoneVerification.create({
      data: {
        phoneNumber: PHONE_7,
        code: '999999',
        expiresAt: new Date(Date.now() - 5000),
        attempts: 0,
      },
    });
    // Valid record (different phone to avoid unique constraint issue)
    const PHONE_7B = '+254711000008';
    await prisma.phoneVerification.create({
      data: {
        phoneNumber: PHONE_7B,
        code: '888888',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        attempts: 0,
      },
    });

    const deleted = await phoneVerificationService.cleanupExpiredCodes();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: PHONE_7B },
    });
    expect(remaining).toBeTruthy();
  });
});

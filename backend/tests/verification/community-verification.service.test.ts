/**
 * @file tests/verification/community-verification.service.test.ts
 * @description Service-level tests for the community verification flow.
 *
 * Tests call userService methods directly against the postgres_test DB.
 * DATABASE_URL is set by vitest.config.ts env block; global TRUNCATE fires
 * before each test (testSetup.ts). Seed in beforeEach.
 *
 * 17 tests covering:
 *   requestCommunityVerification  (4)
 *   vouchForUser                  (7)
 *   processVerificationPayment    (2)
 *   getVerificationStatus         (3)
 *   checkVouchingTimeouts         (1)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { userService } from '../../src/modules/user/services/user.service.js';

// Mock impact point awarding — not what these tests verify, and the $transaction
// it uses can leave PrismaPg connections in a stale state that causes subsequent
// count() queries to read from an old snapshot on the same connection.
vi.mock('../../src/modules/reputation/service/impactPoint.service.js', () => ({
  globalImpactPointService: {
    award: vi.fn().mockResolvedValue(undefined),
  },
}));
import {
  seedLocation,
  seedSecondWard,
  TEST_WARD_ID,
  TEST_WARD_ID_2,
  createPhoneVerifiedUser,
  createCommunityVerifiedVoucher,
  createFullyVerifiedVoucher,
  seedVouchingRequest,
  seedPaymentPendingRequest,
  seedVouch,
} from './helpers.js';

beforeEach(async () => {
  await seedLocation();
  await seedSecondWard();
});

// ══════════════════════════════════════════════════════════════════════════════
// requestCommunityVerification()
// ══════════════════════════════════════════════════════════════════════════════

describe('requestCommunityVerification()', () => {
  it('creates VOUCHING request for PHONE_VERIFIED user', async () => {
    const user = await createPhoneVerifiedUser('rcv-happy@test.com');

    const result = await userService.requestCommunityVerification(user.id);

    expect(result.status).toBe('VOUCHING');
    expect(result.vouchesNeeded).toBe(3);
    expect(result.requestId).toBeDefined();
    expect(result.expiresAt).toBeDefined();

    // expiresAt should be roughly 7 days from now (within 10 seconds margin)
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const diff = result.expiresAt!.getTime() - Date.now();
    expect(diff).toBeGreaterThan(sevenDays - 10_000);
    expect(diff).toBeLessThan(sevenDays + 10_000);

    // DB record exists
    const row = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId: user.id, type: 'COMMUNITY' } },
    });
    expect(row?.status).toBe('VOUCHING');
  });

  it('blocks EMAIL_VERIFIED user with 403', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'rcv-email@test.com',
        name: 'Email User',
        verificationLevel: 'EMAIL_VERIFIED',
        emailVerified: true,
        phoneVerified: false,
        communityVerified: false,
        locationVerified: false,
        primaryWardId: TEST_WARD_ID,
      },
    });

    await expect(userService.requestCommunityVerification(user.id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('blocks duplicate when VOUCHING request already exists', async () => {
    const user = await createPhoneVerifiedUser('rcv-dup-vouch@test.com');
    await seedVouchingRequest(user.id);

    await expect(userService.requestCommunityVerification(user.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('blocks duplicate when PAYMENT_PENDING request already exists', async () => {
    const user = await createPhoneVerifiedUser('rcv-dup-pay@test.com');
    await seedPaymentPendingRequest(user.id);

    await expect(userService.requestCommunityVerification(user.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// vouchForUser()
// ══════════════════════════════════════════════════════════════════════════════

describe('vouchForUser()', () => {
  it('first vouch succeeds and returns vouchCount:1 without completing verification', async () => {
    const target = await createPhoneVerifiedUser('vouch-target-1@test.com');
    const voucher = await createCommunityVerifiedVoucher('vouch-giver-1@test.com');
    await seedVouchingRequest(target.id);

    const result = await userService.vouchForUser(voucher.id, {
      targetUserId: target.id,
      wardId: TEST_WARD_ID,
    });

    expect(result.success).toBe(true);
    expect(result.vouchCount).toBe(1);
    expect(result.needed).toBe(3);

    // target should still be PHONE_VERIFIED
    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    expect(updated?.verificationLevel).toBe('PHONE_VERIFIED');
  });

  it('third vouch auto-completes verification to COMMUNITY_VERIFIED', async () => {
    const target = await createPhoneVerifiedUser('vouch-target-3@test.com');
    const voucher1 = await createCommunityVerifiedVoucher('vouch-giver-3a@test.com');
    const voucher2 = await createCommunityVerifiedVoucher('vouch-giver-3b@test.com');
    const voucher3 = await createCommunityVerifiedVoucher('vouch-giver-3c@test.com');
    await seedVouchingRequest(target.id);
    await seedVouch(target.id, voucher1.id, TEST_WARD_ID);
    await seedVouch(target.id, voucher2.id, TEST_WARD_ID);

    const result = await userService.vouchForUser(voucher3.id, {
      targetUserId: target.id,
      wardId: TEST_WARD_ID,
    });

    expect(result.success).toBe(true);
    expect(result.vouchCount).toBe(3);

    // DB: request APPROVED, target COMMUNITY_VERIFIED
    const row = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId: target.id, type: 'COMMUNITY' } },
    });
    expect(row?.status).toBe('APPROVED');

    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    expect(updated?.verificationLevel).toBe('COMMUNITY_VERIFIED');
    expect(updated?.communityVerified).toBe(true);
  });

  it('blocks PHONE_VERIFIED voucher with 403', async () => {
    const target = await createPhoneVerifiedUser('vouch-target-pv@test.com');
    const voucher = await createPhoneVerifiedUser('vouch-giver-pv@test.com');
    await seedVouchingRequest(target.id);

    await expect(
      userService.vouchForUser(voucher.id, {
        targetUserId: target.id,
        wardId: TEST_WARD_ID,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('blocks cross-ward vouch for COMMUNITY_VERIFIED voucher with 403', async () => {
    // target is in TEST_WARD_ID; voucher passes TEST_WARD_ID_2 in DTO → mismatch
    const target = await createPhoneVerifiedUser('vouch-target-cw@test.com', TEST_WARD_ID);
    const voucher = await createCommunityVerifiedVoucher('vouch-giver-cw@test.com', TEST_WARD_ID);
    await seedVouchingRequest(target.id);

    await expect(
      userService.vouchForUser(voucher.id, {
        targetUserId: target.id,
        wardId: TEST_WARD_ID_2, // mismatches target.primaryWardId
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('FULL_VERIFIED voucher can vouch across wards', async () => {
    // target in TEST_WARD_ID_2, voucher in TEST_WARD_ID — allowed for FULL_VERIFIED
    const target = await createPhoneVerifiedUser('vouch-target-fw@test.com', TEST_WARD_ID_2);
    const voucher = await createFullyVerifiedVoucher('vouch-giver-fw@test.com');
    await seedVouchingRequest(target.id);

    const result = await userService.vouchForUser(voucher.id, {
      targetUserId: target.id,
      wardId: TEST_WARD_ID_2,
    });

    expect(result.success).toBe(true);
    expect(result.vouchCount).toBe(1);
  });

  it('blocks duplicate vouch from same voucher with 409', async () => {
    const target = await createPhoneVerifiedUser('vouch-target-dup@test.com');
    const voucher = await createCommunityVerifiedVoucher('vouch-giver-dup@test.com');
    await seedVouchingRequest(target.id);
    await seedVouch(target.id, voucher.id, TEST_WARD_ID);

    await expect(
      userService.vouchForUser(voucher.id, {
        targetUserId: target.id,
        wardId: TEST_WARD_ID,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('blocks vouch when no active request exists for target', async () => {
    const target = await createPhoneVerifiedUser('vouch-target-noreq@test.com');
    const voucher = await createCommunityVerifiedVoucher('vouch-giver-noreq@test.com');
    // No verification request seeded for target

    await expect(
      userService.vouchForUser(voucher.id, {
        targetUserId: target.id,
        wardId: TEST_WARD_ID,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// processVerificationPayment()
// ══════════════════════════════════════════════════════════════════════════════

describe('processVerificationPayment()', () => {
  it('succeeds for PAYMENT_PENDING request and promotes user to COMMUNITY_VERIFIED', async () => {
    const user = await createPhoneVerifiedUser('pay-happy@test.com');
    await seedPaymentPendingRequest(user.id);

    const result = await userService.processVerificationPayment(user.id, {
      transactionId: 'MPESA1234567890',
    });

    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.verificationLevel).toBe('COMMUNITY_VERIFIED');

    const row = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId: user.id, type: 'COMMUNITY' } },
    });
    expect(row?.status).toBe('APPROVED');
  });

  it('rejects when request is VOUCHING (not PAYMENT_PENDING) with 409', async () => {
    const user = await createPhoneVerifiedUser('pay-wrong-status@test.com');
    await seedVouchingRequest(user.id);

    await expect(
      userService.processVerificationPayment(user.id, {
        transactionId: 'MPESA1234567890',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getVerificationStatus()
// ══════════════════════════════════════════════════════════════════════════════

describe('getVerificationStatus()', () => {
  it('returns PENDING defaults when no request exists', async () => {
    const user = await createPhoneVerifiedUser('status-none@test.com');

    const result = await userService.getVerificationStatus(user.id);

    expect(result.status).toBe('PENDING');
    expect(result.vouchesReceived).toBe(0);
    expect(result.vouchesNeeded).toBe(3);
  });

  it('returns VOUCHING with vouch count when request exists with 2 vouches', async () => {
    const target = await createPhoneVerifiedUser('status-vouching@test.com');
    const v1 = await createCommunityVerifiedVoucher('status-v1@test.com');
    const v2 = await createCommunityVerifiedVoucher('status-v2@test.com');
    await seedVouchingRequest(target.id);
    await seedVouch(target.id, v1.id, TEST_WARD_ID);
    await seedVouch(target.id, v2.id, TEST_WARD_ID);

    const result = await userService.getVerificationStatus(target.id);

    expect(result.status).toBe('VOUCHING');
    expect(result.vouchesReceived).toBe(2);
    expect(result.vouchesNeeded).toBe(3);
    expect(result.expiresAt).not.toBeNull();
  });

  it('returns PAYMENT_PENDING status', async () => {
    const user = await createPhoneVerifiedUser('status-pay@test.com');
    await seedPaymentPendingRequest(user.id);

    const result = await userService.getVerificationStatus(user.id);

    expect(result.status).toBe('PAYMENT_PENDING');
    expect(result.vouchesNeeded).toBe(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// checkVouchingTimeouts()
// ══════════════════════════════════════════════════════════════════════════════

describe('checkVouchingTimeouts()', () => {
  it('transitions expired VOUCHING requests to PAYMENT_PENDING', async () => {
    const user = await createPhoneVerifiedUser('timeout-user@test.com');

    // Seed a VOUCHING request that has already expired
    await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        type: 'COMMUNITY',
        status: 'VOUCHING',
        expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
    });

    const count = await userService.checkVouchingTimeouts();

    expect(count).toBeGreaterThanOrEqual(1);

    const row = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId: user.id, type: 'COMMUNITY' } },
    });
    expect(row?.status).toBe('PAYMENT_PENDING');
  });
});

/**
 * @file tests/verification/helpers.ts
 * @description Shared seeders and helpers for the verification test suite.
 *
 * NOT a test file — imported by community-verification.*.test.ts files.
 * Global TRUNCATE runs before each test (testSetup.ts), seed inside beforeEach.
 */

import { prisma } from '../../src/core/database/client.js';
import {
  TEST_WARD_ID_2,
  TEST_CONST_ID,
  TEST_COUNTY_ID,
  TEST_WARD_ID,
} from '../auth/helpers.js';

// ─────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────
export {
  TEST_WARD_ID,
  TEST_WARD_ID_2,
  TEST_CONST_ID,
  seedLocation,
} from '../auth/helpers.js';
export { makeUserToken } from '../user/helpers.js';

// ─────────────────────────────────────────────
// Location seeders
// ─────────────────────────────────────────────

/**
 * Seed the second ward (TEST_WARD_ID_2) under the same constituency as TEST_WARD_ID.
 * Must be called after seedLocation() since it shares TEST_CONST_ID.
 */
export async function seedSecondWard(): Promise<void> {
  await prisma.ward.upsert({
    where: { id: TEST_WARD_ID_2 },
    update: {},
    create: {
      id: TEST_WARD_ID_2,
      name: 'Test Ward 2',
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
    },
  });
}

// ─────────────────────────────────────────────
// User factories
// ─────────────────────────────────────────────

/**
 * PHONE_VERIFIED user — can request community verification.
 * Defaults to TEST_WARD_ID.
 */
export async function createPhoneVerifiedUser(email: string, wardId?: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Phone Verified User',
      verificationLevel: 'PHONE_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: false,
      locationVerified: false,
      primaryWardId: wardId ?? TEST_WARD_ID,
    },
  });
}

/**
 * COMMUNITY_VERIFIED user — can vouch for other users within the same ward.
 * Defaults to TEST_WARD_ID.
 */
export async function createCommunityVerifiedVoucher(
  email: string,
  wardId?: string
) {
  return prisma.user.create({
    data: {
      email,
      name: 'Community Verified Voucher',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      primaryWardId: wardId ?? TEST_WARD_ID,
    },
  });
}

/**
 * FULL_VERIFIED user — can vouch across wards.
 */
export async function createFullyVerifiedVoucher(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Fully Verified Voucher',
      verificationLevel: 'FULL_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      walletAddress: `0x${email
        .replace(/[^a-z0-9]/gi, '')
        .padEnd(40, '0')
        .slice(0, 40)}`,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

/**
 * Location-admin voucher — holds `location:ward_admin` but is deliberately NOT
 * community-verified, to prove the accountable bootstrap works without the admin
 * having to be verified first. Defaults to TEST_WARD_ID.
 */
export async function createWardAdminVoucher(email: string, wardId?: string) {
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Ward Admin Voucher',
      verificationLevel: 'PHONE_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: false,
      locationVerified: false,
      primaryWardId: wardId ?? TEST_WARD_ID,
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'location:ward_admin' },
    update: {},
    create: {
      name: 'location:ward_admin',
      description: 'Ward admin for tests',
    },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, active: true },
  });

  return user;
}

// ─────────────────────────────────────────────
// DB seeders
// ─────────────────────────────────────────────

/**
 * Create a VOUCHING verification request for a user (expires 7 days out).
 */
export async function seedVouchingRequest(userId: string) {
  return prisma.verificationRequest.create({
    data: {
      userId,
      type: 'COMMUNITY',
      status: 'VOUCHING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Create a PAYMENT_PENDING verification request for a user (already expired).
 */
export async function seedPaymentPendingRequest(userId: string) {
  return prisma.verificationRequest.create({
    data: {
      userId,
      type: 'COMMUNITY',
      status: 'PAYMENT_PENDING',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Create a communityVouch record linking voucher → target in a ward.
 */
export async function seedVouch(
  targetUserId: string,
  voucherId: string,
  wardId: string
) {
  return prisma.communityVouch.create({
    data: {
      userId: targetUserId,
      voucherId,
      wardId,
    },
  });
}

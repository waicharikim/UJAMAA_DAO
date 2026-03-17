/**
 * @file tests/payments/helpers.ts
 * Shared seeders and helpers for payment module tests.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

export {
  TEST_COUNTY_ID,
  TEST_CONST_ID,
  TEST_WARD_ID,
  seedLocation,
} from '../auth/helpers.js';

/** Create a COMMUNITY_VERIFIED user for payment tests */
export async function createPaymentTestUser(email: string) {
  const { TEST_WARD_ID } = await import('../auth/helpers.js');
  return prisma.user.create({
    data: {
      email,
      name: 'Payment Test User',
      phoneNumber: '+254712345678',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

/** Seed a pending PaymentRecord */
export async function seedPaymentRecord(userId: string, overrides: Partial<{
  txRef: string;
  flwRef: string;
  method: string;
  purpose: string;
  purposeMeta: object;
  amount: number;
  status: string;
}> = {}) {
  return prisma.paymentRecord.create({
    data: {
      userId,
      txRef: overrides.txRef ?? `UJ-TEST-${Date.now()}`,
      flwRef: overrides.flwRef,
      amount: overrides.amount ?? 60,
      currency: 'KES',
      method: overrides.method ?? 'MPESA',
      purpose: overrides.purpose ?? 'DUES',
      purposeMeta: overrides.purposeMeta ?? { tier: 'ORDINARY', period: '2026-03' },
      status: overrides.status ?? 'PENDING',
    },
  });
}

/** Generate a valid JWT for payment tests */
export function makePaymentToken(userId: string, extra: Partial<JwtPayload> = {}): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: 'COMMUNITY_VERIFIED',
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 0,
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      type: 'permanent',
      ...extra,
    },
    '1h',
    0
  );
}

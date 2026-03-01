/**
 * @file tests/auth/helpers.ts
 * @description Shared seeders and JWT helpers for auth module tests.
 *
 * NOT a test file — imported by the auth test files.
 * Uses fixed UUIDs so tests can reference predictable location IDs.
 */

import { prisma } from '../../src/core/database/client.js';
import {
  signJwtToken,
  signRefreshToken,
  JwtPayload,
} from '../../src/core/utils/jwt.service.js';
import type { VerificationLevel } from '../../src/core/types/Ujamaadao.types.js';

// ─────────────────────────────────────────────
// Fixed location UUIDs (all tables truncated before each test so no conflicts)
// ─────────────────────────────────────────────
export const TEST_COUNTY_ID = 'e1ef8162-88bc-4f64-a23d-445b06029a69';
export const TEST_CONST_ID  = 'f2ab9273-99cd-4e75-b34e-556c17138bef';
export const TEST_WARD_ID   = '12345678-9abc-4def-1234-56789abcdef0';
export const TEST_WARD_ID_2 = '22345678-9abc-4def-1234-56789abcdef0';

// ─────────────────────────────────────────────
// Location seeder
// ─────────────────────────────────────────────

/**
 * Seed County → Constituency → Ward hierarchy.
 * Must be called after the global TRUNCATE (testSetup.ts beforeEach).
 */
export async function seedLocation(): Promise<void> {
  await prisma.county.upsert({
    where: { id: TEST_COUNTY_ID },
    update: {},
    create: { id: TEST_COUNTY_ID, name: 'Test County', code: 'TC-HELPER-01' },
  });
  await prisma.constituency.upsert({
    where: { id: TEST_CONST_ID },
    update: {},
    create: {
      id: TEST_CONST_ID,
      name: 'Test Constituency',
      countyId: TEST_COUNTY_ID,
    },
  });
  await prisma.ward.upsert({
    where: { id: TEST_WARD_ID },
    update: {},
    create: {
      id: TEST_WARD_ID,
      name: 'Test Ward',
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
    },
  });
}

// ─────────────────────────────────────────────
// User seeders
// ─────────────────────────────────────────────

/**
 * Create a bare User with ward refs and the given verificationLevel.
 */
export async function createTestUser(
  email: string,
  verificationLevel: string = 'EMAIL_VERIFIED'
) {
  return prisma.user.create({
    data: {
      email,
      name: 'Test User',
      verificationLevel,
      emailVerified: verificationLevel !== 'UNVERIFIED',
      phoneVerified: false,
      communityVerified: false,
      locationVerified: false,
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID,
    },
  });
}

/**
 * Create a user with the system:super_admin role (required for password-reset tests).
 * Sets a non-null passwordHash so requestReset() proceeds past the guard.
 */
export async function createTestAdmin(email: string) {
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test Admin',
      verificationLevel: 'EMAIL_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: false,
      locationVerified: false,
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID,
      // Non-null passwordHash so requestReset() proceeds past the guard
      passwordHash: '$argon2id$v=19$m=16,t=2,p=1$dGVzdA$dGVzdA',
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'system:super_admin' },
    update: {},
    create: { name: 'system:super_admin', description: 'Super admin role for tests' },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, active: true },
  });

  return user;
}

/**
 * Create OnboardingProgress for a user (required by verifyEmailToken first-time flow).
 */
export async function createOnboardingProgress(userId: string) {
  return prisma.onboardingProgress.create({
    data: {
      userId,
      industriesSelected: false,
      goodsServicesSelected: false,
      profileCompleted: false,
      currentStep: 'EMAIL_VERIFICATION',
    },
  });
}

// ─────────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────────

/**
 * Generate a valid access JWT with no sessionId (auth middleware skips session validation).
 * notBefore=0 so the token is valid immediately.
 */
export function makeAccessToken(
  userId: string,
  verificationLevel: VerificationLevel = 'EMAIL_VERIFIED',
  extra: Partial<JwtPayload> = {}
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel,
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 0,
      emailVerified: verificationLevel !== 'UNVERIFIED',
      phoneVerified: false,
      communityVerified:
        verificationLevel === 'COMMUNITY_VERIFIED' ||
        verificationLevel === 'FULL_VERIFIED',
      type: 'permanent',
      ...extra,
    },
    '1h',
    0 // valid immediately — no notBefore delay
  );
}

/**
 * Generate a valid refresh JWT containing a sessionId.
 */
export function makeRefreshToken(userId: string, sessionId: string): string {
  return signRefreshToken({
    sub: userId,
    sessionId,
    verificationLevel: 'EMAIL_VERIFIED',
    roles: [],
    globalImpactPoints: 0,
    utilityTokens: 0,
    participationRights: 0,
  });
}

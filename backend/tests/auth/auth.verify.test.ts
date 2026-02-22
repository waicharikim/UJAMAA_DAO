// tests/auth/auth.verify.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../src/modules/auth/services/auth.service.js';
import { prisma } from '../../src/core/database/client.js';
import { signJwtToken } from '../../src/core/utils/jwt.service.js';

/**
 * Build a magic-link JWT valid immediately (notBefore=0) for test use.
 * signMagicLinkToken adds a 30s notBefore delay (anti-replay) which makes
 * tokens fail verification when checked immediately in tests.
 */
function testMagicLinkToken(userId: string, email: string | null, type = 'magic-link') {
  return signJwtToken(
    { sub: userId, email: email ?? undefined, type },
    '15m',
    0  // valid immediately — no notBefore delay in tests
  );
}

vi.mock('../../src/core/utils/email.service.js');
vi.mock('../../src/modules/economy/services/participationRights.service.js');
vi.mock('../../src/modules/community/services/groupMembership.service.js');

// Fixed UUIDs for location hierarchy
const TEST_COUNTY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_CONST_ID  = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const TEST_WARD_ID   = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

/**
 * Seed the minimal location hierarchy required by auth service.
 * Called once per beforeEach — the global truncate in testSetup.ts
 * clears all tables before every test so this is always a fresh insert.
 */
async function seedLocation() {
  await prisma.county.create({
    data: { id: TEST_COUNTY_ID, name: 'Test County', code: 'TC-TEST-01' },
  });
  await prisma.constituency.create({
    data: { id: TEST_CONST_ID, name: 'Test Constituency', countyId: TEST_COUNTY_ID },
  });
  await prisma.ward.create({
    data: {
      id: TEST_WARD_ID,
      name: 'Test Ward',
      constituencyId: TEST_CONST_ID,
      countyId: TEST_COUNTY_ID,
    },
  });
}

/**
 * Create a user with the given verificationLevel and the test ward IDs.
 */
async function createTestUser(
  email: string,
  verificationLevel: 'UNVERIFIED' | 'EMAIL_VERIFIED' = 'EMAIL_VERIFIED'
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

// ─────────────────────────────────────────────
// verifyEmailToken
// ─────────────────────────────────────────────

describe('Auth Service - verifyEmailToken', () => {
  beforeEach(seedLocation);

  it('should verify email, create session, and return JWT for unverified user', async () => {
    const user = await createTestUser('verify-token@ujamaa.test', 'UNVERIFIED');

    // OnboardingProgress is required because completeEmailVerificationAndCreateSession
    // calls tx.onboardingProgress.update on first-time login.
    await prisma.onboardingProgress.create({
      data: {
        userId: user.id,
        industriesSelected: false,
        goodsServicesSelected: false,
        profileCompleted: false,
        currentStep: 'EMAIL_VERIFICATION',
      },
    });

    // Create DB verification token as tokenService.createVerificationToken would
    const tokenValue = 'test-verification-token-abcdef1234567890';
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: tokenValue,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      },
    });

    const result = await authService.verifyEmailToken(tokenValue);

    // Should return a complete auth result
    expect(result.sessionToken).toBeTruthy();
    expect(result.user.id).toBe(user.id);
    expect(result.session).toBeTruthy();
    expect(result.needsProfileCompletion).toBe(false);

    // User should now be EMAIL_VERIFIED in DB
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.verificationLevel).toBe('EMAIL_VERIFIED');
    expect(updated?.emailVerified).toBe(true);

    // Verification token should be deleted (one-time use)
    const deletedToken = await prisma.emailVerificationToken.findUnique({
      where: { token: tokenValue },
    });
    expect(deletedToken).toBeNull();

    // Session should be persisted
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].revoked).toBe(false);
  });

  it('should throw tokenInvalid for an invalid (non-existent) token', async () => {
    await expect(
      authService.verifyEmailToken('invalid-token-that-does-not-exist')
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw tokenInvalid for an expired token', async () => {
    const user = await createTestUser('expired-token@ujamaa.test', 'UNVERIFIED');

    const expiredToken = 'expired-verification-token-xyz';
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    await expect(
      authService.verifyEmailToken(expiredToken)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should create session for already-verified user using a fresh token', async () => {
    // Edge case: email_verified user somehow has a second verification token.
    // The service should still create a session (isFirstTimeLogin = false → skip verification tx).
    const user = await createTestUser('reverify@ujamaa.test', 'EMAIL_VERIFIED');

    const tokenValue = 'reverify-token-abcdef1234567890abcd';
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: tokenValue,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const result = await authService.verifyEmailToken(tokenValue);

    expect(result.sessionToken).toBeTruthy();
    expect(result.user.id).toBe(user.id);

    // User verification level unchanged (was already verified)
    const unchanged = await prisma.user.findUnique({ where: { id: user.id } });
    expect(unchanged?.verificationLevel).toBe('EMAIL_VERIFIED');
  });
});

// ─────────────────────────────────────────────
// verifyMagicLink
// ─────────────────────────────────────────────

describe('Auth Service - verifyMagicLink', () => {
  beforeEach(seedLocation);

  it('should verify magic link JWT, create session, and return JWT for verified user', async () => {
    const user = await createTestUser('magic-link@ujamaa.test', 'EMAIL_VERIFIED');

    const magicLinkToken = testMagicLinkToken(user.id, user.email);

    const result = await authService.verifyMagicLink(magicLinkToken);

    expect(result.sessionToken).toBeTruthy();
    expect(result.user.id).toBe(user.id);
    expect(result.session).toBeTruthy();
    expect(result.needsProfileCompletion).toBe(false);

    // Session should be persisted
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].revoked).toBe(false);
  });

  it('should throw tokenInvalid for a completely invalid token string', async () => {
    await expect(
      authService.verifyMagicLink('not.a.valid.jwt.token')
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw tokenInvalid for an expired magic link JWT', async () => {
    const user = await createTestUser('expired-magic@ujamaa.test', 'EMAIL_VERIFIED');

    // signJwtToken with expiresIn=-1 produces an immediately-expired token
    const expiredToken = signJwtToken(
      { sub: user.id, email: user.email ?? undefined, type: 'magic-link' },
      -1 // expires immediately
    );

    await expect(
      authService.verifyMagicLink(expiredToken)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should reject token with wrong type (not magic-link)', async () => {
    const user = await createTestUser('wrong-type@ujamaa.test', 'EMAIL_VERIFIED');

    // Create a token with type "permanent" instead of "magic-link"
    const wrongTypeToken = testMagicLinkToken(user.id, user.email, 'permanent');

    await expect(
      authService.verifyMagicLink(wrongTypeToken)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should verify magic link for unverified user and complete first-time verification', async () => {
    const user = await createTestUser('magic-first@ujamaa.test', 'UNVERIFIED');

    await prisma.onboardingProgress.create({
      data: {
        userId: user.id,
        industriesSelected: false,
        goodsServicesSelected: false,
        profileCompleted: false,
        currentStep: 'EMAIL_VERIFICATION',
      },
    });

    const magicLinkToken = testMagicLinkToken(user.id, user.email);

    const result = await authService.verifyMagicLink(magicLinkToken);

    expect(result.sessionToken).toBeTruthy();
    expect(result.user.id).toBe(user.id);

    // User should now be EMAIL_VERIFIED
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.verificationLevel).toBe('EMAIL_VERIFIED');
    expect(updated?.emailVerified).toBe(true);
  });
});

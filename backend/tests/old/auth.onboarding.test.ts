/**
 * @file tests/auth/auth.onboarding.test.ts
 * @description
 * Comprehensive Integration Test for Full Auth Flow (Real Sessions & JWT)
 * 
 * This test proves the entire auth module works end-to-end with:
 * - User creation
 * - Verification token generation
 * - Onboarding completion
 * - PR bonus award
 * - Real session creation
 * - Real JWT with sessionId
 * - Session validation in middleware
 * - 200 OK on /users/me with rich profile
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/core/database/client.js';
import { seeded } from '../testSetup.js';
import { PR_CONFIG } from '../../src/modules/economy/types.js';

describe('Auth Module - Full Onboarding Flow (Real)', () => {
  let verificationToken: string;
  let jwt: string;
  let userId: string;
  let sessionId: string;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    phoneNumber: '+254712345678',
    primaryWardId: seeded.holdings.kibraWard,
    secondaryWardId: seeded.holdings.langataWard,
  };

  it('should create user and generate verification token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-magic-link')
      .send(testUser)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.newUser).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    expect(user).toBeTruthy();
    expect(user?.verificationLevel).toBe('UNVERIFIED');
    userId = user!.id;

    const tokenRecord = await prisma.emailVerificationToken.findFirst({
      where: { userId },
    });

    expect(tokenRecord).toBeTruthy();
    expect(tokenRecord?.token).toHaveLength(64); // 32 bytes hex
    verificationToken = tokenRecord!.token;
  });

  it('should complete onboarding, create session, award PR bonus', async () => {
    const res = await request(app)
      .get('/api/v1/auth/verify-email')
      .query({ token: verificationToken })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionToken).toBeDefined();
    jwt = res.body.data.sessionToken;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.verificationLevel).toBe('EMAIL_VERIFIED');
    expect(user?.participationRights).toBe(PR_CONFIG.ONBOARDING_BONUS);
    expect(user?.onboardingCompletedAt).toBeDefined();
    expect(user?.lastLoginAt).toBeDefined();

    const session = await prisma.session.findFirst({ where: { userId } });
    expect(session).toBeTruthy();
    expect(session?.token).toHaveLength(96); // 48 bytes hex
    sessionId = session!.id;

    const loginEvent = await prisma.loginEvent.findFirst({
      where: { userId, successful: true },
    });
    expect(loginEvent).toBeTruthy();
    expect(loginEvent?.method).toBe('EMAIL_VERIFICATION');
  });

  it('should return rich profile with valid JWT and session', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    const profile = res.body.data;

    expect(profile.id).toBe(userId);
    expect(profile.email).toBe(testUser.email);
    expect(profile.name).toBe(testUser.name);
    expect(profile.verification.level).toBe('EMAIL_VERIFIED');
    expect(profile.economic.participationRights).toBe(PR_CONFIG.ONBOARDING_BONUS);
    expect(profile.geographic.primaryWard.id).toBe(testUser.primaryWardId);
    expect(profile.geographic.secondaryWard.id).toBe(testUser.secondaryWardId);
  });

  it('should validate session was used', async () => {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.lastActive).toBeDefined();
    expect(session?.lastActive.getTime()).toBeGreaterThan(Date.now() - 60000); // Updated recently
  });
});
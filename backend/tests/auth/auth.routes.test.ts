// tests/auth/auth.routes.test.ts
//
// Supertest integration tests for all auth routes.
// The app is imported directly; Redis falls back to in-memory when REDIS_URL is unset.
// tokenBlacklistService is mocked so auth middleware never touches real Redis.

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
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

vi.mock('ethers', () => ({
  ethers: {
    isAddress: vi.fn().mockReturnValue(true),
    verifyMessage: vi.fn().mockReturnValue('0xaabbccddeeaabbccddeeaabbccddeeaabbccddee'),
  },
}));

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  makeAccessToken,
  seedLocation,
  createTestUser,
  TEST_CONST_ID,
  TEST_COUNTY_ID,
  TEST_WARD_ID,
} from './helpers.js';
import { prisma } from '../../src/core/database/client.js';

// A stable fake userId (doesn't need a matching DB row for auth middleware)
const FAKE_USER_ID = 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa';
const FAKE_SESSION_ID = 'bbbbbbbb-2222-4bbb-bbbb-bbbbbbbbbbbb';

// Tokens for different verification levels
const emailVerifiedToken = makeAccessToken(FAKE_USER_ID, 'EMAIL_VERIFIED');
const communityVerifiedToken = makeAccessToken(FAKE_USER_ID, 'COMMUNITY_VERIFIED');
const fullVerifiedToken = makeAccessToken(FAKE_USER_ID, 'FULL_VERIFIED');

const BASE = '/api/v1/auth';

describe('Auth Routes', () => {
  beforeAll(async () => {
    // Ensure async service initialization completes (resolves quickly in test env)
    await servicesReady.catch(() => {
      /* Redis init failure is non-fatal in tests */
    });
  });

  beforeEach(async () => {
    // Auth middleware (commit 86f1794) now queries prisma.user to verify ACTIVE status.
    // Seed location hierarchy + create a real DB row for FAKE_USER_ID so all
    // token-based tests pass the middleware's account check.
    await seedLocation();
    await prisma.user.upsert({
      where: { id: FAKE_USER_ID },
      update: {},
      create: {
        id: FAKE_USER_ID,
        email: 'fake-route-test@test.com',
        name: 'Fake User',
        verificationLevel: 'FULL_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        locationVerified: false,
        primaryWardId: TEST_WARD_ID,
        secondaryWardId: TEST_WARD_ID,
      },
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /magic-link/send
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /magic-link/send', () => {
    // IDs that match the new-user test payload below
    const TEST_NEW_WARD_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
    const TEST_INDUSTRY_ID = 'd4e5f6a7-b8c9-1234-def0-123456789012';
    const TEST_GOODS_SVC_ID = 'e5f6a7b8-c9d0-2345-ef01-234567890123';

    beforeEach(async () => {
      // Seed location hierarchy (County → Constituency → Ward)
      await seedLocation();

      // Second ward referenced by the new-user test payload
      await prisma.ward.create({
        data: {
          id: TEST_NEW_WARD_ID,
          name: 'Test Ward 2',
          constituencyId: TEST_CONST_ID,
          countyId: TEST_COUNTY_ID,
        },
      });

      // Existing user for the email-only test
      await createTestUser('user@test.com', 'EMAIL_VERIFIED');

      // Industry + GoodsService required by new-user registration path
      await prisma.industry.create({
        data: { id: TEST_INDUSTRY_ID, name: 'Test Industry' },
      });
      await prisma.goodsService.create({
        data: {
          id: TEST_GOODS_SVC_ID,
          name: 'Test Service',
          industryId: TEST_INDUSTRY_ID,
          active: true,
        },
      });
    });

    it('200 — existing user (email only)', async () => {
      const res = await request(app)
        .post(`${BASE}/magic-link/send`)
        .send({ email: 'user@test.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('200 — new user with all required onboarding fields', async () => {
      const wardId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
      const res = await request(app)
        .post(`${BASE}/magic-link/send`)
        .send({
          email: 'newuser@test.com',
          name: 'New User',
          phoneNumber: '+254711000001',
          primaryWardId: wardId,
          secondaryWardId: wardId,
          industryIds: ['d4e5f6a7-b8c9-1234-def0-123456789012'],
          goodsServiceIds: ['e5f6a7b8-c9d0-2345-ef01-234567890123'],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('400 — invalid email format', async () => {
      const res = await request(app)
        .post(`${BASE}/magic-link/send`)
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 — partial onboarding fields (missing some required for new user)', async () => {
      const res = await request(app)
        .post(`${BASE}/magic-link/send`)
        .send({
          email: 'partial@test.com',
          name: 'Partial User',
          // missing phoneNumber, wardIds, industryIds, goodsServiceIds
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // GET /verify-email
  // ════════════════════════════════════════════════════════════════════════

  describe('GET /verify-email', () => {
    it('400 — missing token query param', async () => {
      const res = await request(app)
        .get(`${BASE}/verify-email`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 — token with wrong length (not 64 chars)', async () => {
      const res = await request(app)
        .get(`${BASE}/verify-email?token=tooshort`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('401 — valid-length token not found in DB', async () => {
      const res = await request(app)
        .get(`${BASE}/verify-email?token=${'a'.repeat(64)}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // GET /login  (magic-link JWT)
  // ════════════════════════════════════════════════════════════════════════

  describe('GET /login', () => {
    it('400 — missing token query param', async () => {
      const res = await request(app)
        .get(`${BASE}/login`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('401 — invalid JWT string', async () => {
      const res = await request(app)
        .get(`${BASE}/login?token=invalid.jwt.here`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /wallet/nonce
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /wallet/nonce', () => {
    it('200 — valid Ethereum address', async () => {
      const res = await request(app)
        .post(`${BASE}/wallet/nonce`)
        .send({ walletAddress: '0xaabbccddeeaabbccddeeaabbccddeeaabbccddee' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('400 — invalid address format', async () => {
      const res = await request(app)
        .post(`${BASE}/wallet/nonce`)
        .send({ walletAddress: 'not-a-wallet' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /wallet/verify
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /wallet/verify', () => {
    it('400 — missing walletAddress', async () => {
      const res = await request(app)
        .post(`${BASE}/wallet/verify`)
        .send({ signature: '0x' + 'a'.repeat(130) })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 — missing signature', async () => {
      const res = await request(app)
        .post(`${BASE}/wallet/verify`)
        .send({ walletAddress: '0xaabbccddeeaabbccddeeaabbccddeeaabbccddee' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /password/request-reset
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /password/request-reset', () => {
    it('200 — any email (enumeration protection: always succeeds)', async () => {
      const res = await request(app)
        .post(`${BASE}/password/request-reset`)
        .send({ email: 'anyone@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('400 — invalid email', async () => {
      const res = await request(app)
        .post(`${BASE}/password/request-reset`)
        .send({ email: 'bad-email' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // GET /password/verify-token
  // ════════════════════════════════════════════════════════════════════════

  describe('GET /password/verify-token', () => {
    it('400 — missing token param', async () => {
      const res = await request(app)
        .get(`${BASE}/password/verify-token`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 — wrong-length token', async () => {
      const res = await request(app)
        .get(`${BASE}/password/verify-token?token=short`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /password/reset
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /password/reset', () => {
    it('400 — missing token', async () => {
      const res = await request(app)
        .post(`${BASE}/password/reset`)
        .send({ newPassword: 'ValidPass@word123!' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('400 — weak password', async () => {
      const res = await request(app)
        .post(`${BASE}/password/reset`)
        .send({ token: 'a'.repeat(64), newPassword: 'weak' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // GET /sessions  (requires COMMUNITY_VERIFIED)
  // ════════════════════════════════════════════════════════════════════════

  describe('GET /sessions', () => {
    it('401 — no Authorization header', async () => {
      const res = await request(app).get(`${BASE}/sessions`).expect(401);
      expect(res.body.success).toBe(false);
    });

    it('200 — authenticated with COMMUNITY_VERIFIED token', async () => {
      const res = await request(app)
        .get(`${BASE}/sessions`)
        .set('Authorization', `Bearer ${communityVerifiedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // DELETE /sessions/:sessionId
  // ════════════════════════════════════════════════════════════════════════

  describe('DELETE /sessions/:sessionId', () => {
    it('401 — no auth', async () => {
      await request(app)
        .delete(`${BASE}/sessions/${FAKE_SESSION_ID}`)
        .expect(401);
    });

    it('404 — valid JWT but session does not belong to user', async () => {
      // session doesn't exist in DB → 404 from the service
      await request(app)
        .delete(`${BASE}/sessions/${FAKE_SESSION_ID}`)
        .set('Authorization', `Bearer ${communityVerifiedToken}`)
        .expect(404);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /logout
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /logout', () => {
    it('401 — no auth', async () => {
      await request(app).post(`${BASE}/logout`).expect(401);
    });

    it('200 — authenticated', async () => {
      const res = await request(app)
        .post(`${BASE}/logout`)
        .set('Authorization', `Bearer ${communityVerifiedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /refresh
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /refresh', () => {
    it('400 — missing refreshToken field', async () => {
      const res = await request(app)
        .post(`${BASE}/refresh`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('401 — invalid JWT as refreshToken', async () => {
      const res = await request(app)
        .post(`${BASE}/refresh`)
        .send({ refreshToken: 'not.a.real.jwt' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // GET /2fa/status  (requires FULL_VERIFIED)
  // ════════════════════════════════════════════════════════════════════════

  describe('GET /2fa/status', () => {
    it('401 — no auth', async () => {
      await request(app).get(`${BASE}/2fa/status`).expect(401);
    });

    it('403 — EMAIL_VERIFIED is insufficient (requires FULL_VERIFIED)', async () => {
      const res = await request(app)
        .get(`${BASE}/2fa/status`)
        .set('Authorization', `Bearer ${emailVerifiedToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('200 — FULL_VERIFIED token passes authorization', async () => {
      const res = await request(app)
        .get(`${BASE}/2fa/status`)
        .set('Authorization', `Bearer ${fullVerifiedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POST /phone/send-code  (requires COMMUNITY_VERIFIED)
  // ════════════════════════════════════════════════════════════════════════

  describe('POST /phone/send-code', () => {
    it('401 — no auth', async () => {
      await request(app).post(`${BASE}/phone/send-code`).expect(401);
    });

    it('400 — invalid phone number format', async () => {
      const res = await request(app)
        .post(`${BASE}/phone/send-code`)
        .set('Authorization', `Bearer ${communityVerifiedToken}`)
        .send({ phoneNumber: 'not-a-phone' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // GET /security-events  (requires COMMUNITY_VERIFIED)
  // ════════════════════════════════════════════════════════════════════════

  describe('GET /security-events', () => {
    it('401 — no auth', async () => {
      await request(app).get(`${BASE}/security-events`).expect(401);
    });

    it('200 — authenticated with COMMUNITY_VERIFIED', async () => {
      const res = await request(app)
        .get(`${BASE}/security-events`)
        .set('Authorization', `Bearer ${communityVerifiedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});

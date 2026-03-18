// tests/verification/community-verification.routes.test.ts
//
// Supertest integration tests for all /users/verify-community/* routes.
// Does NOT duplicate the 5 tests already in user.routes.test.ts.
// Uses fixed UUIDs; DB is truncated before each test by testSetup.ts.

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
import { prisma } from '../../src/core/database/client.js';
import {
  seedLocation,
  seedSecondWard,
  TEST_WARD_ID,
  TEST_WARD_ID_2,
  makeUserToken,
  createPhoneVerifiedUser,
  createCommunityVerifiedVoucher,
  seedVouchingRequest,
  seedPaymentPendingRequest,
  seedVouch,
} from './helpers.js';

const BASE = '/api/v1/users';

describe('Community Verification Routes', () => {
  beforeAll(async () => {
    await servicesReady.catch(() => {});
  });

  beforeEach(async () => {
    await seedLocation();
    await seedSecondWard();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /verify-community/status
  // (403 EMAIL_VERIFIED + 200 PENDING already covered in user.routes.test.ts)
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /verify-community/status', () => {
    it('R1 — returns 401 with no token', async () => {
      const res = await request(app).get(`${BASE}/verify-community/status`);
      expect(res.status).toBe(401);
    });

    it('R2 — returns 200 VOUCHING with vouch count', async () => {
      const target = await createPhoneVerifiedUser('status-vouch-r@test.com');
      const v1 = await createCommunityVerifiedVoucher('status-v1-r@test.com');
      await seedVouchingRequest(target.id);
      await seedVouch(target.id, v1.id, TEST_WARD_ID);

      const token = makeUserToken(target.id, 'PHONE_VERIFIED');
      const res = await request(app)
        .get(`${BASE}/verify-community/status`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VOUCHING');
      expect(res.body.data.vouchesReceived).toBe(1);
    });

    it('R3 — returns 200 PAYMENT_PENDING', async () => {
      const user = await createPhoneVerifiedUser('status-pay-r@test.com');
      await seedPaymentPendingRequest(user.id);

      const token = makeUserToken(user.id, 'PHONE_VERIFIED');
      const res = await request(app)
        .get(`${BASE}/verify-community/status`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAYMENT_PENDING');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /verify-community/request
  // (403 EMAIL_VERIFIED + 201 success + 409 VOUCHING dup already in user.routes.test.ts)
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /verify-community/request', () => {
    it('R4 — returns 401 with no token', async () => {
      const res = await request(app).post(`${BASE}/verify-community/request`);
      expect(res.status).toBe(401);
    });

    it('R5 — returns 201 for PHONE_VERIFIED user with correct shape', async () => {
      const user = await createPhoneVerifiedUser('req-201-r@test.com');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/request`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('VOUCHING');
      expect(res.body.data.vouchesNeeded).toBe(3);
      expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('R6 — returns 409 when PAYMENT_PENDING request already exists', async () => {
      const user = await createPhoneVerifiedUser('req-409-pay-r@test.com');
      await seedPaymentPendingRequest(user.id);

      const token = makeUserToken(user.id, 'PHONE_VERIFIED');
      const res = await request(app)
        .post(`${BASE}/verify-community/request`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /verify-community/vouch
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /verify-community/vouch', () => {
    it('R7 — returns 401 with no token', async () => {
      const res = await request(app).post(`${BASE}/verify-community/vouch`);
      expect(res.status).toBe(401);
    });

    it('R8 — returns 403 for PHONE_VERIFIED voucher (route guard)', async () => {
      const voucher = await createPhoneVerifiedUser('vouch-pv-r@test.com');
      const token = makeUserToken(voucher.id, 'PHONE_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/vouch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: '00000000-0000-4000-8000-000000000001', wardId: TEST_WARD_ID });

      expect(res.status).toBe(403);
    });

    it('R9 — returns 400 for missing targetUserId', async () => {
      const voucher = await createCommunityVerifiedVoucher('vouch-cv-r9@test.com');
      const token = makeUserToken(voucher.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/vouch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ wardId: TEST_WARD_ID });

      expect(res.status).toBe(400);
    });

    it('R10 — returns 400 for non-UUID targetUserId', async () => {
      const voucher = await createCommunityVerifiedVoucher('vouch-cv-r10@test.com');
      const token = makeUserToken(voucher.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/vouch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: 'not-a-uuid', wardId: TEST_WARD_ID });

      expect(res.status).toBe(400);
    });

    it('R11 — returns 200 for valid first vouch, target stays PHONE_VERIFIED', async () => {
      const target = await createPhoneVerifiedUser('vouch-target-r11@test.com');
      const voucher = await createCommunityVerifiedVoucher('vouch-giver-r11@test.com');
      await seedVouchingRequest(target.id);

      const token = makeUserToken(voucher.id, 'COMMUNITY_VERIFIED');
      const res = await request(app)
        .post(`${BASE}/verify-community/vouch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: target.id, wardId: TEST_WARD_ID });

      expect(res.status).toBe(200);
      expect(res.body.data.vouchCount).toBe(1);

      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updated?.verificationLevel).toBe('PHONE_VERIFIED');
    });

    it('R12 — third vouch triggers completion → COMMUNITY_VERIFIED in DB', async () => {
      const target = await createPhoneVerifiedUser('vouch-target-r12@test.com');
      const v1 = await createCommunityVerifiedVoucher('vouch-r12-v1@test.com');
      const v2 = await createCommunityVerifiedVoucher('vouch-r12-v2@test.com');
      const v3 = await createCommunityVerifiedVoucher('vouch-r12-v3@test.com');
      await seedVouchingRequest(target.id);
      await seedVouch(target.id, v1.id, TEST_WARD_ID);
      await seedVouch(target.id, v2.id, TEST_WARD_ID);

      const token = makeUserToken(v3.id, 'COMMUNITY_VERIFIED');
      const res = await request(app)
        .post(`${BASE}/verify-community/vouch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: target.id, wardId: TEST_WARD_ID });

      expect(res.status).toBe(200);

      const row = await prisma.verificationRequest.findUnique({
        where: { userId_type: { userId: target.id, type: 'COMMUNITY' } },
      });
      expect(row?.status).toBe('APPROVED');

      const updated = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updated?.verificationLevel).toBe('COMMUNITY_VERIFIED');
    });

    it('R13 — returns 409 for duplicate vouch', async () => {
      const target = await createPhoneVerifiedUser('vouch-target-r13@test.com');
      const voucher = await createCommunityVerifiedVoucher('vouch-giver-r13@test.com');
      await seedVouchingRequest(target.id);
      await seedVouch(target.id, voucher.id, TEST_WARD_ID);

      const token = makeUserToken(voucher.id, 'COMMUNITY_VERIFIED');
      const res = await request(app)
        .post(`${BASE}/verify-community/vouch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: target.id, wardId: TEST_WARD_ID });

      expect(res.status).toBe(409);
    });

    it('R14 — returns 403/400 for cross-ward vouch (wardId mismatches target ward)', async () => {
      const target = await createPhoneVerifiedUser('vouch-target-r14@test.com', TEST_WARD_ID);
      const voucher = await createCommunityVerifiedVoucher('vouch-giver-r14@test.com', TEST_WARD_ID);
      await seedVouchingRequest(target.id);

      const token = makeUserToken(voucher.id, 'COMMUNITY_VERIFIED');
      const res = await request(app)
        .post(`${BASE}/verify-community/vouch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: target.id, wardId: TEST_WARD_ID_2 });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /verify-community/payment
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /verify-community/payment', () => {
    it('R15 — returns 401 with no token', async () => {
      const res = await request(app).post(`${BASE}/verify-community/payment`);
      expect(res.status).toBe(401);
    });

    it('R16 — returns 403 for EMAIL_VERIFIED user (route requires PHONE_VERIFIED)', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'pay-email-r@test.com',
          name: 'Email User',
          verificationLevel: 'EMAIL_VERIFIED',
          emailVerified: true,
          phoneVerified: false,
          communityVerified: false,
          locationVerified: false,
          primaryWardId: TEST_WARD_ID,
        },
      });
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ transactionId: 'MPESA1234567890' });

      expect(res.status).toBe(403);
    });

    it('R17 — returns 400 for transactionId shorter than 10 characters', async () => {
      const user = await createPhoneVerifiedUser('pay-short-r@test.com');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ transactionId: 'MPESA123' }); // 8 chars — fails min(10)

      expect(res.status).toBe(400);
    });

    it('R18 — returns 409 when no PAYMENT_PENDING request exists', async () => {
      const user = await createPhoneVerifiedUser('pay-noreq-r@test.com');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ transactionId: 'MPESA1234567890' });

      expect(res.status).toBe(409);
    });

    it('R19 — returns 200 and promotes to COMMUNITY_VERIFIED', async () => {
      const user = await createPhoneVerifiedUser('pay-happy-r@test.com');
      await seedPaymentPendingRequest(user.id);

      const token = makeUserToken(user.id, 'PHONE_VERIFIED');
      const res = await request(app)
        .post(`${BASE}/verify-community/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({ transactionId: 'MPESA1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.verificationLevel).toBe('COMMUNITY_VERIFIED');
    });
  });
});

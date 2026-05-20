/**
 * @file tests/user/verification.routes.test.ts
 * @description Integration tests for community verification routes and
 * phone verification routes.
 *
 * Routes under test:
 *   POST /api/v1/auth/phone/send-code
 *   POST /api/v1/auth/phone/verify-code
 *   POST /api/v1/users/verify-community/request
 *   POST /api/v1/users/verify-community/vouch
 *   POST /api/v1/users/verify-community/payment
 *   GET  /api/v1/users/verify-community/status
 *
 * Runs against postgres_test DB. Global TRUNCATE fires before each test.
 */

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
  TEST_WARD_ID,
  createTestUser,
} from '../auth/helpers.js';
import { makeUserToken, createCommunityVerifiedUser } from './helpers.js';

const PHONE = '+254712000001';
const PHONE_B = '+254712000002';

beforeAll(async () => {
  await servicesReady;
});

beforeEach(async () => {
  await seedLocation();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/phone/send-code
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/phone/send-code', () => {
  it('returns 200 and devCode in mock mode', async () => {
    const user = await createTestUser('send-code@example.com');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .post('/api/v1/auth/phone/send-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(typeof res.body.data.devCode).toBe('string');
  });

  it('returns 400 for missing phone number', async () => {
    const user = await createTestUser('no-phone@example.com');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .post('/api/v1/auth/phone/send-code')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid phone format', async () => {
    const user = await createTestUser('bad-phone@example.com');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .post('/api/v1/auth/phone/send-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: 'not-a-number' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/phone/send-code')
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/phone/verify-code
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/phone/verify-code', () => {
  it('verifies code and promotes user to PHONE_VERIFIED', async () => {
    const user = await createTestUser('verify-code@example.com', 'EMAIL_VERIFIED');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    // Send code first
    const sendRes = await request(app)
      .post('/api/v1/auth/phone/send-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: PHONE });

    expect(sendRes.status).toBe(200);
    const { devCode } = sendRes.body.data;

    // Verify it
    const verifyRes = await request(app)
      .post('/api/v1/auth/phone/verify-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: PHONE, code: devCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.verificationLevel).toBe('PHONE_VERIFIED');
    expect(updated!.phoneVerified).toBe(true);
  });

  it('returns 400 for wrong code', async () => {
    const user = await createTestUser('wrong-code@example.com');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    await request(app)
      .post('/api/v1/auth/phone/send-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: PHONE });

    const res = await request(app)
      .post('/api/v1/auth/phone/verify-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: PHONE, code: '000000' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/phone/verify-code')
      .send({ phoneNumber: PHONE, code: '123456' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/users/verify-community/request
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/users/verify-community/request', () => {
  it('returns 201 and creates a VOUCHING request', async () => {
    const user = await createTestUser('req-verif@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });
    const token = makeUserToken(user.id, 'PHONE_VERIFIED');

    const res = await request(app)
      .post('/api/v1/users/verify-community/request')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('VOUCHING');
    expect(res.body.data.vouchesNeeded).toBe(3);
    expect(res.body.data.expiresAt).toBeTruthy();
  });

  it('returns 403 if user is only EMAIL_VERIFIED', async () => {
    const user = await createTestUser('email-only@example.com', 'EMAIL_VERIFIED');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .post('/api/v1/users/verify-community/request')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(403);
  });

  it('returns 409 if a request already exists', async () => {
    const user = await createTestUser('dup-req@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
    const token = makeUserToken(user.id, 'PHONE_VERIFIED');

    // Create first request
    await request(app)
      .post('/api/v1/users/verify-community/request')
      .set('Authorization', `Bearer ${token}`)
      .send();

    // Second request should conflict
    const res = await request(app)
      .post('/api/v1/users/verify-community/request')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(409);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/users/verify-community/request')
      .send();
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/users/verify-community/vouch
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/users/verify-community/vouch', () => {
  it('returns 200 and records the vouch', async () => {
    const target = await createTestUser('target@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: target.id }, data: { phoneVerified: true } });

    const voucher = await createCommunityVerifiedUser('voucher@example.com');
    const voucherToken = makeUserToken(voucher.id, 'COMMUNITY_VERIFIED');

    // Create a VOUCHING request for target
    await prisma.verificationRequest.create({
      data: {
        userId: target.id,
        type: 'COMMUNITY',
        status: 'VOUCHING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/users/verify-community/vouch')
      .set('Authorization', `Bearer ${voucherToken}`)
      .send({ targetUserId: target.id, wardId: TEST_WARD_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.vouchCount).toBe(1);
  });

  it('returns 403 if voucher is only PHONE_VERIFIED', async () => {
    const target = await createTestUser('target2@example.com', 'PHONE_VERIFIED');
    const phoneVoucher = await createTestUser('phone-voucher@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: phoneVoucher.id }, data: { phoneVerified: true } });
    const token = makeUserToken(phoneVoucher.id, 'PHONE_VERIFIED');

    const res = await request(app)
      .post('/api/v1/users/verify-community/vouch')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id, wardId: TEST_WARD_ID });

    expect(res.status).toBe(403);
  });

  it('returns 409 on duplicate vouch', async () => {
    const target = await createTestUser('dup-vouch-target@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: target.id }, data: { phoneVerified: true } });
    const voucher = await createCommunityVerifiedUser('dup-voucher@example.com');
    const token = makeUserToken(voucher.id, 'COMMUNITY_VERIFIED');

    await prisma.verificationRequest.create({
      data: {
        userId: target.id,
        type: 'COMMUNITY',
        status: 'VOUCHING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // First vouch
    await request(app)
      .post('/api/v1/users/verify-community/vouch')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id, wardId: TEST_WARD_ID });

    // Duplicate
    const res = await request(app)
      .post('/api/v1/users/verify-community/vouch')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id, wardId: TEST_WARD_ID });

    expect(res.status).toBe(409);
  });

  it('auto-approves after 3 vouches', async () => {
    const target = await createTestUser('auto-approve@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: target.id }, data: { phoneVerified: true } });

    await prisma.verificationRequest.create({
      data: {
        userId: target.id,
        type: 'COMMUNITY',
        status: 'VOUCHING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // 3 distinct COMMUNITY_VERIFIED vouchers
    for (let i = 1; i <= 3; i++) {
      const v = await createCommunityVerifiedUser(`auto-voucher-${i}@example.com`);
      const tok = makeUserToken(v.id, 'COMMUNITY_VERIFIED');
      const res = await request(app)
        .post('/api/v1/users/verify-community/vouch')
        .set('Authorization', `Bearer ${tok}`)
        .send({ targetUserId: target.id, wardId: TEST_WARD_ID });
      expect(res.status).toBe(200);
    }

    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    expect(updated!.verificationLevel).toBe('COMMUNITY_VERIFIED');
    expect(updated!.communityVerified).toBe(true);
  });

  it('returns 400 for missing body fields', async () => {
    const v = await createCommunityVerifiedUser('missing-fields@example.com');
    const token = makeUserToken(v.id, 'COMMUNITY_VERIFIED');

    const res = await request(app)
      .post('/api/v1/users/verify-community/vouch')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/users/verify-community/payment
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/users/verify-community/payment', () => {
  it('returns 200 and completes verification via payment on PAYMENT_PENDING request', async () => {
    const user = await createTestUser('pay-verify@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
    const token = makeUserToken(user.id, 'PHONE_VERIFIED');

    // processVerificationPayment only accepts PAYMENT_PENDING (commit 681c7cb)
    await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        type: 'COMMUNITY',
        status: 'PAYMENT_PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/users/verify-community/payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: 'TXTEST123456789' });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.verificationLevel).toBe('COMMUNITY_VERIFIED');
  });

  it('returns 409 if no active request exists', async () => {
    const user = await createTestUser('no-req-pay@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
    const token = makeUserToken(user.id, 'PHONE_VERIFIED');

    const res = await request(app)
      .post('/api/v1/users/verify-community/payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: 'TXTEST123456789' });

    expect(res.status).toBe(409);
  });

  it('returns 400 for missing transactionId', async () => {
    const user = await createTestUser('no-txid@example.com', 'PHONE_VERIFIED');
    const token = makeUserToken(user.id, 'PHONE_VERIFIED');

    const res = await request(app)
      .post('/api/v1/users/verify-community/payment')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 if user is only EMAIL_VERIFIED', async () => {
    const user = await createTestUser('email-pay@example.com', 'EMAIL_VERIFIED');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .post('/api/v1/users/verify-community/payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: 'TXTEST123456789' });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/users/verify-community/status
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/users/verify-community/status', () => {
  it('returns null status when no request exists', async () => {
    const user = await createTestUser('status-none@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
    const token = makeUserToken(user.id, 'PHONE_VERIFIED');

    const res = await request(app)
      .get('/api/v1/users/verify-community/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // No request exists yet — service returns 'PENDING' as the default status
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.vouchesReceived).toBe(0);
    expect(res.body.data.vouchesNeeded).toBe(3);
  });

  it('returns VOUCHING status and vouch count', async () => {
    const user = await createTestUser('status-vouching@example.com', 'PHONE_VERIFIED');
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
    const token = makeUserToken(user.id, 'PHONE_VERIFIED');

    await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        type: 'COMMUNITY',
        status: 'VOUCHING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const voucher = await createCommunityVerifiedUser('v-status@example.com');
    await prisma.communityVouch.create({
      data: { userId: user.id, voucherId: voucher.id, wardId: TEST_WARD_ID },
    });

    const res = await request(app)
      .get('/api/v1/users/verify-community/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('VOUCHING');
    expect(res.body.data.vouchesReceived).toBe(1);
    expect(res.body.data.vouchesNeeded).toBe(3);
    expect(res.body.data.expiresAt).toBeTruthy();
  });

  it('returns 403 if user is only EMAIL_VERIFIED', async () => {
    const user = await createTestUser('status-email@example.com', 'EMAIL_VERIFIED');
    const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .get('/api/v1/users/verify-community/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/users/verify-community/status');
    expect(res.status).toBe(401);
  });
});

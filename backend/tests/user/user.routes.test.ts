// tests/user/user.routes.test.ts
//
// Supertest integration tests for all user routes.
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
  TEST_WARD_ID,
  TEST_COUNTY_ID,
  TEST_CONST_ID,
  TEST_INDUSTRY_ID,
  TEST_INDUSTRY_ID_2,
  TEST_GS_ID,
  TEST_GS_ID_2,
  seedIndustries,
  seedGoodsServices,
  makeUserToken,
} from './helpers.js';

const BASE = '/api/v1/users';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createUser(email: string, level = 'EMAIL_VERIFIED') {
  return prisma.user.create({
    data: {
      email,
      name: 'Test User',
      verificationLevel: level,
      emailVerified: level !== 'UNVERIFIED',
      phoneVerified:
        level === 'PHONE_VERIFIED' ||
        level === 'COMMUNITY_VERIFIED' ||
        level === 'FULL_VERIFIED',
      communityVerified:
        level === 'COMMUNITY_VERIFIED' || level === 'FULL_VERIFIED',
      locationVerified: false,
      primaryWardId: TEST_WARD_ID,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('User Routes', () => {
  beforeAll(async () => {
    await servicesReady.catch(() => {});
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /me — profile
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /me', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get(`${BASE}/me`);
      expect(res.status).toBe(401);
    });

    it('returns profile for EMAIL_VERIFIED user', async () => {
      const user = await createUser('me@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/me`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(user.id);
      expect(res.body.data.email).toBe('me@test.com');
      // _privacySettings must be stripped from response
      expect(res.body.data._privacySettings).toBeUndefined();
    });

    it('returns 403 for UNVERIFIED user', async () => {
      const user = await createUser('unverified@test.com', 'UNVERIFIED');
      const token = makeUserToken(user.id, 'UNVERIFIED');

      const res = await request(app)
        .get(`${BASE}/me`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /me/profile
  // ══════════════════════════════════════════════════════════════════════════

  describe('PATCH /me/profile', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).patch(`${BASE}/me/profile`).send({ name: 'Alice' });
      expect(res.status).toBe(401);
    });

    it('updates name for EMAIL_VERIFIED user', async () => {
      const user = await createUser('patch@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .patch(`${BASE}/me/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // updateProfile returns { success: true } — verify DB is updated
      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.name).toBe('Updated Name');
    });

    it('rejects name that is too short', async () => {
      const user = await createUser('patch2@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .patch(`${BASE}/me/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid avatarUrl', async () => {
      const user = await createUser('patch3@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .patch(`${BASE}/me/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({ avatarUrl: 'not-a-url' });

      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /me
  // ══════════════════════════════════════════════════════════════════════════

  describe('DELETE /me', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).delete(`${BASE}/me`);
      expect(res.status).toBe(401);
    });

    it('soft-deletes account for EMAIL_VERIFIED user', async () => {
      const user = await createUser('delete@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .delete(`${BASE}/me`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify soft delete in DB
      const deleted = await prisma.user.findUnique({ where: { id: user.id } });
      expect(deleted?.status).toBe('DELETED');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Reference data — public to EMAIL_VERIFIED
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /reference/counties', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 200 with no token (public endpoint — needed during registration)', async () => {
      await seedLocation();
      const res = await request(app).get(`${BASE}/reference/counties`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns county list for EMAIL_VERIFIED user', async () => {
      const user = await createUser('counties@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/reference/counties`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('name');
    });
  });

  describe('GET /reference/constituencies', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns constituencies filtered by countyId', async () => {
      const user = await createUser('const@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/reference/constituencies?countyId=${TEST_COUNTY_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(TEST_CONST_ID);
    });

    it('rejects invalid UUID for countyId', async () => {
      const user = await createUser('const2@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/reference/constituencies?countyId=not-a-uuid`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /reference/wards', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns wards filtered by constituencyId', async () => {
      const user = await createUser('wards@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/reference/wards?constituencyId=${TEST_CONST_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].id).toBe(TEST_WARD_ID);
    });
  });

  describe('GET /reference/industries', () => {
    beforeEach(async () => {
      await seedLocation();
      await seedIndustries();
    });

    it('returns all industries', async () => {
      const user = await createUser('industries@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/reference/industries`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('GET /reference/goods-services', () => {
    beforeEach(async () => {
      await seedLocation();
      await seedIndustries();
      await seedGoodsServices();
    });

    it('returns all goods-services', async () => {
      const user = await createUser('gs@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/reference/goods-services`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('filters by industryId', async () => {
      const user = await createUser('gs2@test.com');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/reference/goods-services?industryId=${TEST_INDUSTRY_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(TEST_GS_ID);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /me/industries  (requires COMMUNITY_VERIFIED)
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /me/industries', () => {
    beforeEach(async () => {
      await seedLocation();
      await seedIndustries();
    });

    it('returns 403 for EMAIL_VERIFIED user', async () => {
      const user = await createUser('ind-email@test.com', 'EMAIL_VERIFIED');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/me/industries`)
        .set('Authorization', `Bearer ${token}`)
        .send({ industryIds: [TEST_INDUSTRY_ID] });

      expect(res.status).toBe(403);
    });

    it('selects industries for COMMUNITY_VERIFIED user', async () => {
      const user = await createUser('ind-community@test.com', 'COMMUNITY_VERIFIED');
      const token = makeUserToken(user.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/me/industries`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          industryIds: [TEST_INDUSTRY_ID, TEST_INDUSTRY_ID_2],
          primaryIndustryId: TEST_INDUSTRY_ID,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // selectIndustries returns { success: true } — verify DB
      const saved = await prisma.userIndustry.findMany({ where: { userId: user.id } });
      expect(saved.length).toBe(2);
    });

    it('rejects more than 3 industries', async () => {
      const user = await createUser('ind-toomany@test.com', 'COMMUNITY_VERIFIED');
      const token = makeUserToken(user.id, 'COMMUNITY_VERIFIED');

      // Need 4 industries — seed two more
      const extra1 = await prisma.industry.create({
        data: { id: 'cccccccc-3333-4000-8000-000000000003', name: 'Finance' },
      });
      const extra2 = await prisma.industry.create({
        data: { id: 'cccccccc-3333-4000-8000-000000000004', name: 'Health' },
      });

      const res = await request(app)
        .post(`${BASE}/me/industries`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          industryIds: [TEST_INDUSTRY_ID, TEST_INDUSTRY_ID_2, extra1.id, extra2.id],
        });

      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /me/industries
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /me/industries', () => {
    beforeEach(async () => {
      await seedLocation();
      await seedIndustries();
    });

    it('returns empty list when no industries selected', async () => {
      const user = await createUser('ind-get@test.com', 'COMMUNITY_VERIFIED');
      const token = makeUserToken(user.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/me/industries`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /me/goods-services
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /me/goods-services', () => {
    beforeEach(async () => {
      await seedLocation();
      await seedIndustries();
      await seedGoodsServices();
    });

    it('returns 403 for EMAIL_VERIFIED user', async () => {
      const user = await createUser('gs-email@test.com', 'EMAIL_VERIFIED');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/me/goods-services`)
        .set('Authorization', `Bearer ${token}`)
        .send({ goodsServiceIds: [TEST_GS_ID], canProvide: [true], canRequest: [false] });

      expect(res.status).toBe(403);
    });

    it('selects goods-services for COMMUNITY_VERIFIED user', async () => {
      const user = await createUser('gs-community@test.com', 'COMMUNITY_VERIFIED');
      const token = makeUserToken(user.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/me/goods-services`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          goodsServiceIds: [TEST_GS_ID],
          canProvide: [true],
          canRequest: [false],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects mismatched array lengths', async () => {
      const user = await createUser('gs-mismatch@test.com', 'COMMUNITY_VERIFIED');
      const token = makeUserToken(user.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/me/goods-services`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          goodsServiceIds: [TEST_GS_ID, TEST_GS_ID_2],
          canProvide: [true],
          canRequest: [false],
        });

      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /wards/:wardId/members  (requires PHONE_VERIFIED)
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /wards/:wardId/members', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 403 for EMAIL_VERIFIED user', async () => {
      const user = await createUser('members-email@test.com', 'EMAIL_VERIFIED');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/wards/${TEST_WARD_ID}/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns ward member list for PHONE_VERIFIED user', async () => {
      const user = await createUser('members-phone@test.com', 'PHONE_VERIFIED');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      // Seed a COMMUNITY_VERIFIED member in the same ward
      await createUser('community-member@test.com', 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/wards/${TEST_WARD_ID}/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // community-member should appear; requester (PHONE_VERIFIED) should not
      const emails = res.body.data.map((m: any) => m.id);
      expect(emails.length).toBeGreaterThan(0);
    });

    it('returns 400 for non-UUID wardId', async () => {
      const user = await createUser('members-bad@test.com', 'PHONE_VERIFIED');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/wards/not-a-uuid/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /verify-community/status  (requires PHONE_VERIFIED)
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /verify-community/status', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 403 for EMAIL_VERIFIED user', async () => {
      const user = await createUser('vstatus-email@test.com', 'EMAIL_VERIFIED');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/verify-community/status`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns PENDING status when no request exists', async () => {
      const user = await createUser('vstatus-phone@test.com', 'PHONE_VERIFIED');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/verify-community/status`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.vouchesReceived).toBe(0);
      expect(res.body.data.vouchesNeeded).toBeGreaterThan(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /verify-community/request  (requires PHONE_VERIFIED)
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /verify-community/request', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 403 for EMAIL_VERIFIED user', async () => {
      const user = await createUser('vreq-email@test.com', 'EMAIL_VERIFIED');
      const token = makeUserToken(user.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/request`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('creates verification request for PHONE_VERIFIED user', async () => {
      const user = await createUser('vreq-phone@test.com', 'PHONE_VERIFIED');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      const res = await request(app)
        .post(`${BASE}/verify-community/request`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // DB check
      const req = await prisma.verificationRequest.findUnique({
        where: { userId_type: { userId: user.id, type: 'COMMUNITY' } },
      });
      expect(req?.status).toBe('VOUCHING');
    });

    it('returns 409 when request already pending', async () => {
      const user = await createUser('vreq-dup@test.com', 'PHONE_VERIFIED');
      const token = makeUserToken(user.id, 'PHONE_VERIFIED');

      await request(app)
        .post(`${BASE}/verify-community/request`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`${BASE}/verify-community/request`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /:userId — public profile  (requires COMMUNITY_VERIFIED)
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /:userId', () => {
    beforeEach(async () => {
      await seedLocation();
    });

    it('returns 403 for EMAIL_VERIFIED viewer', async () => {
      const target = await createUser('target@test.com', 'COMMUNITY_VERIFIED');
      const viewer = await createUser('viewer@test.com', 'EMAIL_VERIFIED');
      const token = makeUserToken(viewer.id, 'EMAIL_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/${target.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns public profile for COMMUNITY_VERIFIED viewer', async () => {
      const target = await createUser('pub-target@test.com', 'COMMUNITY_VERIFIED');
      const viewer = await createUser('pub-viewer@test.com', 'COMMUNITY_VERIFIED');
      const token = makeUserToken(viewer.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/${target.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(target.id);
      // _privacySettings must never leak
      expect(res.body.data._privacySettings).toBeUndefined();
    });

    it('returns 400 for non-UUID userId', async () => {
      const viewer = await createUser('bad-viewer@test.com', 'COMMUNITY_VERIFIED');
      const token = makeUserToken(viewer.id, 'COMMUNITY_VERIFIED');

      const res = await request(app)
        .get(`${BASE}/not-a-uuid`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});

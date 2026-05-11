/**
 * @file tests/community/conflict.test.ts
 * Service unit tests + route integration tests for ConflictService.
 *
 * auditService mocked — conflict service logs with real userIds but we
 * avoid the DB write to keep service tests focused on conflict logic.
 */

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

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

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import { conflictService } from '../../src/modules/community/services/conflict.service.js';
import {
  seedLocation,
  createCommunityTestUser,
  makeCommunityToken,
} from './helpers.js';

const BASE = '/api/v1/conflicts';

// ─────────────────────────────────────────────────────────────────────────────
// Service unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ConflictService', () => {
  let userId1: string;
  let userId2: string;
  let userId3: string;

  beforeEach(async () => {
    await seedLocation();
    const u1 = await createCommunityTestUser(`cs-u1-${Date.now()}@test.com`);
    const u2 = await createCommunityTestUser(`cs-u2-${Date.now()}@test.com`);
    const u3 = await createCommunityTestUser(`cs-u3-${Date.now()}@test.com`);
    userId1 = u1.id;
    userId2 = u2.id;
    userId3 = u3.id;
  });

  // ── fileConflict ──────────────────────────────────────────────────────────

  describe('fileConflict()', () => {
    it('creates a conflict case between two users', async () => {
      const result = await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      expect(result.id).toBeDefined();
      expect(result.complainantId).toBe(userId1);
      expect(result.respondentId).toBe(userId2);
      expect(result.status).toBe('OPEN');
    });

    it('stores optional evidence array', async () => {
      const result = await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
        evidence: ['https://example.com/screenshot.png'],
      });
      expect(result.evidence).toContain('https://example.com/screenshot.png');
    });

    it('throws 400 when complainant equals respondent', async () => {
      await expect(
        conflictService.fileConflict(userId1, {
          respondentId: userId1,
          description: 'Self-conflict attempt description here',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 404 when respondent does not exist', async () => {
      await expect(
        conflictService.fileConflict(userId1, {
          respondentId: '00000000-0000-0000-0000-000000000000',
          description: 'Unknown respondent description here',
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── listUserCases ─────────────────────────────────────────────────────────

  describe('listUserCases()', () => {
    it('returns empty array when user has no cases', async () => {
      const cases = await conflictService.listUserCases(userId1);
      expect(cases).toEqual([]);
    });

    it('returns cases where user is complainant', async () => {
      await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      const cases = await conflictService.listUserCases(userId1);
      expect(cases).toHaveLength(1);
      expect(cases[0].complainant.id).toBe(userId1);
    });

    it('returns cases where user is respondent', async () => {
      await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      const cases = await conflictService.listUserCases(userId2);
      expect(cases).toHaveLength(1);
      expect(cases[0].respondent.id).toBe(userId2);
    });
  });

  // ── getCase ───────────────────────────────────────────────────────────────

  describe('getCase()', () => {
    it('returns the case for the complainant', async () => {
      const filed = await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      const found = await conflictService.getCase(userId1, filed.id);
      expect(found.id).toBe(filed.id);
    });

    it('returns the case for the respondent', async () => {
      const filed = await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      const found = await conflictService.getCase(userId2, filed.id);
      expect(found.id).toBe(filed.id);
    });

    it('throws 404 for an unknown case ID', async () => {
      await expect(
        conflictService.getCase(userId1, '00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when user is not a party to the case', async () => {
      const filed = await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      await expect(
        conflictService.getCase(userId3, filed.id)
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ── resolveCase ───────────────────────────────────────────────────────────

  describe('resolveCase()', () => {
    it('marks a case as CLOSED with resolution text and mediatorId', async () => {
      const filed = await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      const resolved = await conflictService.resolveCase(
        userId3,
        filed.id,
        'Both parties agreed to settle the dispute amicably'
      );
      expect(resolved.status).toBe('CLOSED');
      expect(resolved.resolution).toBe(
        'Both parties agreed to settle the dispute amicably'
      );
      expect(resolved.mediatorId).toBe(userId3);
      expect(resolved.resolvedAt).not.toBeNull();
    });

    it('throws 404 for an unknown case', async () => {
      await expect(
        conflictService.resolveCase(
          userId1,
          '00000000-0000-0000-0000-000000000000',
          'Resolution for unknown case'
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when case is already closed', async () => {
      const filed = await conflictService.fileConflict(userId1, {
        respondentId: userId2,
        description: 'A long enough description for this conflict case test',
      });
      await conflictService.resolveCase(
        userId3,
        filed.id,
        'First resolution attempt here'
      );
      await expect(
        conflictService.resolveCase(
          userId3,
          filed.id,
          'Second resolution attempt here'
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Conflict Routes', () => {
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;
  let token1: string;
  let token2: string;
  let token3: string;

  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    await seedLocation();
    const u1 = await createCommunityTestUser(`cr-u1-${Date.now()}@test.com`);
    const u2 = await createCommunityTestUser(`cr-u2-${Date.now()}@test.com`);
    const u3 = await createCommunityTestUser(`cr-u3-${Date.now()}@test.com`);
    user1Id = u1.id;
    user2Id = u2.id;
    user3Id = u3.id;
    token1 = makeCommunityToken(user1Id);
    token2 = makeCommunityToken(user2Id);
    token3 = makeCommunityToken(user3Id);
  });

  // ── POST /conflicts ───────────────────────────────────────────────────────

  describe('POST /conflicts', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).post(BASE).send({
        respondentId: '00000000-0000-0000-0000-000000000001',
        description: 'A long enough description for the conflict case',
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when description is too short (< 20 chars)', async () => {
      const res = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({ respondentId: user2Id, description: 'Too short' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when respondentId is not a valid UUID', async () => {
      const res = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: 'not-a-uuid',
          description: 'A long enough description for the conflict case',
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when filing a conflict against yourself', async () => {
      const res = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user1Id,
          description: 'A long enough description for the conflict case test',
        });
      expect(res.status).toBe(400);
    });

    it('files a conflict and returns 201 with case data', async () => {
      const res = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user2Id,
          description: 'A long enough description for this conflict case test',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('OPEN');
    });
  });

  // ── GET /conflicts/my-cases ───────────────────────────────────────────────

  describe('GET /conflicts/my-cases', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).get(`${BASE}/my-cases`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with empty array when no cases', async () => {
      const res = await request(app)
        .get(`${BASE}/my-cases`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns cases the user is involved in', async () => {
      await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user2Id,
          description: 'A long enough description for this conflict case test',
        });
      const res = await request(app)
        .get(`${BASE}/my-cases`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ── GET /conflicts/:caseId ────────────────────────────────────────────────

  describe('GET /conflicts/:caseId', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).get(
        `${BASE}/00000000-0000-0000-0000-000000000000`
      );
      expect(res.status).toBe(401);
    });

    it('returns 200 for the complainant', async () => {
      const filed = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user2Id,
          description: 'A long enough description for this conflict case test',
        });
      const res = await request(app)
        .get(`${BASE}/${filed.body.data.id}`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(filed.body.data.id);
    });

    it('returns 200 for the respondent', async () => {
      const filed = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user2Id,
          description: 'A long enough description for this conflict case test',
        });
      const res = await request(app)
        .get(`${BASE}/${filed.body.data.id}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
    });

    it('returns 404 for an unknown case', async () => {
      const res = await request(app)
        .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 for a user not party to the case', async () => {
      const filed = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user2Id,
          description: 'A long enough description for this conflict case test',
        });
      const res = await request(app)
        .get(`${BASE}/${filed.body.data.id}`)
        .set('Authorization', `Bearer ${token3}`);
      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /conflicts/:caseId/resolve ──────────────────────────────────────

  describe('PATCH /conflicts/:caseId/resolve', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).patch(
        `${BASE}/00000000-0000-0000-0000-000000000000/resolve`
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when resolution text is too short (< 10 chars)', async () => {
      const filed = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user2Id,
          description: 'A long enough description for this conflict case test',
        });
      const res = await request(app)
        .patch(`${BASE}/${filed.body.data.id}/resolve`)
        .set('Authorization', `Bearer ${token3}`)
        .send({ resolution: 'Short' });
      expect(res.status).toBe(400);
    });

    it('resolves the case and returns 200 with CLOSED status', async () => {
      const filed = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          respondentId: user2Id,
          description: 'A long enough description for this conflict case test',
        });
      const res = await request(app)
        .patch(`${BASE}/${filed.body.data.id}/resolve`)
        .set('Authorization', `Bearer ${token3}`)
        .send({
          resolution:
            'Both parties agreed to stop the dispute after mediation session',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CLOSED');
    });
  });
});

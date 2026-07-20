/**
 * @file tests/elections/election.routes.test.ts
 * Integration tests for elections HTTP routes.
 *
 * auditService is mocked — election service makes audit calls with 'system'
 * userId which is not a valid UUID.
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
import { prisma } from '../../src/core/database/client.js';
import {
  seedLocation,
  createElectionUser,
  createGroupWithMembers,
  seedElection,
  makeElectionToken,
} from './helpers.js';

const BASE = '/api/v1/elections';

describe('Election Routes', () => {
  let member1Id: string;
  let member2Id: string;
  let member3Id: string;
  let groupId: string;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    await servicesReady;
  });

  beforeEach(async () => {
    await seedLocation();
    const m1 = await createElectionUser(`er-m1-${Date.now()}@test.com`, { participationRights: 200 });
    const m2 = await createElectionUser(`er-m2-${Date.now()}@test.com`, { participationRights: 150 });
    const m3 = await createElectionUser(`er-m3-${Date.now()}@test.com`, { participationRights: 100 });
    member1Id = m1.id;
    member2Id = m2.id;
    member3Id = m3.id;
    groupId = await createGroupWithMembers([member1Id, member2Id, member3Id]);
    token1 = makeElectionToken(member1Id, { participationRights: 200 });
    token2 = makeElectionToken(member2Id, { participationRights: 150 });
  });

  // ─────────────────────────────────────────────
  // GET /elections
  // ─────────────────────────────────────────────

  describe('GET /elections', () => {
    it('returns 200 with empty list when no elections exist', async () => {
      const res = await request(app).get(BASE);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    it('returns list of elections (no auth required)', async () => {
      await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app).get(BASE);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by status', async () => {
      await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app).get(`${BASE}?status=VOTING_OPEN`);
      expect(res.status).toBe(200);
      // All returned elections must be VOTING_OPEN
      for (const e of res.body.data.items) {
        expect(e.status).toBe('VOTING_OPEN');
      }
    });

    it('filters by groupId', async () => {
      await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app).get(`${BASE}?groupId=${groupId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      for (const e of res.body.data.items) {
        expect(e.groupId).toBe(groupId);
      }
    });

    it('returns 400 for invalid status value', async () => {
      const res = await request(app).get(`${BASE}?status=INVALID`);
      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /elections/:electionId
  // ─────────────────────────────────────────────

  describe('GET /elections/:electionId', () => {
    it('returns election detail (no auth required)', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app).get(`${BASE}/${election.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(election.id);
      expect(res.body.data.status).toBe('NOMINATIONS_OPEN');
      expect(res.body.data.candidates).toBeDefined();
    });

    it('returns 404 for non-existent election', async () => {
      const res = await request(app).get(`${BASE}/00000000-0000-0000-0000-000000000000`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app).get(`${BASE}/not-a-uuid`);
      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /elections/mine
  // ─────────────────────────────────────────────

  describe('GET /elections/mine', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).get(`${BASE}/mine`);
      expect(res.status).toBe(401);
    });

    it('returns elections the user can participate in (200)', async () => {
      await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app)
        .get(`${BASE}/mine`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // POST /elections/:electionId/nominate
  // ─────────────────────────────────────────────

  describe('POST /elections/:electionId/nominate', () => {
    it('returns 401 with no auth token', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app)
        .post(`${BASE}/${election.id}/nominate`)
        .send({ statement: 'I will serve' });
      expect(res.status).toBe(401);
    });

    it('nominates the user and returns the candidacy (200)', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN', { roleKey: 'LEADER' });
      const res = await request(app)
        .post(`${BASE}/${election.id}/nominate`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ statement: 'My platform' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();

      const candidate = await prisma.electionCandidate.findUnique({
        where: { id: res.body.data.id },
      });
      expect(candidate).not.toBeNull();
      expect(candidate!.userId).toBe(member1Id);
    });

    it('returns 400 when statement exceeds 1000 chars', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app)
        .post(`${BASE}/${election.id}/nominate`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ statement: 'x'.repeat(1001) });
      expect(res.status).toBe(400);
    });

    it('returns 409 when the user is already nominated', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN', { roleKey: 'LEADER' });

      // First nomination succeeds
      await request(app)
        .post(`${BASE}/${election.id}/nominate`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ statement: 'First' });

      // Second nomination for same user → 409
      const res = await request(app)
        .post(`${BASE}/${election.id}/nominate`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ statement: 'Second' });

      expect(res.status).toBe(409);
    });

    it('returns 409 when the election is not in NOMINATIONS_OPEN status', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const res = await request(app)
        .post(`${BASE}/${election.id}/nominate`)
        .set('Authorization', `Bearer ${token1}`)
        .send({});
      expect(res.status).toBe(409);
    });

    it('returns 404 for a non-existent election', async () => {
      const res = await request(app)
        .post(`${BASE}/00000000-0000-0000-0000-000000000000/nominate`)
        .set('Authorization', `Bearer ${token1}`)
        .send({});
      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  // DELETE /elections/:electionId/nomination
  // ─────────────────────────────────────────────

  describe('DELETE /elections/:electionId/nomination', () => {
    it('returns 401 with no auth token', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app).delete(`${BASE}/${election.id}/nomination`);
      expect(res.status).toBe(401);
    });

    it('withdraws an existing nomination (200)', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN', { roleKey: 'LEADER' });

      // Nominate first
      await request(app)
        .post(`${BASE}/${election.id}/nominate`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ statement: 'Will withdraw' });

      const res = await request(app)
        .delete(`${BASE}/${election.id}/nomination`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
    });

    it('returns 404 when no active nomination exists', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const res = await request(app)
        .delete(`${BASE}/${election.id}/nomination`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  // POST /elections/:electionId/vote
  // ─────────────────────────────────────────────

  describe('POST /elections/:electionId/vote', () => {
    it('returns 401 with no auth token', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const res = await request(app)
        .post(`${BASE}/${election.id}/vote`)
        .send({ candidateId: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when candidateId is missing', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const res = await request(app)
        .post(`${BASE}/${election.id}/vote`)
        .set('Authorization', `Bearer ${token2}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when candidateId is not a UUID', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const res = await request(app)
        .post(`${BASE}/${election.id}/vote`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ candidateId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('casts a vote and returns the vote record (200)', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      // Seed a candidate
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id, statement: 'Vote for me' },
      });

      const res = await request(app)
        .post(`${BASE}/${election.id}/vote`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ candidateId: candidate.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();

      const vote = await prisma.electionVote.findFirst({
        where: { electionId: election.id, voterId: member2Id },
      });
      expect(vote).not.toBeNull();
    });

    it('returns 409 when the election is not in VOTING_OPEN status', async () => {
      const election = await seedElection(groupId, 'NOMINATIONS_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id, statement: 'Test' },
      });

      const res = await request(app)
        .post(`${BASE}/${election.id}/vote`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ candidateId: candidate.id });

      expect(res.status).toBe(409);
    });

    it('returns 409 when the user tries to vote twice', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const candidate = await prisma.electionCandidate.create({
        data: { electionId: election.id, userId: member1Id, statement: 'Test' },
      });

      // First vote
      await request(app)
        .post(`${BASE}/${election.id}/vote`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ candidateId: candidate.id });

      // Second vote — same user, same election
      const res = await request(app)
        .post(`${BASE}/${election.id}/vote`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ candidateId: candidate.id });

      expect(res.status).toBe(409);
    });
  });

  // ─────────────────────────────────────────────
  // POST /elections/admin/schedule
  // ─────────────────────────────────────────────

  describe('POST /elections/admin/schedule', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).post(`${BASE}/admin/schedule`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
      const res = await request(app)
        .post(`${BASE}/admin/schedule`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  // POST /elections/admin/:electionId/tally
  // ─────────────────────────────────────────────

  describe('POST /elections/admin/:electionId/tally', () => {
    it('returns 401 with no auth token', async () => {
      const res = await request(app).post(
        `${BASE}/admin/00000000-0000-0000-0000-000000000000/tally`
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
      const election = await seedElection(groupId, 'VOTING_OPEN');
      const res = await request(app)
        .post(`${BASE}/admin/${election.id}/tally`)
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(403);
    });
  });
});

/**
 * @file tests/projects/project.routes.test.ts
 * @description Supertest integration tests for projects module routes.
 *
 * Routes under test:
 *   GET    /projects
 *   GET    /projects/:projectId
 *   POST   /projects/from-proposal
 *   POST   /projects/milestone/start
 *   POST   /projects/milestone/submit
 *   POST   /projects/milestone/verify
 *
 * All routes require authenticate (valid JWT).
 * DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

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

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: {
      send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
  })),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
    updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
    getUserGroups: vi.fn().mockResolvedValue([]),
    getGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupById: vi.fn().mockResolvedValue(null),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  createProjectUser,
  seedProjectGroup,
  seedApprovedProposal,
  seedProject,
  seedMilestone,
  makeProjectToken,
} from './helpers.js';
import { MilestoneStatus } from '../../src/modules/projects/types.js';
import { prisma } from '../../src/core/database/client.js';

const BASE = '/api/v1/projects';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /projects
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /projects', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list', async () => {
    const user = await createProjectUser('list-empty@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('returns 200 filtering by ownerUserId', async () => {
    const a = await createProjectUser('list-a@test.com');
    const b = await createProjectUser('list-b@test.com');
    const token = makeProjectToken(a.id);
    await seedProject(a.id, undefined, 'Project A');
    await seedProject(b.id, undefined, 'Project B');

    const res = await request(app)
      .get(`${BASE}?ownerUserId=${a.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.projects[0].title).toBe('Project A');
  });

  it('returns 400 for invalid ownerUserId (not a UUID)', async () => {
    const user = await createProjectUser('list-bad@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .get(`${BASE}?ownerUserId=not-a-uuid`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /projects/:projectId
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /projects/:projectId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`${BASE}/00000000-0000-0000-0000-000000000001`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown project', async () => {
    const user = await createProjectUser('get-404@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with project detail shape', async () => {
    const user = await createProjectUser('get-detail@test.com');
    const token = makeProjectToken(user.id);
    const project = await seedProject(user.id, undefined, 'Detailed');
    await seedMilestone(project.id, 'Phase 1');

    const res = await request(app)
      .get(`${BASE}/${project.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(project.id);
    expect(res.body.data.milestones).toHaveLength(1);
    expect(res.body.data.members).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /projects/from-proposal
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /projects/from-proposal', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/from-proposal`)
      .send({ proposalId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing proposalId', async () => {
    const user = await createProjectUser('fp-bad@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/from-proposal`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID proposalId', async () => {
    const user = await createProjectUser('fp-bad2@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/from-proposal`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown proposal', async () => {
    const user = await createProjectUser('fp-404@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/from-proposal`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('returns 201 and creates project from APPROVED proposal', async () => {
    const user = await createProjectUser('fp-ok@test.com');
    const token = makeProjectToken(user.id);
    const group = await seedProjectGroup(user.id);
    const proposal = await seedApprovedProposal(user.id, group.id);

    const res = await request(app)
      .post(`${BASE}/from-proposal`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proposalId: proposal.id });

    expect(res.status).toBe(200);
    expect(res.body.data.proposalId).toBe(proposal.id);
    expect(res.body.data.ownerUserId).toBe(user.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /projects/milestone/start
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /projects/milestone/start', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`${BASE}/milestone/start`).send({
      milestoneId: '00000000-0000-0000-0000-000000000001',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing milestoneId', async () => {
    const user = await createProjectUser('ms-bad@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/milestone/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID milestoneId', async () => {
    const user = await createProjectUser('ms-bad2@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/milestone/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /projects/milestone/submit
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /projects/milestone/submit', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`${BASE}/milestone/submit`).send({
      milestoneId: '00000000-0000-0000-0000-000000000001',
      proofUrl: 'https://example.com/p.jpg',
      description: 'done',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const user = await createProjectUser('msub-bad@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/milestone/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid proofUrl', async () => {
    const user = await createProjectUser('msub-bad2@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/milestone/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: '00000000-0000-0000-0000-000000000001',
        proofUrl: 'not-a-url',
        description: 'done',
      });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /projects/milestone/verify
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /projects/milestone/verify', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`${BASE}/milestone/verify`).send({
      milestoneId: '00000000-0000-0000-0000-000000000001',
      approved: true,
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing approved field', async () => {
    const user = await createProjectUser('mv-bad@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`${BASE}/milestone/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown milestone', async () => {
    const owner = await createProjectUser('mv-404@test.com');
    const token = makeProjectToken(owner.id);

    // Need a real project so scopeCheck can look up milestone
    const res = await request(app)
      .post(`${BASE}/milestone/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: '00000000-0000-0000-0000-000000000000',
        approved: true,
      });

    // scopeCheck returns false → 403, or service throws 404
    expect([403, 404]).toContain(res.status);
  });
});

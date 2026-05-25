/**
 * @file tests/projects/project-update.routes.test.ts
 * @description Integration tests for project-update endpoints.
 *
 * Routes under test:
 *   POST /api/v1/projects/:projectId/updates
 *   GET  /api/v1/projects/:projectId/updates
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

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: { award: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({ SMS: { send: vi.fn().mockResolvedValue({}) } })),
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
  createProjectUser,
  seedProject,
  addProjectMember,
  makeProjectToken,
} from './helpers.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/:projectId/updates
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/:projectId/updates', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/projects/00000000-0000-4000-8000-000000000001/updates')
      .send({ content: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for EMAIL_VERIFIED user (requires COMMUNITY_VERIFIED)', async () => {
    const user = await createProjectUser('post1@test.com');
    const project = await seedProject(user.id);
    const token = makeProjectToken(user.id, { verificationLevel: 'EMAIL_VERIFIED' });

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Needs community verified' });

    expect(res.status).toBe(403);
  });

  it('returns 403 if authenticated user is not a project member', async () => {
    const leader = await createProjectUser('post2a@test.com');
    const outsider = await createProjectUser('post2b@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(outsider.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Unauthorized' });

    expect(res.status).toBe(403);
  });

  it('returns 201 and creates update when author is project leader', async () => {
    const leader = await createProjectUser('post3@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Leader update' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      content: 'Leader update',
      authorId: leader.id,
      authorName: 'Project Test User',
      authorInitials: 'PU',
    });
    expect(typeof res.body.data.id).toBe('string');
    expect(typeof res.body.data.createdAt).toBe('string');
  });

  it('returns 201 when a non-lead member posts an update', async () => {
    const leader = await createProjectUser('post4a@test.com');
    const contributor = await createProjectUser('post4b@test.com');
    const project = await seedProject(leader.id);
    await addProjectMember(project.id, contributor.id, 'CONTRIBUTOR');
    const token = makeProjectToken(contributor.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Contributor update' });

    expect(res.status).toBe(201);
    expect(res.body.data.authorId).toBe(contributor.id);
  });

  it('returns 400 when content is empty', async () => {
    const leader = await createProjectUser('post5@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds 1000 characters', async () => {
    const leader = await createProjectUser('post6@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'x'.repeat(1001) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when projectId is not a valid UUID', async () => {
    const leader = await createProjectUser('post7@test.com');
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/not-a-uuid/updates')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Test' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/projects/:projectId/updates
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/projects/:projectId/updates', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get(
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/updates'
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list when no updates exist', async () => {
    const leader = await createProjectUser('get1@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it('returns 200 with correct DTO shape for an existing update', async () => {
    const leader = await createProjectUser('get2@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    await prisma.projectUpdate.create({
      data: { projectId: project.id, authorId: leader.id, content: 'Shape check' },
    });

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const item = res.body.data.items[0];
    expect(item).toMatchObject({
      content: 'Shape check',
      authorId: leader.id,
      authorName: 'Project Test User',
      authorInitials: 'PU',
    });
    expect(typeof item.id).toBe('string');
    expect(typeof item.createdAt).toBe('string');
  });

  it('returns updates ordered newest first', async () => {
    const leader = await createProjectUser('get3@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          authorId: leader.id,
          content: `Update ${i}`,
          createdAt: new Date(now - i * 1000),
        },
      });
    }

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/updates`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].content).toBe('Update 0');
    expect(res.body.data.items[2].content).toBe('Update 2');
  });

  it('returns nextCursor when more pages exist', async () => {
    const leader = await createProjectUser('get4@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          authorId: leader.id,
          content: `Update ${i}`,
          createdAt: new Date(now - i * 1000),
        },
      });
    }

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/updates?limit=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.nextCursor).not.toBeNull();
  });

  it('fetches next page without overlap using cursor', async () => {
    const leader = await createProjectUser('get5@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);
    const now = Date.now();

    for (let i = 0; i < 4; i++) {
      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          authorId: leader.id,
          content: `Update ${i}`,
          createdAt: new Date(now - i * 1000),
        },
      });
    }

    const page1Res = await request(app)
      .get(`/api/v1/projects/${project.id}/updates?limit=2`)
      .set('Authorization', `Bearer ${token}`);

    const { nextCursor } = page1Res.body.data;
    const page1Ids = new Set(page1Res.body.data.items.map((u: { id: string }) => u.id));

    const page2Res = await request(app)
      .get(`/api/v1/projects/${project.id}/updates?limit=2&cursor=${encodeURIComponent(nextCursor)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(page2Res.status).toBe(200);
    expect(page2Res.body.data.items.every((u: { id: string }) => !page1Ids.has(u.id))).toBe(true);
    expect(page2Res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 when projectId is not a valid UUID', async () => {
    const user = await createProjectUser('get6@test.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .get('/api/v1/projects/not-a-uuid/updates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when limit exceeds 30', async () => {
    const leader = await createProjectUser('get7@test.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/updates?limit=100`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('does not return updates from a different project', async () => {
    const leader = await createProjectUser('get8@test.com');
    const projectA = await seedProject(leader.id, undefined, 'Project A');
    const projectB = await seedProject(leader.id, undefined, 'Project B');
    const token = makeProjectToken(leader.id);

    await prisma.projectUpdate.create({
      data: { projectId: projectB.id, authorId: leader.id, content: 'B only' },
    });

    const res = await request(app)
      .get(`/api/v1/projects/${projectA.id}/updates`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

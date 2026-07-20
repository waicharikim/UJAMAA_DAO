/**
 * @file tests/projects/task-board.routes.test.ts
 * @description Integration tests for task board and member contribution endpoints.
 *
 * Routes under test:
 *   POST  /api/v1/projects/tasks                     — create task (leader only)
 *   GET   /api/v1/projects/:projectId/tasks           — list tasks (filterable)
 *   GET   /api/v1/projects/:projectId/contributions   — member contribution breakdown
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

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import { prisma } from '../../src/core/database/client.js';
import {
  createProjectUser,
  seedProject,
  seedMilestone,
  addProjectMember,
  makeProjectToken,
} from './helpers.js';
import { MilestoneStatus } from '../../src/modules/projects/types.js';

beforeAll(async () => {
  await servicesReady;
});

// ── local seed helpers ────────────────────────────────────────────────────────

async function seedTask(
  milestoneId: string,
  projectId: string,
  overrides: {
    title?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
    skillCategory?: string;
    assignedToId?: string;
  } = {}
) {
  return prisma.task.create({
    data: {
      milestoneId,
      projectId,
      title: overrides.title ?? 'Test Task',
      description: 'Task description',
      status: overrides.status ?? 'TODO',
      skillCategory: overrides.skillCategory ?? null,
      assignedToId: overrides.assignedToId ?? null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/tasks
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/tasks', () => {
  it('returns 201 and creates task with all fields', async () => {
    const leader = await createProjectUser('tb-create-leader@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'MS1', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        title: 'Lay foundation concrete',
        description: 'Mix and pour concrete for the base slab',
        skillCategory: 'MASONRY',
        maxAssignees: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Lay foundation concrete');
    expect(res.body.data.status).toBe('TODO');
    expect(res.body.data.skillCategory).toBe('MASONRY');
    expect(res.body.data.maxAssignees).toBe(3);
    expect(res.body.data.milestoneId).toBe(milestone.id);
    expect(res.body.data.projectId).toBe(project.id);
    expect(res.body.data.assignedTo).toBeNull();
    expect(res.body.data.id).toBeDefined();

    const saved = await prisma.task.findUnique({ where: { id: res.body.data.id } });
    expect(saved).not.toBeNull();
    expect(saved!.skillCategory).toBe('MASONRY');
  });

  it('returns 201 with minimal payload (title + milestoneId only)', async () => {
    const leader = await createProjectUser('tb-create-min@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'MS-min', MilestoneStatus.PENDING);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, title: 'Simple task' });

    expect(res.status).toBe(201);
    expect(res.body.data.skillCategory).toBeNull();
    expect(res.body.data.maxAssignees).toBe(1);
  });

  it('returns 403 if user is a contributor (not leader)', async () => {
    const leader = await createProjectUser('tb-create-lead2@example.com');
    const contributor = await createProjectUser('tb-create-contrib@example.com');
    const project = await seedProject(leader.id);
    await addProjectMember(project.id, contributor.id, 'CONTRIBUTOR');
    const milestone = await seedMilestone(project.id, 'MS2', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(contributor.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, title: 'Unauthorized task' });

    expect(res.status).toBe(403);
  });

  it('returns 403 if user is not a project member at all', async () => {
    const leader = await createProjectUser('tb-create-lead3@example.com');
    const outsider = await createProjectUser('tb-create-outsider@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'MS3', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(outsider.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, title: 'Outsider task' });

    expect(res.status).toBe(403);
  });

  it('returns 400 if title is missing', async () => {
    const leader = await createProjectUser('tb-create-notitle@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'MS4', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid skillCategory', async () => {
    const leader = await createProjectUser('tb-create-badskill@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'MS5', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        title: 'Bad skill task',
        skillCategory: 'JUGGLING',
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 if milestone does not exist', async () => {
    const leader = await createProjectUser('tb-create-noms@example.com');
    await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: '00000000-0000-4000-8000-000000000099',
        title: 'Ghost milestone task',
      });

    expect(res.status).toBe(404);
  });

  it('returns 403 if user lacks COMMUNITY_VERIFIED', async () => {
    const leader = await createProjectUser('tb-create-unver-lead@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'MS6', MilestoneStatus.IN_PROGRESS);
    const unverified = await prisma.user.create({
      data: {
        email: 'tb-create-unver@example.com',
        name: 'Unverified',
        verificationLevel: 'PHONE_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: false,
        locationVerified: false,
      },
    });
    const token = makeProjectToken(unverified.id, {
      verificationLevel: 'PHONE_VERIFIED',
      communityVerified: false,
    });

    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, title: 'Unverified task' });

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/projects/tasks')
      .send({ milestoneId: '00000000-0000-4000-8000-000000000001', title: 'no auth' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/projects/:projectId/tasks
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/projects/:projectId/tasks', () => {
  it('returns 200 with tasks array and correct shape', async () => {
    const owner = await createProjectUser('tb-list-owner@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'MS-list', MilestoneStatus.IN_PROGRESS);
    await seedTask(milestone.id, project.id, { title: 'Task A', skillCategory: 'FARMING' });
    await seedTask(milestone.id, project.id, { title: 'Task B', status: 'IN_PROGRESS', assignedToId: owner.id });
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(2);
    expect(res.body.data.total).toBe(2);

    const taskA = res.body.data.tasks.find((t: any) => t.title === 'Task A');
    expect(taskA.skillCategory).toBe('FARMING');
    expect(taskA.status).toBe('TODO');
    expect(taskA.assignedTo).toBeNull();

    const taskB = res.body.data.tasks.find((t: any) => t.title === 'Task B');
    expect(taskB.status).toBe('IN_PROGRESS');
    expect(taskB.assignedTo).not.toBeNull();
    expect(taskB.assignedTo.id).toBe(owner.id);
  });

  it('filters by status=TODO returns only open tasks', async () => {
    const owner = await createProjectUser('tb-list-status@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'MS-status', MilestoneStatus.IN_PROGRESS);
    await seedTask(milestone.id, project.id, { title: 'Open task', status: 'TODO' });
    await seedTask(milestone.id, project.id, { title: 'Done task', status: 'DONE', assignedToId: owner.id });
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks?status=TODO`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].title).toBe('Open task');
    expect(res.body.data.total).toBe(1);
  });

  it('filters by skillCategory returns only matching tasks', async () => {
    const owner = await createProjectUser('tb-list-skill@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'MS-skill', MilestoneStatus.IN_PROGRESS);
    await seedTask(milestone.id, project.id, { title: 'Electric task', skillCategory: 'ELECTRICAL' });
    await seedTask(milestone.id, project.id, { title: 'General task', skillCategory: 'GENERAL' });
    await seedTask(milestone.id, project.id, { title: 'No skill task' });
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks?skillCategory=ELECTRICAL`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].title).toBe('Electric task');
  });

  it('returns empty array for project with no tasks', async () => {
    const owner = await createProjectUser('tb-list-empty@example.com');
    const project = await seedProject(owner.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('returns 400 for invalid projectId (not a UUID)', async () => {
    const user = await createProjectUser('tb-list-badid@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .get('/api/v1/projects/not-a-uuid/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status filter', async () => {
    const owner = await createProjectUser('tb-list-badstatus@example.com');
    const project = await seedProject(owner.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks?status=INVALID`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/tasks'
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/projects/:projectId/contributions
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/projects/:projectId/contributions', () => {
  it('returns 200 with all members including those with zero activity', async () => {
    const leader = await createProjectUser('tb-contrib-leader@example.com');
    const member = await createProjectUser('tb-contrib-member@example.com');
    const project = await seedProject(leader.id);
    await addProjectMember(project.id, member.id, 'CONTRIBUTOR');
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/contributions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const leaderRow = res.body.data.find((r: any) => r.userId === leader.id);
    expect(leaderRow).toBeDefined();
    expect(leaderRow.tasksCompleted).toBe(0);
    expect(leaderRow.tasksInProgress).toBe(0);
    expect(leaderRow.hoursLogged).toBe(0);
    expect(leaderRow.sessionsAttended).toBe(0);
    expect(leaderRow.impactPointsEarned).toBe(0);
    expect(leaderRow.user.id).toBe(leader.id);
  });

  it('reflects completed tasks in the contribution counts', async () => {
    const leader = await createProjectUser('tb-contrib-tasks-lead@example.com');
    const worker = await createProjectUser('tb-contrib-tasks-worker@example.com');
    const project = await seedProject(leader.id);
    await addProjectMember(project.id, worker.id, 'CONTRIBUTOR');
    const milestone = await seedMilestone(project.id, 'MS-contrib', MilestoneStatus.IN_PROGRESS);

    await seedTask(milestone.id, project.id, { status: 'DONE', assignedToId: worker.id });
    await seedTask(milestone.id, project.id, { status: 'DONE', assignedToId: worker.id });
    await seedTask(milestone.id, project.id, { status: 'IN_PROGRESS', assignedToId: worker.id });

    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/contributions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const workerRow = res.body.data.find((r: any) => r.userId === worker.id);
    expect(workerRow).toBeDefined();
    expect(workerRow.tasksCompleted).toBe(2);
    expect(workerRow.tasksInProgress).toBe(1);
  });

  it('returns empty array for project with no members', async () => {
    // Create a project without adding any members (manually, bypassing seedProject which auto-adds owner)
    const user = await createProjectUser('tb-contrib-nomembers@example.com');
    const project = await prisma.project.create({
      data: {
        title: 'Empty project',
        description: null,
        ownerUserId: user.id,
        status: 'PLANNING',
      },
    });
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/contributions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 400 for invalid projectId', async () => {
    const user = await createProjectUser('tb-contrib-badid@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .get('/api/v1/projects/not-a-uuid/contributions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/contributions'
    );
    expect(res.status).toBe(401);
  });
});

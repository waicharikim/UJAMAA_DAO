/**
 * @file tests/projects/contribution.routes.test.ts
 * @description Integration tests for project contribution endpoints.
 *
 * Routes under test:
 *   POST   /api/v1/projects/:projectId/join
 *   POST   /api/v1/projects/:projectId/contribute
 *   POST   /api/v1/projects/tasks/:taskId/claim
 *   PATCH  /api/v1/projects/tasks/:taskId/done
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
  seedProjectGroup,
} from './helpers.js';
import { MilestoneStatus } from '../../src/modules/projects/types.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function seedTask(
  milestoneId: string,
  projectId: string,
  title = 'Test Task',
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' = 'TODO',
  assignedToId?: string
) {
  return prisma.task.create({
    data: {
      milestoneId,
      projectId,
      title,
      description: 'A test task description',
      status,
      assignedToId: assignedToId ?? null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/:projectId/join
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/:projectId/join', () => {
  it('returns 201 and adds user as CONTRIBUTOR', async () => {
    const owner = await createProjectUser('join-owner@example.com');
    const joiner = await createProjectUser('join-joiner@example.com');
    const project = await seedProject(owner.id);
    const token = makeProjectToken(joiner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/join`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.projectId).toBe(project.id);
    expect(res.body.data.userId).toBe(joiner.id);
    expect(res.body.data.role).toBe('CONTRIBUTOR');
    expect(res.body.data.joinedAt).toBeDefined();

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: joiner.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('CONTRIBUTOR');
  });

  it('returns 409 if user is already a member', async () => {
    const owner = await createProjectUser('join-dup@example.com');
    const project = await seedProject(owner.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/join`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('returns 400 for a COMPLETED project', async () => {
    const owner = await createProjectUser('join-completed@example.com');
    const project = await seedProject(owner.id);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'COMPLETED' },
    });
    const joiner = await createProjectUser('join-completed-joiner@example.com');
    const token = makeProjectToken(joiner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/join`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for a CANCELLED project', async () => {
    const owner = await createProjectUser('join-cancelled@example.com');
    const project = await seedProject(owner.id);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'CANCELLED' },
    });
    const joiner = await createProjectUser('join-cancelled-joiner@example.com');
    const token = makeProjectToken(joiner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/join`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent project', async () => {
    const user = await createProjectUser('join-404@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post('/api/v1/projects/00000000-0000-4000-8000-000000000099/join')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 if user lacks COMMUNITY_VERIFIED', async () => {
    const owner = await createProjectUser('join-unver-owner@example.com');
    const project = await seedProject(owner.id);
    const unverified = await prisma.user.create({
      data: {
        email: 'join-unverified@example.com',
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
      .post(`/api/v1/projects/${project.id}/join`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post(
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/join'
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/:projectId/contribute
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/:projectId/contribute', () => {
  async function createFundedUser(email: string, balance: number) {
    return prisma.user.create({
      data: {
        email,
        name: 'Funded User',
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        locationVerified: false,
        fiatBackedUtBalance: balance,
      },
    });
  }

  it('returns 201, debits user balance, and credits group treasury', async () => {
    const owner = await createFundedUser('contrib-owner@example.com', 500);
    const group = await seedProjectGroup(owner.id);
    const project = await seedProject(owner.id, group.id);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'ACTIVE' },
    });
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200 });

    expect(res.status).toBe(201);
    expect(res.body.data.projectId).toBe(project.id);
    expect(res.body.data.amount).toBe(200);
    expect(res.body.data.newBalance).toBe(300);
    expect(res.body.data.transactionId).toBeDefined();

    const updatedUser = await prisma.user.findUnique({ where: { id: owner.id } });
    expect(Number(updatedUser!.fiatBackedUtBalance)).toBe(300);

    const treasury = await prisma.groupTreasury.findFirst({
      where: { groupId: group.id },
    });
    expect(treasury).not.toBeNull();
    expect(Number(treasury!.balance)).toBeGreaterThanOrEqual(200);

    const tx = await prisma.walletTransaction.findFirst({
      where: { projectId: project.id, referenceType: 'PROJECT_CONTRIBUTION' },
    });
    expect(tx).not.toBeNull();
    expect(Number(tx!.amount)).toBe(200);
  });

  it('returns 403 if user has insufficient UT balance', async () => {
    const owner = await createFundedUser('contrib-broke@example.com', 50);
    const group = await seedProjectGroup(owner.id);
    const project = await seedProject(owner.id, group.id);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'ACTIVE' },
    });
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200 });

    expect(res.status).toBe(403);
  });

  it('returns 400 if project has no ownerGroupId', async () => {
    const owner = await createFundedUser('contrib-nogroup@example.com', 500);
    const project = await seedProject(owner.id); // no group
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'ACTIVE' },
    });
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
  });

  it('returns 400 if project is COMPLETED', async () => {
    const owner = await createFundedUser('contrib-completed@example.com', 500);
    const group = await seedProjectGroup(owner.id);
    const project = await seedProject(owner.id, group.id);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'COMPLETED' },
    });
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
  });

  it('returns 400 if amount is 0', async () => {
    const owner = await createFundedUser('contrib-zero@example.com', 500);
    const group = await seedProjectGroup(owner.id);
    const project = await seedProject(owner.id, group.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 if amount exceeds 100,000', async () => {
    const owner = await createFundedUser('contrib-overflow@example.com', 200000);
    const group = await seedProjectGroup(owner.id);
    const project = await seedProject(owner.id, group.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100001 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent project', async () => {
    const user = await createFundedUser('contrib-404@example.com', 500);
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post('/api/v1/projects/00000000-0000-4000-8000-000000000099/contribute')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(404);
  });

  it('returns 403 if user lacks COMMUNITY_VERIFIED', async () => {
    const owner = await createFundedUser('contrib-unver-owner@example.com', 500);
    const group = await seedProjectGroup(owner.id);
    const project = await seedProject(owner.id, group.id);
    const unverified = await prisma.user.create({
      data: {
        email: 'contrib-unverified@example.com',
        name: 'Unverified',
        verificationLevel: 'PHONE_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: false,
        locationVerified: false,
        fiatBackedUtBalance: 500,
      },
    });
    const token = makeProjectToken(unverified.id, {
      verificationLevel: 'PHONE_VERIFIED',
      communityVerified: false,
    });

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/projects/00000000-0000-4000-8000-000000000001/contribute')
      .send({ amount: 100 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/tasks/:taskId/claim
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/tasks/:taskId/claim', () => {
  it('returns 200 and assigns task to the claimant', async () => {
    const owner = await createProjectUser('claim-owner@example.com');
    const claimant = await createProjectUser('claim-member@example.com');
    const project = await seedProject(owner.id);
    await addProjectMember(project.id, claimant.id);
    const milestone = await seedMilestone(project.id, 'Active milestone', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id);
    const token = makeProjectToken(claimant.id);

    const res = await request(app)
      .post(`/api/v1/projects/tasks/${task.id}/claim`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.taskId).toBe(task.id);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.projectId).toBe(project.id);
    expect(res.body.data.milestoneId).toBe(milestone.id);

    const updated = await prisma.task.findUnique({ where: { id: task.id } });
    expect(updated!.assignedToId).toBe(claimant.id);
    expect(updated!.status).toBe('IN_PROGRESS');
  });

  it('returns 403 if user is not a project member', async () => {
    const owner = await createProjectUser('claim-owner2@example.com');
    const outsider = await createProjectUser('claim-outsider@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id);
    const token = makeProjectToken(outsider.id);

    const res = await request(app)
      .post(`/api/v1/projects/tasks/${task.id}/claim`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 if task is already IN_PROGRESS (not TODO)', async () => {
    const owner = await createProjectUser('claim-inprog@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id, 'In-progress task', 'IN_PROGRESS', owner.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/tasks/${task.id}/claim`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 409 if task is already assigned', async () => {
    const owner = await createProjectUser('claim-assigned@example.com');
    const other = await createProjectUser('claim-assigned-other@example.com');
    const project = await seedProject(owner.id);
    await addProjectMember(project.id, other.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id, 'Assigned task', 'TODO', owner.id);
    const token = makeProjectToken(other.id);

    const res = await request(app)
      .post(`/api/v1/projects/tasks/${task.id}/claim`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('returns 400 if milestone is not IN_PROGRESS', async () => {
    const owner = await createProjectUser('claim-pending-ms@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Pending', MilestoneStatus.PENDING);
    const task = await seedTask(milestone.id, project.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post(`/api/v1/projects/tasks/${task.id}/claim`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent task', async () => {
    const user = await createProjectUser('claim-404@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post('/api/v1/projects/tasks/nonexistenttaskid/claim')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post(
      '/api/v1/projects/tasks/nonexistenttaskid/claim'
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/projects/tasks/:taskId/done
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/projects/tasks/:taskId/done', () => {
  it('returns 200, marks task DONE, and reports ipAwarded', async () => {
    const owner = await createProjectUser('done-owner@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id, 'My task', 'IN_PROGRESS', owner.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .patch(`/api/v1/projects/tasks/${task.id}/done`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.taskId).toBe(task.id);
    expect(res.body.data.status).toBe('DONE');
    expect(res.body.data.ipAwarded).toBe(10);

    const updated = await prisma.task.findUnique({ where: { id: task.id } });
    expect(updated!.status).toBe('DONE');
  });

  it('returns 403 if user is not the assigned member', async () => {
    const owner = await createProjectUser('done-owner2@example.com');
    const other = await createProjectUser('done-other@example.com');
    const project = await seedProject(owner.id);
    await addProjectMember(project.id, other.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id, 'Owner task', 'IN_PROGRESS', owner.id);
    const token = makeProjectToken(other.id);

    const res = await request(app)
      .patch(`/api/v1/projects/tasks/${task.id}/done`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 if task status is TODO (not IN_PROGRESS)', async () => {
    const owner = await createProjectUser('done-todo@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id, 'Todo task', 'TODO', owner.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .patch(`/api/v1/projects/tasks/${task.id}/done`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 if task is already DONE', async () => {
    const owner = await createProjectUser('done-already@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const task = await seedTask(milestone.id, project.id, 'Done task', 'DONE', owner.id);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .patch(`/api/v1/projects/tasks/${task.id}/done`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent task', async () => {
    const user = await createProjectUser('done-404@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .patch('/api/v1/projects/tasks/nonexistenttaskid/done')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).patch(
      '/api/v1/projects/tasks/nonexistenttaskid/done'
    );
    expect(res.status).toBe(401);
  });
});

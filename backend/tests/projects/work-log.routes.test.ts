/**
 * @file tests/projects/work-log.routes.test.ts
 * @description Integration tests for work logging endpoints.
 *
 * Routes under test:
 *   POST /api/v1/projects/work-log
 *   POST /api/v1/projects/work-log/verify
 *   GET  /api/v1/projects/milestone/:milestoneId/work-logs
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
  seedMilestone,
  addProjectMember,
  makeProjectToken,
} from './helpers.js';
import { MilestoneStatus } from '../../src/modules/projects/types.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/work-log
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/work-log', () => {
  it('returns 201 and logs work for a project member on an IN_PROGRESS milestone', async () => {
    const owner = await createProjectUser('wl-owner@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Dig foundations', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        workType: 'MANUAL_LABOR',
        description: 'Excavated the eastern section of the borehole site',
        hours: 4,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.workType).toBe('MANUAL_LABOR');
    expect(res.body.data.hours).toBe(4);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.totalIPEarned).toBe(0);
    expect(res.body.data.milestoneId).toBe(milestone.id);
    expect(res.body.data.userId).toBe(owner.id);
  });

  it('returns 400 if milestone is not IN_PROGRESS', async () => {
    const owner = await createProjectUser('wl-pending@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Not started', MilestoneStatus.PENDING);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        workType: 'MANUAL_LABOR',
        description: 'Trying to log on a pending milestone',
        hours: 2,
      });

    expect(res.status).toBe(400);
  });

  it('returns 403 if user is not a project member', async () => {
    const owner = await createProjectUser('wl-owner2@example.com');
    const outsider = await createProjectUser('wl-outsider@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active milestone', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(outsider.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        workType: 'SKILLED_WORK',
        description: 'Non-member trying to log work',
        hours: 3,
      });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid workType', async () => {
    const owner = await createProjectUser('wl-badtype@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        workType: 'INVALID_TYPE',
        description: 'Should be rejected by validator',
        hours: 2,
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 if description is too short', async () => {
    const owner = await createProjectUser('wl-short@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        workType: 'MANUAL_LABOR',
        description: 'Short',
        hours: 2,
      });

    expect(res.status).toBe(400);
  });

  it('returns 403 if user lacks COMMUNITY_VERIFIED', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'wl-unverified@example.com',
        name: 'Unverified',
        verificationLevel: 'PHONE_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: false,
        locationVerified: false,
      },
    });
    const owner = await createProjectUser('wl-owner3@example.com');
    const project = await seedProject(owner.id);
    await addProjectMember(project.id, user.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(user.id, { verificationLevel: 'PHONE_VERIFIED', communityVerified: false });

    const res = await request(app)
      .post('/api/v1/projects/work-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestoneId: milestone.id,
        workType: 'MANUAL_LABOR',
        description: 'Phone verified user trying to log work',
        hours: 2,
      });

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/projects/work-log')
      .send({ milestoneId: '00000000-0000-4000-8000-000000000001', workType: 'MANUAL_LABOR', description: 'x'.repeat(15), hours: 1 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/work-log/verify
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/work-log/verify', () => {
  async function createWorkLog(ownerId: string, milestoneId: string, projectId: string) {
    return prisma.physicalWorkLog.create({
      data: {
        userId: ownerId,
        milestoneId,
        projectId,
        workType: 'MANUAL_LABOR',
        description: 'Dug the eastern trench for the water pipe',
        hours: 3,
        baseIP: 30,
        totalIPEarned: 0,
      },
    });
  }

  it('returns 200 and approves work, awards IP to worker', async () => {
    const leader = await createProjectUser('wlv-leader@example.com');
    const worker = await createProjectUser('wlv-worker@example.com');
    const project = await seedProject(leader.id);
    await addProjectMember(project.id, worker.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const workLog = await createWorkLog(worker.id, milestone.id, project.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ workLogId: workLog.id, approved: true });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.verifiedAt).not.toBeNull();
    expect(res.body.data.totalIPEarned).toBe(30);
  });

  it('returns 200 and rejects work (no IP awarded)', async () => {
    const leader = await createProjectUser('wlv-reject-leader@example.com');
    const worker = await createProjectUser('wlv-reject-worker@example.com');
    const project = await seedProject(leader.id);
    await addProjectMember(project.id, worker.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const workLog = await createWorkLog(worker.id, milestone.id, project.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ workLogId: workLog.id, approved: false, feedback: 'Photo evidence is unclear' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING'); // not verified yet, rejection stored separately
    expect(res.body.data.totalIPEarned).toBe(0);
  });

  it('returns 409 if work already approved', async () => {
    const leader = await createProjectUser('wlv-dup@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const workLog = await prisma.physicalWorkLog.create({
      data: {
        userId: leader.id,
        milestoneId: milestone.id,
        projectId: project.id,
        workType: 'MANUAL_LABOR',
        description: 'Already approved work entry for the borehole',
        hours: 2,
        baseIP: 20,
        totalIPEarned: 20,
        verifiedAt: new Date(),
      },
    });
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ workLogId: workLog.id, approved: true });

    expect(res.status).toBe(409);
  });

  it('returns 403 if user is not project leader or verifier', async () => {
    const owner = await createProjectUser('wlv-owner@example.com');
    const contributor = await createProjectUser('wlv-contrib@example.com');
    const project = await seedProject(owner.id);
    await addProjectMember(project.id, contributor.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const workLog = await createWorkLog(owner.id, milestone.id, project.id);
    const token = makeProjectToken(contributor.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ workLogId: workLog.id, approved: true });

    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown workLogId', async () => {
    const user = await createProjectUser('wlv-unknown@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post('/api/v1/projects/work-log/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ workLogId: '00000000-0000-4000-8000-000000000099', approved: true });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/projects/milestone/:milestoneId/work-logs
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/projects/milestone/:milestoneId/work-logs', () => {
  it('returns work logs for a milestone', async () => {
    const owner = await createProjectUser('wll-owner@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(owner.id);

    // Seed 2 logs
    await prisma.physicalWorkLog.createMany({
      data: [
        {
          userId: owner.id,
          milestoneId: milestone.id,
          projectId: project.id,
          workType: 'MANUAL_LABOR',
          description: 'Cleared the borehole site of debris and vegetation',
          hours: 3,
          baseIP: 30,
          totalIPEarned: 0,
        },
        {
          userId: owner.id,
          milestoneId: milestone.id,
          projectId: project.id,
          workType: 'SKILLED_WORK',
          description: 'Installed casing pipes to the required depth specification',
          hours: 2,
          baseIP: 20,
          totalIPEarned: 0,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/projects/milestone/${milestone.id}/work-logs`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.workLogs).toHaveLength(2);
    expect(res.body.data.workLogs[0].status).toBe('PENDING');
  });

  it('returns empty list for a milestone with no logs', async () => {
    const owner = await createProjectUser('wll-empty@example.com');
    const project = await seedProject(owner.id);
    const milestone = await seedMilestone(project.id, 'Empty', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(owner.id);

    const res = await request(app)
      .get(`/api/v1/projects/milestone/${milestone.id}/work-logs`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.workLogs).toHaveLength(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/projects/milestone/00000000-0000-4000-8000-000000000001/work-logs');
    expect(res.status).toBe(401);
  });
});

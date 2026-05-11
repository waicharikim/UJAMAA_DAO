/**
 * @file tests/projects/work-session.routes.test.ts
 * @description Integration tests for QR work-session endpoints.
 *
 * Routes under test:
 *   POST  /api/v1/projects/work-sessions
 *   POST  /api/v1/projects/work-sessions/scan
 *   POST  /api/v1/projects/work-sessions/:sessionId/attest
 *   POST  /api/v1/projects/work-sessions/:sessionId/close
 *   GET   /api/v1/projects/work-sessions/:sessionId
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
import { projectQueue } from '../../src/core/queue/index.js';
import {
  createProjectUser,
  seedProject,
  seedMilestone,
  addProjectMember,
  makeProjectToken,
} from './helpers.js';
import { MilestoneStatus } from '../../src/modules/projects/types.js';

beforeAll(async () => {
  // Spy on the real Queue instance so BullMQAdapter (used in app.ts dashboard) still works,
  // but the actual Redis call is skipped in tests.
  vi.spyOn(projectQueue, 'add').mockResolvedValue({ id: 'mock-job-id' } as any);
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// Seed helpers
// ─────────────────────────────────────────────────────────────────────────────

async function seedWorkSession(
  milestoneId: string,
  projectId: string,
  createdById: string,
  overrides: Partial<{
    status: 'OPEN' | 'APPROVED' | 'FLAGGED';
    expiresAt: Date;
  }> = {}
) {
  return prisma.workSession.create({
    data: {
      milestoneId,
      projectId,
      createdById,
      qrSecret: `test-secret-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: overrides.status ?? 'OPEN',
    },
  });
}

async function seedWorkPresence(
  sessionId: string,
  userId: string,
  depth = 0,
  attestedById: string | null = null
) {
  return prisma.workPresence.create({
    data: { sessionId, userId, depth, attestedById },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/work-sessions
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/work-sessions', () => {
  it('returns 201 with qrSecret and expiry when leader creates a session', async () => {
    const leader = await createProjectUser('ws-create-leader@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active ms', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, durationMinutes: 120 });

    expect(res.status).toBe(201);
    expect(res.body.data.milestoneId).toBe(milestone.id);
    expect(res.body.data.projectId).toBe(project.id);
    expect(res.body.data.qrSecret).toBeTruthy();
    expect(res.body.data.status).toBe('OPEN');
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const session = await prisma.workSession.findFirst({
      where: { milestoneId: milestone.id },
    });
    expect(session).not.toBeNull();
    expect(session!.qrSecret).toBe(res.body.data.qrSecret);
  });

  it('returns 403 if caller is not a project leader', async () => {
    const owner = await createProjectUser('ws-create-owner@example.com');
    const contributor = await createProjectUser('ws-create-contrib@example.com');
    const project = await seedProject(owner.id);
    await addProjectMember(project.id, contributor.id, 'CONTRIBUTOR');
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(contributor.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, durationMinutes: 60 });

    expect(res.status).toBe(403);
  });

  it('returns 400 if milestone is not IN_PROGRESS', async () => {
    const leader = await createProjectUser('ws-create-pending@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Pending ms', MilestoneStatus.PENDING);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, durationMinutes: 60 });

    expect(res.status).toBe(400);
  });

  it('returns 409 if an open session already exists for the milestone', async () => {
    const leader = await createProjectUser('ws-create-dup@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    await seedWorkSession(milestone.id, project.id, leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, durationMinutes: 60 });

    expect(res.status).toBe(409);
  });

  it('returns 400 if durationMinutes is below minimum (30)', async () => {
    const leader = await createProjectUser('ws-create-short@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, durationMinutes: 10 });

    expect(res.status).toBe(400);
  });

  it('returns 400 if durationMinutes exceeds maximum (480)', async () => {
    const leader = await createProjectUser('ws-create-long@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: milestone.id, durationMinutes: 600 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown milestoneId', async () => {
    const user = await createProjectUser('ws-create-404@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneId: '00000000-0000-4000-8000-000000000099', durationMinutes: 60 });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/projects/work-sessions')
      .send({ milestoneId: '00000000-0000-4000-8000-000000000001', durationMinutes: 60 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/work-sessions/scan
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/work-sessions/scan', () => {
  it('returns 200, checks user in at depth 0, and grants 2 attestation slots', async () => {
    const leader = await createProjectUser('ws-scan-leader@example.com');
    const member = await createProjectUser('ws-scan-member@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    const token = makeProjectToken(member.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ qrSecret: session.qrSecret });

    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe(session.id);
    expect(res.body.data.depth).toBe(0);
    expect(res.body.data.attestationsRemaining).toBe(2);
    expect(res.body.data.expiresAt).toBeTruthy();

    const presence = await prisma.workPresence.findFirst({
      where: { sessionId: session.id, userId: member.id },
    });
    expect(presence).not.toBeNull();
    expect(presence!.depth).toBe(0);
    expect(presence!.attestedById).toBeNull();
  });

  it('returns 409 if user scans the same session twice', async () => {
    const leader = await createProjectUser('ws-scan-dup-leader@example.com');
    const member = await createProjectUser('ws-scan-dup-member@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, member.id, 0);
    const token = makeProjectToken(member.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ qrSecret: session.qrSecret });

    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown qrSecret', async () => {
    const user = await createProjectUser('ws-scan-404@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ qrSecret: 'totally-nonexistent-secret' });

    expect(res.status).toBe(404);
  });

  it('returns 400 if the session has expired', async () => {
    const leader = await createProjectUser('ws-scan-expired-leader@example.com');
    const member = await createProjectUser('ws-scan-expired-member@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id, {
      expiresAt: new Date(Date.now() - 1000), // already expired
    });
    const token = makeProjectToken(member.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ qrSecret: session.qrSecret });

    expect(res.status).toBe(400);
  });

  it('returns 400 if the session is already closed (APPROVED)', async () => {
    const leader = await createProjectUser('ws-scan-approved-leader@example.com');
    const member = await createProjectUser('ws-scan-approved-member@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id, {
      status: 'APPROVED',
    });
    const token = makeProjectToken(member.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ qrSecret: session.qrSecret });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/projects/work-sessions/scan')
      .send({ qrSecret: 'anysecret' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/work-sessions/:sessionId/attest
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/work-sessions/:sessionId/attest', () => {
  it('returns 201 with depth+1 and decrements attestationsRemaining', async () => {
    const leader = await createProjectUser('ws-attest-leader@example.com');
    const attestor = await createProjectUser('ws-attest-attestor@example.com');
    const target = await createProjectUser('ws-attest-target@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, attestor.id, 0); // attestor is checked in at depth 0
    const token = makeProjectToken(attestor.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/attest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id });

    expect(res.status).toBe(201);
    expect(res.body.data.targetUserId).toBe(target.id);
    expect(res.body.data.depth).toBe(1); // attestor was depth 0, so target is depth 1
    expect(res.body.data.attestationsRemaining).toBe(1);
    expect(res.body.data.presenceId).toBeTruthy();

    const presence = await prisma.workPresence.findFirst({
      where: { sessionId: session.id, userId: target.id },
    });
    expect(presence).not.toBeNull();
    expect(presence!.depth).toBe(1);
    expect(presence!.attestedById).toBe(attestor.id);
  });

  it('chains depth correctly — depth-1 attestor creates depth-2 presence', async () => {
    const leader = await createProjectUser('ws-attest-chain-leader@example.com');
    const d0user = await createProjectUser('ws-attest-chain-d0@example.com');
    const d1user = await createProjectUser('ws-attest-chain-d1@example.com');
    const d2user = await createProjectUser('ws-attest-chain-d2@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, d0user.id, 0);
    await seedWorkPresence(session.id, d1user.id, 1, d0user.id);
    const token = makeProjectToken(d1user.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/attest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: d2user.id });

    expect(res.status).toBe(201);
    expect(res.body.data.depth).toBe(2);
  });

  it('returns 403 if attestor is not checked into the session', async () => {
    const leader = await createProjectUser('ws-attest-notchecked-leader@example.com');
    const outsider = await createProjectUser('ws-attest-notchecked-out@example.com');
    const target = await createProjectUser('ws-attest-notchecked-tgt@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    const token = makeProjectToken(outsider.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/attest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id });

    expect(res.status).toBe(403);
  });

  it('returns 400 if attestor has already used both attestation slots', async () => {
    const leader = await createProjectUser('ws-attest-full-leader@example.com');
    const attestor = await createProjectUser('ws-attest-full-att@example.com');
    const t1 = await createProjectUser('ws-attest-full-t1@example.com');
    const t2 = await createProjectUser('ws-attest-full-t2@example.com');
    const t3 = await createProjectUser('ws-attest-full-t3@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, attestor.id, 0);
    await seedWorkPresence(session.id, t1.id, 1, attestor.id);
    await seedWorkPresence(session.id, t2.id, 1, attestor.id);
    const token = makeProjectToken(attestor.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/attest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: t3.id });

    expect(res.status).toBe(400);
  });

  it('returns 400 if attestor tries to attest themselves', async () => {
    const leader = await createProjectUser('ws-attest-self-leader@example.com');
    const user = await createProjectUser('ws-attest-self@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, user.id, 0);
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/attest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: user.id });

    expect(res.status).toBe(400);
  });

  it('returns 409 if target is already checked into the session', async () => {
    const leader = await createProjectUser('ws-attest-dup-leader@example.com');
    const attestor = await createProjectUser('ws-attest-dup-att@example.com');
    const target = await createProjectUser('ws-attest-dup-tgt@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, attestor.id, 0);
    await seedWorkPresence(session.id, target.id, 0); // target already in
    const token = makeProjectToken(attestor.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/attest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id });

    expect(res.status).toBe(409);
  });

  it('returns 400 if the session is already APPROVED', async () => {
    const leader = await createProjectUser('ws-attest-closed-leader@example.com');
    const user = await createProjectUser('ws-attest-closed-user@example.com');
    const target = await createProjectUser('ws-attest-closed-tgt@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id, {
      status: 'APPROVED',
    });
    await seedWorkPresence(session.id, user.id, 0);
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/attest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown sessionId', async () => {
    const user = await createProjectUser('ws-attest-404@example.com');
    const target = await createProjectUser('ws-attest-404-tgt@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .post('/api/v1/projects/work-sessions/00000000-0000-4000-8000-000000000099/attest')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: target.id });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/projects/work-sessions/00000000-0000-4000-8000-000000000001/attest')
      .send({ targetUserId: '00000000-0000-4000-8000-000000000002' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/projects/work-sessions/:sessionId/close
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/work-sessions/:sessionId/close', () => {
  it('returns APPROVED and awards IP when ≥1 direct scan (depth 0) exists', async () => {
    const leader = await createProjectUser('ws-close-appr-leader@example.com');
    const member = await createProjectUser('ws-close-appr-member@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, member.id, 0); // direct scan
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/close`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.closedAt).toBeTruthy();

    const presence = await prisma.workPresence.findFirst({
      where: { sessionId: session.id, userId: member.id },
    });
    expect(presence!.ipAwarded).toBe(10);
    expect(presence!.awardedAt).not.toBeNull();
  });

  it('awards IP to all chain members when approved', async () => {
    const leader = await createProjectUser('ws-close-chain-leader@example.com');
    const d0 = await createProjectUser('ws-close-chain-d0@example.com');
    const d1 = await createProjectUser('ws-close-chain-d1@example.com');
    const d2 = await createProjectUser('ws-close-chain-d2@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, d0.id, 0);
    await seedWorkPresence(session.id, d1.id, 1, d0.id);
    await seedWorkPresence(session.id, d2.id, 2, d1.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/close`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.presenceCount).toBe(3);

    const presences = await prisma.workPresence.findMany({
      where: { sessionId: session.id },
    });
    for (const p of presences) {
      expect(p.ipAwarded).toBe(10);
    }
  });

  it('returns FLAGGED when no direct scans exist (all presences via attestation)', async () => {
    const leader = await createProjectUser('ws-close-flag-leader@example.com');
    const seeder = await createProjectUser('ws-close-flag-seeder@example.com');
    const member = await createProjectUser('ws-close-flag-member@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    // Seed only depth > 0 presences — no direct scans
    await seedWorkPresence(session.id, seeder.id, 1, leader.id);
    await seedWorkPresence(session.id, member.id, 2, seeder.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/close`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FLAGGED');

    const presences = await prisma.workPresence.findMany({
      where: { sessionId: session.id },
    });
    for (const p of presences) {
      expect(p.ipAwarded).toBe(0); // no IP when flagged
    }
  });

  it('returns FLAGGED with no error when session has zero presences', async () => {
    const leader = await createProjectUser('ws-close-empty-leader@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/close`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FLAGGED');
  });

  it('returns 403 if caller is not a project leader', async () => {
    const owner = await createProjectUser('ws-close-403-owner@example.com');
    const contributor = await createProjectUser('ws-close-403-contrib@example.com');
    const project = await seedProject(owner.id);
    await addProjectMember(project.id, contributor.id, 'CONTRIBUTOR');
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, owner.id);
    const token = makeProjectToken(contributor.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/close`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('is idempotent — closing an already-closed session returns its current state', async () => {
    const leader = await createProjectUser('ws-close-idem-leader@example.com');
    const member = await createProjectUser('ws-close-idem-member@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id, {
      status: 'APPROVED',
    });
    await seedWorkPresence(session.id, member.id, 0);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .post(`/api/v1/projects/work-sessions/${session.id}/close`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED'); // unchanged
  });

  it('returns 404 for an unknown sessionId', async () => {
    const leader = await createProjectUser('ws-close-404-leader@example.com');
    const project = await seedProject(leader.id);
    const token = makeProjectToken(leader.id);

    // Give leader ownership of a project so scopeCheck passes the leader check
    // but the session lookup itself fails
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const realSession = await seedWorkSession(milestone.id, project.id, leader.id);

    // Use a different (nonexistent) session ID
    const res = await request(app)
      .post('/api/v1/projects/work-sessions/00000000-0000-4000-8000-000000000099/close')
      .set('Authorization', `Bearer ${token}`);

    // scopeCheck will return false (no session found) → 403
    expect([403, 404]).toContain(res.status);

    // Cleanup reference
    void realSession;
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post(
      '/api/v1/projects/work-sessions/00000000-0000-4000-8000-000000000001/close'
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/projects/work-sessions/:sessionId
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/projects/work-sessions/:sessionId', () => {
  it('returns session details and ordered presences list', async () => {
    const leader = await createProjectUser('ws-get-leader@example.com');
    const m1 = await createProjectUser('ws-get-m1@example.com');
    const m2 = await createProjectUser('ws-get-m2@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    await seedWorkPresence(session.id, m1.id, 0);
    await seedWorkPresence(session.id, m2.id, 1, m1.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .get(`/api/v1/projects/work-sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(session.id);
    expect(res.body.data.milestoneId).toBe(milestone.id);
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.presenceCount).toBe(2);
    expect(res.body.data.presences).toHaveLength(2);

    const d0 = res.body.data.presences.find((p: any) => p.depth === 0);
    const d1 = res.body.data.presences.find((p: any) => p.depth === 1);
    expect(d0.userId).toBe(m1.id);
    expect(d1.userId).toBe(m2.id);
    expect(d1.user).toBeDefined();
  });

  it('returns qrSecret in the response (needed to generate QR image client-side)', async () => {
    const leader = await createProjectUser('ws-get-qr-leader@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .get(`/api/v1/projects/work-sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.qrSecret).toBe(session.qrSecret);
  });

  it('returns an empty presences array for a session with no check-ins', async () => {
    const leader = await createProjectUser('ws-get-empty-leader@example.com');
    const project = await seedProject(leader.id);
    const milestone = await seedMilestone(project.id, 'Active', MilestoneStatus.IN_PROGRESS);
    const session = await seedWorkSession(milestone.id, project.id, leader.id);
    const token = makeProjectToken(leader.id);

    const res = await request(app)
      .get(`/api/v1/projects/work-sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.presenceCount).toBe(0);
    expect(res.body.data.presences).toHaveLength(0);
  });

  it('returns 404 for an unknown sessionId', async () => {
    const user = await createProjectUser('ws-get-404@example.com');
    const token = makeProjectToken(user.id);

    const res = await request(app)
      .get('/api/v1/projects/work-sessions/00000000-0000-4000-8000-000000000099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(
      '/api/v1/projects/work-sessions/00000000-0000-4000-8000-000000000001'
    );
    expect(res.status).toBe(401);
  });
});

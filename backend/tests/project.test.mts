// backend/tests/project.test.mts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '@prisma/client';
import projectRoutes from '../src/routes/project.js';

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

beforeAll(async () => {
  await prisma.projectParticipant.deleteMany();
  await prisma.project.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.projectParticipant.deleteMany();
  await prisma.project.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.user.deleteMany();
});

describe('Project Routes', () => {
  it('creates project from APPROVED proposal', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user`,
        email: `user${Date.now()}@test.com`,
        name: 'Creator User',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        creatorUserId: user.id,
        proposalType: 'BUSINESS',
        funded: false,
        title: 'Approved Proposal',
        description: 'Testing project creation',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'APPROVED',
      },
    });

    const res = await request(app)
      .post('/api/projects/from-proposal')
      .send({ proposalId: proposal.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.project.proposalId).toBe(proposal.id);
  });

  it('returns error creating project from non-approved proposal', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user2`,
        email: `user2${Date.now()}@test.com`,
        name: 'Creator User 2',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        creatorUserId: user.id,
        proposalType: 'BUSINESS',
        funded: false,
        title: 'Draft Proposal',
        description: 'Testing failure for project creation',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'DRAFT',
      },
    });

    const res = await request(app)
      .post('/api/projects/from-proposal')
      .send({ proposalId: proposal.id });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/must be approved/i);
  });

  it('adds participant to project', async () => {
    // Setup user, proposal and project
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user3`,
        email: `user3${Date.now()}@test.com`,
        name: 'Participant User',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        creatorUserId: user.id,
        proposalType: 'BUSINESS',
        funded: false,
        title: 'Proposal for Participant',
        description: 'Test description',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'APPROVED',
      },
    });

    const projectRes = await request(app)
      .post('/api/projects/from-proposal')
      .send({ proposalId: proposal.id });

    const projectId = projectRes.body.project.id;

    const participantRes = await request(app)
      .post(`/api/projects/${projectId}/participants`)
      .send({ userId: user.id, role: 'MEMBER' });

    expect(participantRes.status).toBe(200);
    expect(participantRes.body.success).toBe(true);
    expect(participantRes.body.participant.projectId).toBe(projectId);
    expect(participantRes.body.participant.userId).toBe(user.id);
  });

  it('lists participants of a project', async () => {
    // Setup as above
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user4`,
        email: `user4${Date.now()}@test.com`,
        name: 'Participant List User',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        creatorUserId: user.id,
        proposalType: 'BUSINESS',
        funded: false,
        title: 'Proposal to List Participants',
        description: 'Testing list participants',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'APPROVED',
      },
    });

    const projectRes = await request(app)
      .post('/api/projects/from-proposal')
      .send({ proposalId: proposal.id });

    const projectId = projectRes.body.project.id;

    await request(app)
      .post(`/api/projects/${projectId}/participants`)
      .send({ userId: user.id, role: 'MEMBER' });

    const listRes = await request(app).get(`/api/projects/${projectId}/participants`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.participants)).toBe(true);
    expect(listRes.body.participants.length).toBeGreaterThan(0);
  });
});
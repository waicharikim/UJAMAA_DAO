import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import app from '../../src/app.js';
import { createTestUser } from '../testHelpers.js';
import prisma from '../src/prismaClient.js';

describe('Milestone API', () => {
  let authToken: string;
  let userId: string;
  let proposalId: string;
  let projectId: string;
  let milestoneId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    authToken = user.jwtToken;
    userId = user.id;

    // Create an approved proposal for project creation
    const proposal = await prisma.proposal.create({
      data: {
        title: 'Approved Proposal for Milestone',
        description: 'Proposal ready for project creation with milestones',
        proposalType: 'BUSINESS',
        funded: true,
        budget: 15000,
        locationScope: 'CONSTITUENCY',
        constituency: 'TestConstituency',
        isPrivate: false,
        creatorUserId: userId,
        status: 'APPROVED',
      },
    });
    proposalId = proposal.id;

    // Create project for milestones
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', authToken)
      .send({
        proposalId,
        title: 'Milestone Project',
        description: 'Project for milestone testing',
        budget: 15000,
        timeline: '12 months',
      });
    projectId = projectRes.body.id;
  });

  test('Create milestone for project', async () => {
    const res = await request(app)
      .post('/api/milestones')
      .set('Authorization', authToken)
      .send({
        projectId,
        title: 'Initial Milestone',
        description: 'First milestone in project',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        fundingAmount: 5000,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.projectId).toBe(projectId);
    milestoneId = res.body.id;
  });

  test('Submit milestone for review', async () => {
    const res = await request(app)
      .post('/api/milestones/submit')
      .set('Authorization', authToken)
      .send({
        milestoneId,
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UNDER_REVIEW');
  });

  test('Approve milestone', async () => {
    const res = await request(app)
      .post('/api/milestones/review')
      .set('Authorization', authToken)
      .send({
        milestoneId,
        approved: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });

  test('Reject milestone', async () => {
    // Create new milestone to test rejection
    const newMilestoneRes = await request(app)
      .post('/api/milestones')
      .set('Authorization', authToken)
      .send({
        projectId,
        title: 'Second Milestone',
        description: 'Second milestone in project',
        dueDate: new Date(Date.now() + 172800000).toISOString(),
        fundingAmount: 3000,
      });
    const newMilestoneId = newMilestoneRes.body.id;

    // Submit for review
    await request(app)
      .post('/api/milestones/submit')
      .set('Authorization', authToken)
      .send({
        milestoneId: newMilestoneId,
      });

    // Reject milestone
    const res = await request(app)
      .post('/api/milestones/review')
      .set('Authorization', authToken)
      .send({
        milestoneId: newMilestoneId,
        approved: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
  });
});
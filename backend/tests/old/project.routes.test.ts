import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import app from '../../src/app.js';
import { createTestUser } from '../testHelpers.js';
import prisma from '../src/prismaClient.js';

describe('Project API', () => {
  let authToken: string;
  let userId: string;
  let proposalId: string;
  let projectId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    authToken = user.jwtToken;
    userId = user.id;

    // Create an approved proposal for project creation
    const proposal = await prisma.proposal.create({
      data: {
        title: 'Approved Proposal',
        description: 'Proposal ready for project creation',
        proposalType: 'BUSINESS',
        funded: true,
        budget: 10000,
        locationScope: 'CONSTITUENCY',
        constituency: 'TestConstituency',
        isPrivate: false,
        creatorUserId: userId,
        status: 'APPROVED',
      },
    });
    proposalId = proposal.id;
  });

  test('Create project from approved proposal', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', authToken)
      .send({
        proposalId,
        title: 'New Project',
        description: 'Project based on approved proposal',
        budget: 10000,
        timeline: '6 months',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    projectId = res.body.id;
  });

  test('Get project by ID', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', authToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', projectId);
  });

  test('List projects', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', authToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Update project', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', authToken)
      .send({ title: 'Updated Project Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Project Title');
  });

  test('Delete project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', authToken);
    expect(res.status).toBe(204);
  });
});
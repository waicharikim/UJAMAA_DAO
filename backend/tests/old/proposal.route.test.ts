import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import app from '../../src/app.js';
import { createTestUser } from '../testHelpers.js';
import * as impactService from '../src/services/impactPoint.service.js';

describe('Proposal API', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    authToken = user.jwtToken;
    userId = user.id;

    // Seed impact points scoped to constituency to ensure proposal eligibility
    await impactService.addImpactPoints({
      holderType: 'USER',
      holderId: userId,
      points: 10000,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
    });

    // Log current impact points for debugging purposes
    const points = await impactService.getImpactPoints(
      'USER',
      userId,
      'CONSTITUENCY'
    );
    // Optionally log points for debugging
    // console.log('Current impact points:', points);
  });

  test('Create a proposal - success', async () => {
    const payload = {
      title: 'Test Proposal Title',
      description: 'This is a detailed proposal description exceeding 20 chars.',
      proposalType: 'BUSINESS',
      funded: false,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
      isPrivate: false,
      creatorUserId: userId,
    };

    const res = await request(app)
      .post('/api/proposals')
      .set('Authorization', authToken)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe(payload.title);
    expect(res.body.status).toBe('DRAFT');
  });

  test('Fail to create proposal without required fields', async () => {
    const payload = {
      title: 'Short',
    };

    const res = await request(app)
      .post('/api/proposals')
      .set('Authorization', authToken)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  test('Get existing proposal - success', async () => {
    const payload = {
      title: 'Another Proposal',
      description: 'This is a sufficiently detailed description for testing.',
      proposalType: 'NON_PROFIT',
      funded: false,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
      isPrivate: false,
      creatorUserId: userId,
    };

    const createRes = await request(app)
      .post('/api/proposals')
      .set('Authorization', authToken)
      .send(payload);

    expect(createRes.status).toBe(201);

    const proposalId = createRes.body.id;

    const getRes = await request(app)
      .get(`/api/proposals/${proposalId}`)
      .set('Authorization', authToken);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(proposalId);
    expect(getRes.body.title).toBe(payload.title);
  });

  test('Update proposal - success', async () => {
    const payload = {
      title: 'Updatable Proposal',
      description: 'Description sufficient for update testing purpose.',
      proposalType: 'BUSINESS',
      funded: false,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
      isPrivate: false,
      creatorUserId: userId,
    };

    const createRes = await request(app)
      .post('/api/proposals')
      .set('Authorization', authToken)
      .send(payload);

    expect(createRes.status).toBe(201);

    const proposalId = createRes.body.id;

    const updatePayload = { title: 'Updated Title' };

    const updateRes = await request(app)
      .patch(`/api/proposals/${proposalId}`)
      .set('Authorization', authToken)
      .send(updatePayload);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe(updatePayload.title);
  });
});
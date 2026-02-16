import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import app from '../../src/app.js';
import { createTestUser } from '../testHelpers.js';
import * as impactService from '../src/services/impactPoint.service.js';
import prisma from '../src/prismaClient.js';

describe('Proposal API - Group Proposals', () => {
  let authToken: string;
  let userId: string;
  let communityGroupId: string;
  let companyGroupId: string;
  let companyGroupNoBackingId: string;
  let uniqueNoBackingConstituency: string;

  beforeAll(async () => {
    // Create and authenticate user
    const user = await createTestUser();
    authToken = user.jwtToken;
    userId = user.id;

    await impactService.addImpactPoints({
      holderType: 'USER',
      holderId: userId,
      points: 1500,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
    });

    // Create community group (for backing) in TestConstituency
    const communityGroup = await prisma.group.create({
      data: {
        name: `CommunityGroup-${Date.now()}`,
        walletAddress: `0xcommunity${Date.now()}`,
        constituency: 'TestConstituency',
        county: 'TestCounty',
        industryFocus: 'community',
      },
    });
    communityGroupId = communityGroup.id;

    // Create company group in TestConstituency
    const companyGroup = await prisma.group.create({
      data: {
        name: `CompanyGroup-${Date.now()}`,
        walletAddress: `0xcompany${Date.now()}`,
        constituency: 'TestConstituency',
        county: 'TestCounty',
        industryFocus: 'company',
      },
    });
    companyGroupId = companyGroup.id;

    // Create a unique constituency with no community group for no-backing test
    uniqueNoBackingConstituency = `NoBackingConstituency${Date.now()}`;

    // Create company group in unique constituency without backing
    const companyGroupNoBacking = await prisma.group.create({
      data: {
        name: `CompanyNoBacking-${Date.now()}`,
        walletAddress: `0xcompanyNoBacking${Date.now()}`,
        constituency: uniqueNoBackingConstituency,
        county: 'TestCounty',
        industryFocus: 'company',
      },
    });
    companyGroupNoBackingId = companyGroupNoBacking.id;
  });

  test('Create funded group proposal - community group success', async () => {
    const payload = {
      title: 'Community Funded Proposal',
      description: 'Detailed proposal from community group.',
      proposalType: 'BUSINESS',
      funded: true,
      budget: 10000,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
      creatorGroupId: communityGroupId,
    };

    const res = await request(app)
      .post('/api/proposals')
      .set('Authorization', authToken)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.funded).toBe(true);
  });

  test('Create funded group proposal - company group without backing fails', async () => {
    const payload = {
      title: 'Company Funded Proposal Without Backing',
      description: 'This should fail due to missing community backing.',
      proposalType: 'BUSINESS',
      funded: true,
      budget: 20000,
      locationScope: 'CONSTITUENCY',
      constituency: uniqueNoBackingConstituency,
      creatorGroupId: companyGroupNoBackingId,
    };

    const res = await request(app)
      .post('/api/proposals')
      .set('Authorization', authToken)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/backing community group/i);
  });

  test('Create funded group proposal - company group with backing success', async () => {
    const payload = {
      title: 'Company Funded Proposal With Backing',
      description: 'This should succeed because community backing exists.',
      proposalType: 'BUSINESS',
      funded: true,
      budget: 20000,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
      creatorGroupId: companyGroupId,
    };

    const res = await request(app)
      .post('/api/proposals')
      .set('Authorization', authToken)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.funded).toBe(true);
  });
});
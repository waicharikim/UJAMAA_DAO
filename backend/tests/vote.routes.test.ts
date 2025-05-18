import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import app from '../src/app.js';
import { createTestUser } from './testHelpers';
import * as impactService from '../src/services/impactPoint.service.js';
import * as tokenService from '../src/services/token.service.js';
import prisma from '../src/prismaClient.js';
import { setUserTokenBalance } from './voteHelper'; // Adjust path if necessary

describe('Vote API', () => {
  let authToken: string;
  let userId: string;
  let groupId: string;
  let proposalId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    authToken = user.jwtToken;
    userId = user.id;

    await impactService.addImpactPoints({
      holderType: 'USER',
      holderId: userId,
      points: 500,
      locationScope: 'CONSTITUENCY',
      constituency: 'TestConstituency',
    });

    // Set initial token balance for the user
    await setUserTokenBalance(userId, 100);

    const group = await prisma.group.create({
      data: {
        name: `TestGroup-${Date.now()}`,
        walletAddress: `0xgroup${Date.now()}`,
        constituency: 'TestConstituency',
        county: 'TestCounty',
        industryFocus: 'community',
        members: {
          create: [{ userId: userId, role: 'MEMBER', active: true }],
        },
      },
      include: { members: true },
    });
    groupId = group.id;

    const proposal = await prisma.proposal.create({
      data: {
        title: 'Vote Testing Proposal',
        description: 'Testing voting functionality.',
        proposalType: 'BUSINESS',
        funded: false,
        locationScope: 'CONSTITUENCY',
        constituency: 'TestConstituency',
        isPrivate: false,
        creatorUserId: userId,
        status: 'VOTING',
      },
    });
    proposalId = proposal.id;
  });

  test('Cast individual vote - success', async () => {
    const res = await request(app)
      .post('/api/votes/individual')
      .set('Authorization', authToken)
      .send({
        proposalId,
        vote: true,
        tokensSpent: 10,
      });
    expect(res.status).toBe(201);
  });

  test('Fail to cast individual vote without tokens', async () => {
    // Set token balance exactly to zero to simulate no tokens
    await setUserTokenBalance(userId, 0);

    // Remove any existing vote to allow vote attempt
    await prisma.vote.deleteMany({
      where: { proposalId, voterId: userId, isGroup: false },
    });

    const res = await request(app)
      .post('/api/votes/individual')
      .set('Authorization', authToken)
      .send({
        proposalId,
        vote: true,
        tokensSpent: 10,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient tokens/i);

    // Restore token balance for subsequent tests
    await setUserTokenBalance(userId, 100);
  });

  test('Prevent duplicate individual vote', async () => {
    // Cast initial vote
    const firstRes = await request(app)
      .post('/api/votes/individual')
      .set('Authorization', authToken)
      .send({
        proposalId,
        vote: true,
        tokensSpent: 10,
      });
    expect(firstRes.status).toBe(201);

    // Attempt duplicate vote
    const secondRes = await request(app)
      .post('/api/votes/individual')
      .set('Authorization', authToken)
      .send({
        proposalId,
        vote: false,
        tokensSpent: 10,
      });
    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error).toMatch(/already voted/i);
  });

  test('Cast group block vote - success when quorum and consensus met', async () => {
    // Assuming quorum check always returns true for tests
    const res = await request(app)
      .post('/api/votes/group')
      .set('Authorization', authToken)
      .send({
        proposalId,
        groupId,
        vote: true,
      });
    expect(res.status).toBe(201);
  });

  test('Prevent duplicate group block vote', async () => {
    // Cast initial group vote
    const firstRes = await request(app)
      .post('/api/votes/group')
      .set('Authorization', authToken)
      .send({
        proposalId,
        groupId,
        vote: false,
      });
    expect(firstRes.status).toBe(201);

    // Duplicate group vote attempt
    const dupRes = await request(app)
      .post('/api/votes/group')
      .set('Authorization', authToken)
      .send({
        proposalId,
        groupId,
        vote: true,
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error).toMatch(/already voted/i);
  });

  test('Get vote tally', async () => {
    const res = await request(app)
      .get(`/api/votes/${proposalId}/tally`)
      .set('Authorization', authToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalVotes');
    expect(res.body).toHaveProperty('totalYes');
    expect(res.body).toHaveProperty('totalNo');
  });
});
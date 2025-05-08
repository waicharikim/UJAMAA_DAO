/**
 * Integration tests for Voting API routes in UjamaaDAO backend,
 * extended to cover impact points eligibility and rewards.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '@prisma/client';
import voteRoutes from '../src/routes/vote';

const app = express();
app.use(express.json());
app.use('/api/votes', voteRoutes);

beforeAll(async () => {
  await prisma.vote.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.tokenBalance.deleteMany();
  await prisma.impactPoint.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.vote.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.tokenBalance.deleteMany();
  await prisma.impactPoint.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

describe('Voting API with Impact Points', () => {
  it('rejects votes with missing required fields', async () => {
    const res = await request(app).post('/api/votes/cast').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects vote from user with insufficient impact points', async () => {
    const user = await prisma.user.create({ /* user data */ });
    await prisma.impactPoint.create({
      data: {
        holderType: 'USER',
        holderId: user.id,
        points: 5, // below 10 point threshold
      },
    });
    await prisma.tokenBalance.create({ /* token data with enough tokens */ });

    const proposal = await prisma.proposal.create({ /* proposal data with VOTING status */ });
    const votePayload = {
      proposalId: proposal.id,
      voterId: user.id,
      isGroup: false,
      vote: true,
      tokensSpent: 2,
    };
    const res = await request(app).post('/api/votes/cast').send(votePayload);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Insufficient impact points/i);
  });

  it('accepts vote and rewards impact points for eligible user', async () => {
    const user = await prisma.user.create({ /* user data */ });
    await prisma.impactPoint.create({
      data: {
        holderType: 'USER',
        holderId: user.id,
        points: 15, // above threshold
      },
    });
    await prisma.tokenBalance.create({
      data: {
        holderType: 'USER',
        holderId: user.id,
        balance: 10,
      },
    });

    const proposal = await prisma.proposal.create({ /* proposal data with VOTING status */ });
    const votePayload = {
      proposalId: proposal.id,
      voterId: user.id,
      isGroup: false,
      vote: true,
      tokensSpent: 2,
    };
    const res = await request(app).post('/api/votes/cast').send(votePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify impact points incremented by 5 (assuming that reward)
    const updatedPoints = await prisma.impactPoint.findUnique({
      where: { holderType_holderId: { holderType: 'USER', holderId: user.id } },
    });
    expect(updatedPoints?.points).toBe(15 + 5);

    // Verify tokens deducted correctly
    const updatedTokens = await prisma.tokenBalance.findUnique({
      where: { holderType_holderId: { holderType: 'USER', holderId: user.id } },
    });
    expect(updatedTokens?.balance).toBe(8); // 10 - 2
  });

  // Your existing tests for vote aggregation, etc. can also be included here...

});
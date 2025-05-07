import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import { ProposalType, ProposalStatus, LocationScope } from '@prisma/client';
import proposalRoutes from '../src/routes/proposal';

const app = express();
app.use(express.json());
app.use('/api/proposals', proposalRoutes);

beforeAll(async () => {
  await prisma.proposal.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.proposal.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

describe('Proposal API', () => {
  it('returns 400 when required fields are missing on create', async () => {
    const res = await request(app).post('/api/proposals/create').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('creatorUserId or creatorGroupId');
  });

  it('creates a new funded proposal successfully', async () => {
    const group = await prisma.group.create({
      data: {
        name: 'Test Group',
        walletAddress: '0x123abc',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Tech',
        productsServices: ['Software'],
      },
    });

    const newProposal = {
      creatorGroupId: group.id,
      proposalType: ProposalType.BUSINESS,
      funded: true,
      title: 'New Business Proposal',
      description: 'Description of proposal',
      budget: 10000,
      timeline: '6 months',
      locationScope: LocationScope.LOCAL,
      constituency: 'Nairobi West',
      county: 'Nairobi',
      purposeDetails: {
        businessModel: 'Sell X services',
        profitProjection: 'Expected 20% profit margin',
        communityBenefit: 'Job creation',
      },
    };

    const res = await request(app).post('/api/proposals/create').send(newProposal);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.proposalId).toBe('string');
  });

  it('gets proposal details by id', async () => {
    const group = await prisma.group.create({
      data: {
        name: 'Details Group',
        walletAddress: '0x456def',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Tech',
        productsServices: [],
      },
    });

    const created = await prisma.proposal.create({
      data: {
        creatorGroupId: group.id,
        proposalType: ProposalType.NON_PROFIT,
        funded: false,
        title: 'Community Cleanup',
        description: 'Cleaning the park',
        locationScope: LocationScope.LOCAL,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: ProposalStatus.DRAFT,
      },
    });

    const res = await request(app).get(`/api/proposals/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.title).toBe('Community Cleanup');
  });

  it('returns 404 for non-existent proposal', async () => {
    const res = await request(app).get('/api/proposals/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('lists proposals with optional filtering', async () => {
    const group1 = await prisma.group.create({
      data: {
        name: 'G1',
        walletAddress: '0xabc1',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Business',
        productsServices: [],
      },
    });

    const group2 = await prisma.group.create({
      data: {
        name: 'G2',
        walletAddress: '0xabc2',
        constituency: 'Kisumu East',
        county: 'Kisumu',
        industryFocus: 'Non-Profit',
        productsServices: [],
      },
    });

    await prisma.proposal.createMany({
      data: [
        {
          creatorGroupId: group1.id,
          proposalType: ProposalType.BUSINESS,
          funded: true,
          title: 'Proposal 1',
          description: '',
          locationScope: LocationScope.LOCAL,
          constituency: 'Nairobi West',
          county: 'Nairobi',
          status: ProposalStatus.VOTING,
        },
        {
          creatorGroupId: group2.id,
          proposalType: ProposalType.NON_PROFIT,
          funded: false,
          title: 'Proposal 2',
          description: '',
          locationScope: LocationScope.COUNTY,
          constituency: null,
          county: 'Kisumu',
          status: ProposalStatus.APPROVED,
        },
      ],
    });

    const res = await request(app).get('/api/proposals').query({ locationScope: LocationScope.LOCAL });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].locationScope).toBe(LocationScope.LOCAL);
  });

  it('updates proposal status and other fields', async () => {
    const group = await prisma.group.create({
      data: {
        name: 'Update Group',
        walletAddress: '0xxyz123',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Tech',
        productsServices: [],
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        creatorGroupId: group.id,
        proposalType: ProposalType.BUSINESS,
        funded: true,
        title: 'Update Me',
        description: 'Initial',
        locationScope: LocationScope.LOCAL,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: ProposalStatus.DRAFT,
      },
    });

    const updateData = {
      status: ProposalStatus.VOTING,
      title: 'Updated Title',
    };

    const res = await request(app).patch(`/api/proposals/${proposal.id}`).send(updateData);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.updatedStatus).toBe(ProposalStatus.VOTING);

    const updated = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    expect(updated?.title).toBe('Updated Title');
    expect(updated?.status).toBe(ProposalStatus.VOTING);
  });

  it('returns 400 on invalid status update', async () => {
    const group = await prisma.group.create({
      data: {
        name: 'Invalid Group',
        walletAddress: '0xabc999',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Tech',
        productsServices: [],
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        creatorGroupId: group.id,
        proposalType: ProposalType.BUSINESS,
        funded: true,
        title: 'Invalid Status Update',
        description: '',
        locationScope: LocationScope.LOCAL,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: ProposalStatus.DRAFT,
      },
    });

    const res = await request(app).patch(`/api/proposals/${proposal.id}`).send({ status: 'INVALID_STATUS' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when updating non-existent proposal', async () => {
    const res = await request(app).patch('/api/proposals/non-existent-id').send({ status: ProposalStatus.VOTING });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
/**
 * Integration tests for Proposal API routes.
 *
 * Covers proposal creation, retrieval, listing, and updating,
 * with real database operations using Prisma.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
// In test files
import prisma from '../src/prismaClient';    // NO .js here inside tests!
import { ProposalType, ProposalStatus, LocationScope } from '@prisma/client';  // Enums from the module
import proposalRoutes from '../src/routes/proposal';

const app = express();
app.use(express.json());
app.use('/api/proposals', proposalRoutes);

beforeAll(async () => {
  // Clean all relevant tables before starting test suite for a clean state
  await prisma.proposal.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Disconnect Prisma Client after all tests are done to prevent open handles
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean tables before every test for isolation and test consistency
  await prisma.proposal.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

describe('Proposal API', () => {
  it('should return 400 when required fields are missing on create', async () => {
    const res = await request(app).post('/api/proposals/create').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    // Check for error message about required creator id
    expect(res.body.error).toContain('creatorUserId or creatorGroupId');
  });

  it('should create a new funded proposal successfully', async () => {
    // Create group first (required for FK constraint)
    const group = await prisma.group.create({
      data: {
        name: `Test Group ${Date.now()}`,
        walletAddress: `0x${Date.now()}abc`,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Technology',
        productsServices: ['Software Development'],
      },
    });

    const newProposal = {
      creatorGroupId: group.id,
      proposalType: ProposalType.BUSINESS,
      funded: true,
      title: 'New Business Proposal',
      description: 'Details of the business proposal',
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

  it('should retrieve proposal details by ID', async () => {
    const group = await prisma.group.create({
      data: {
        name: `Detail Group ${Date.now()}`,
        walletAddress: `0x${Date.now()}def`,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Technology',
        productsServices: [],
      },
    });

    const createdProposal = await prisma.proposal.create({
      data: {
        creatorGroupId: group.id,
        proposalType: ProposalType.NON_PROFIT,
        funded: false,
        title: 'Community Cleanup',
        description: 'Cleaning the local park',
        locationScope: LocationScope.LOCAL,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: ProposalStatus.DRAFT,
      },
    });

    const res = await request(app).get(`/api/proposals/${createdProposal.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdProposal.id);
    expect(res.body.title).toBe('Community Cleanup');
  });

  it('should return 404 for non-existent proposal', async () => {
    const res = await request(app).get('/api/proposals/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should list proposals filtered by locationScope', async () => {
    const group1 = await prisma.group.create({
      data: {
        name: `Group One ${Date.now()}`,
        walletAddress: `0x${Date.now()}abc1`,
        constituency: 'Nairobi West',
        county: 'Nairobi',
        industryFocus: 'Business',
        productsServices: [],
      },
    });

    const group2 = await prisma.group.create({
      data: {
        name: `Group Two ${Date.now()}`,
        walletAddress: `0x${Date.now()}abc2`,
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
          title: 'Local Health Program',
          description: 'Healthcare program in Nairobi',
          locationScope: LocationScope.LOCAL,
          constituency: 'Nairobi West',
          county: 'Nairobi',
          status: ProposalStatus.VOTING,
        },
        {
          creatorGroupId: group2.id,
          proposalType: ProposalType.NON_PROFIT,
          funded: false,
          title: 'County Education Support',
          description: 'Education support initiative',
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

  it('should update proposal status and other fields', async () => {
    const group = await prisma.group.create({
      data: {
        name: `Update Group ${Date.now()}`,
        walletAddress: `0x${Date.now()}xyz`,
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
        description: 'Initial description',
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

    const updatedProposal = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    expect(updatedProposal?.title).toBe('Updated Title');
    expect(updatedProposal?.status).toBe(ProposalStatus.VOTING);
  });

  it('should return 400 on invalid status update', async () => {
    const group = await prisma.group.create({
      data: {
        name: `Invalid Group ${Date.now()}`,
        walletAddress: `0x${Date.now()}abc999`,
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
        title: 'Invalid Status',
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

  it('should return 404 when updating non-existent proposal', async () => {
    const res = await request(app).patch('/api/proposals/non-existent-id').send({ status: ProposalStatus.VOTING });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
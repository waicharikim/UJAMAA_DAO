// backend/tests/projectService.test.mts

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '@prisma/client';
import {
  createProjectFromProposal,
  addParticipantToProject,
  listProjectParticipants,
  ParticipantRole,
} from '../src/services/projectService';

describe('Project Service', () => {
  beforeEach(async () => {
    // Cleanup for isolated tests
    await prisma.projectParticipant.deleteMany();
    await prisma.project.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a project from an approved proposal', async () => {
    // Create a user for proposal creator
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user`,
        email: `user${Date.now()}@test.com`,
        name: 'Project Creator',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    // Create an approved proposal
    const proposal = await prisma.proposal.create({
      data: {
        creatorUserId: user.id,
        proposalType: 'BUSINESS',
        funded: false,
        title: 'Approved Proposal',
        description: 'Proposal for testing project creation',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'APPROVED',
      },
    });

    // Create project from this proposal
    const project = await createProjectFromProposal(proposal.id);

    expect(project.proposalId).toBe(proposal.id);
    expect(project.title).toBe(proposal.title);
    expect(project.status).toBe('ACTIVE');
  });

  it('throws error if project created from non-approved proposal', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user2`,
        email: `user2${Date.now()}@test.com`,
        name: 'Project Creator 2',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        creatorUserId: user.id,
        proposalType: 'BUSINESS',
        funded: false,
        title: 'Non-Approved Proposal',
        description: 'Should fail creating project',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'DRAFT',
      },
    });

    await expect(createProjectFromProposal(proposal.id)).rejects.toThrow(
      'Proposal must be approved to create project',
    );
  });

  it('adds a participant to a project', async () => {
    // Setup user, proposal, and project
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
        title: 'Participant Proposal',
        description: 'Testing participant add',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'APPROVED',
      },
    });

    const project = await createProjectFromProposal(proposal.id);

    const participant = await addParticipantToProject(project.id, user.id, ParticipantRole.MEMBER);

    expect(participant.projectId).toBe(project.id);
    expect(participant.userId).toBe(user.id);
    expect(participant.role).toBe(ParticipantRole.MEMBER);
  });

  it('lists participants for a project', async () => {
    // Setup
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
        title: 'Participant Listing Proposal',
        description: 'Test participant listing',
        locationScope: 'LOCAL',
        constituency: 'Nairobi West',
        county: 'Nairobi',
        status: 'APPROVED',
      },
    });

    const project = await createProjectFromProposal(proposal.id);

    await addParticipantToProject(project.id, user.id);

    const participants = await listProjectParticipants(project.id);
    expect(participants.length).toBeGreaterThan(0);
    expect(participants[0].userId).toBe(user.id);
  });
});
// backend/tests/participationService.test.mts

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '@prisma/client';
import {
  addParticipant,
  removeParticipant,
  listParticipants,
  ParticipantRole,
} from '../src/services/participationService';

describe('Participation Service', () => {
  beforeEach(async () => {
    // Cleanup to ensure test isolation
    await prisma.projectParticipant.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('adds a participant to a project', async () => {
    // Create sample user and project
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user`,
        email: `user${Date.now()}@test.com`,
        name: 'Participant User',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const project = await prisma.project.create({
      data: {
        proposalId: 'dummy-proposal-id', // use a dummy or seeded proposal id
        title: 'Test Project',
        description: 'Testing participation',
        locationScope: 'LOCAL',
      },
    });

    const participant = await addParticipant(project.id, user.id, ParticipantRole.MEMBER);

    expect(participant.projectId).toBe(project.id);
    expect(participant.userId).toBe(user.id);
    expect(participant.role).toBe(ParticipantRole.MEMBER);
  });

  it('does not allow duplicate participants', async () => {
    // Setup user and project
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user2`,
        email: `user2${Date.now()}@test.com`,
        name: 'Duplicate User',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const project = await prisma.project.create({
      data: {
        proposalId: 'dummy-proposal-id-2',
        title: 'Test Project 2',
        description: 'Testing duplicates',
        locationScope: 'LOCAL',
      },
    });

    await addParticipant(project.id, user.id);

    await expect(addParticipant(project.id, user.id)).rejects.toThrow(
      'User already a participant in this project',
    );
  });

  it('lists participants for a project', async () => {
    // Setup user and project
    const user = await prisma.user.create({
      data: {
        walletAddress: `0x${Date.now()}user3`,
        email: `user3${Date.now()}@test.com`,
        name: 'List User',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      },
    });

    const project = await prisma.project.create({
      data: {
        proposalId: 'dummy-proposal-id-3',
        title: 'Test Project 3',
        description: 'Testing list',
        locationScope: 'LOCAL',
      },
    });

    await addParticipant(project.id, user.id);

    const participants = await listParticipants(project.id);
    expect(participants.length).toBeGreaterThan(0);
    expect(participants[0].userId).toBe(user.id);
  });
});
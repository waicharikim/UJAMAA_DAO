// backend/src/services/projectService.ts

import prisma from '../prismaClient.js';

export enum ParticipantRole {
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

/**
 * Creates a project from an approved proposal.
 * Returns the created Project.
 */
export async function createProjectFromProposal(proposalId: string) {
  // Ensure proposal exists and is approved
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new Error('Proposal not found');
  }
  if (proposal.status !== 'APPROVED') {
    throw new Error('Proposal must be approved to create project');
  }

  // Create corresponding project record
  const project = await prisma.project.create({
    data: {
      proposalId,
      title: proposal.title,
      description: proposal.description,
      budget: proposal.budget,
      timeline: proposal.timeline,
      status: ProjectStatus.ACTIVE,
      locationScope: proposal.locationScope,
      constituency: proposal.constituency,
      county: proposal.county,
    },
  });

  return project;
}

/**
 * Add a participant (user) to a project with optional role.
 * Role defaults to MEMBER.
 */
export async function addParticipantToProject(
  projectId: string,
  userId: string,
  role: ParticipantRole = ParticipantRole.MEMBER,
) {
  // Check if participant already exists
  const existing = await prisma.projectParticipant.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  if (existing) {
    throw new Error('User is already a participant of this project');
  }

  // Add participant record
  return prisma.projectParticipant.create({
    data: {
      projectId,
      userId,
      role,
    },
  });
}

/**
 * List participants of a project.
 */
export async function listProjectParticipants(projectId: string) {
  return prisma.projectParticipant.findMany({
    where: { projectId },
    include: {
      participant: true,
    },
  });
}
// backend/src/services/participationService.ts

import prisma from '../prismaClient.js';

export enum ParticipantRole {
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
}

/**
 * Add a user as participant to a project with specified role.
 * Prevent duplicate participation.
 * @param projectId string
 * @param userId string
 * @param role ParticipantRole (default MEMBER)
 */
export async function addParticipant(
  projectId: string,
  userId: string,
  role: ParticipantRole = ParticipantRole.MEMBER,
) {
  // Ensure user not already participant
  const existing = await prisma.projectParticipant.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (existing) {
    throw new Error('User already a participant in this project');
  }

  return prisma.projectParticipant.create({
    data: {
      projectId,
      userId,
      role,
    },
  });
}

/**
 * Remove a participant from a project.
 * @param projectId string
 * @param userId string
 */
export async function removeParticipant(projectId: string, userId: string) {
  return prisma.projectParticipant.delete({
    where: { projectId_userId: { projectId, userId } },
  });
}

/**
 * List all participants of a specified project.
 * @param projectId string
 */
export async function listParticipants(projectId: string) {
  return prisma.projectParticipant.findMany({
    where: { projectId },
    include: { participant: true },
  });
}
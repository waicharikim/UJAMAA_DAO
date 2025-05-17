/**
 * @file group.service.ts
 *
 * @description
 * Service layer for managing Group entities and related business logic.
 * 
 * Responsibilities include:
 * - Creating groups and assigning initial admin members.
 * - Fetching group details along with active members’ information.
 * - Updating group information.
 * - Handling user invitations to groups and managing invite acceptance.
 * - Changing group member roles (e.g., promoting members to admins).
 * 
 * Utilizes Prisma ORM for database operations and throws ApiError
 * for controlled error handling consistent with API response codes.
 * All functions assume validated input as per group.validation schemas.
 */

import prisma from '../prismaClient.js';
import { ApiError } from '../utils/ApiError.js';
import type { CreateGroupInput, UpdateGroupInput } from '../validation/group.validation.js';
import logger from '../utils/logger.js'; // Assumes you have a logger utility

/**
 * Creates a new group with the provided data and assigns the creator as admin.
 * Throws error if a group with the same name already exists.
 * 
 * @param {CreateGroupInput} input - Data for the new group
 * @param {string} creatorUserId - ID of the user creating the group
 * @returns {Promise<object>} - Created group object
 * @throws {ApiError} - On name conflict or DB errors
 */
export async function createGroup(input: CreateGroupInput, creatorUserId: string) {
  logger.info('createGroup: Checking for existing group', { groupName: input.name });

  const existing = await prisma.group.findUnique({
    where: { name: input.name },
  });

  if (existing) {
    logger.warn('createGroup: Group name already exists', { groupName: input.name });
    throw new ApiError('Group name already exists', 409);
  }

  logger.info('createGroup: Creating new group', { groupName: input.name, creatorUserId });

  // Enforce industryFocus non-null string (can be empty string)
  const group = await prisma.group.create({
    data: {
      ...input,
      industryFocus: input.industryFocus ?? '',
    },
  });

  logger.info('createGroup: Adding creator as admin member', { groupId: group.id, creatorUserId });

  // Add the creator as an active admin in the group
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: creatorUserId,
      role: 'ADMIN',
      active: true,
    },
  });

  logger.info('createGroup: Group created successfully', { groupId: group.id });

  return group;
}

/**
 * Retrieves a group by ID along with active members including their user info.
 * 
 * @param {string} id - Group ID
 * @returns {Promise<object>} - Group object with members included
 * @throws {ApiError} - If group not found
 */
export async function getGroupById(id: string) {
  logger.info('getGroupById: Fetching group by ID', { groupId: id });

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        where: { active: true },
        include: { user: true },
      },
    },
  });

  if (!group) {
    logger.warn('getGroupById: Group not found', { groupId: id });
    throw new ApiError('Group not found', 404);
  }

  logger.info('getGroupById: Group fetched successfully', { groupId: id });

  return group;
}

/**
 * Updates an existing group with the given data.
 *
 * @param {string} id - Group ID
 * @param {UpdateGroupInput} data - Data to update
 * @returns {Promise<object>} - Updated group object
 * @throws {ApiError} - If group not found
 */
export async function updateGroup(id: string, data: UpdateGroupInput) {
  logger.info('updateGroup: Updating group', { groupId: id, updateFields: Object.keys(data) });

  const group = await prisma.group.findUnique({ where: { id } });

  if (!group) {
    logger.warn('updateGroup: Group not found', { groupId: id });
    throw new ApiError('Group not found', 404);
  }

  const updatedGroup = await prisma.group.update({
    where: { id },
    data,
  });

  logger.info('updateGroup: Group updated successfully', { groupId: id });

  return updatedGroup;
}

/**
 * Invites a user to join a group by creating an inactive (pending) group member record.
 *
 * @param {string} groupId - ID of the group
 * @param {string} userId - ID of the user to invite
 * @returns {Promise<object>} - Invitation group member record
 * @throws {ApiError} - If group not found or user already invited/member
 */
export async function inviteUserToGroup(groupId: string, userId: string) {
  logger.info('inviteUserToGroup: Inviting user to group', { groupId, userId });

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    logger.warn('inviteUserToGroup: Group not found', { groupId });
    throw new ApiError('Group not found', 404);
  }

  const existingMember = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
    },
  });
  if (existingMember) {
    logger.warn('inviteUserToGroup: User already a member or invited', { groupId, userId });
    throw new ApiError('User is already a member or invited', 400);
  }

  const invitation = await prisma.groupMember.create({
    data: {
      groupId,
      userId,
      role: 'MEMBER',
      active: false, // Set as invite pending
    },
  });

  logger.info('inviteUserToGroup: Invitation created', { groupId, userId, invitationId: invitation.id });

  return invitation;
}

/**
 * Allows a user to accept a pending invitation to join a group.
 *
 * @param {string} groupId - ID of the group
 * @param {string} userId - ID of the user accepting the invite
 * @returns {Promise<object>} - Updated group member record with active=true
 * @throws {ApiError} - If no pending invitation found
 */
export async function acceptGroupInvite(groupId: string, userId: string) {
  logger.info('acceptGroupInvite: Accepting invite', { groupId, userId });

  const member = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
      active: false,
    },
  });
  if (!member) {
    logger.warn('acceptGroupInvite: No pending invitation found', { groupId, userId });
    throw new ApiError('No pending invitation found', 404);
  }

  const accepted = await prisma.groupMember.update({
    where: { id: member.id },
    data: { active: true },
  });

  logger.info('acceptGroupInvite: Invitation accepted', { groupId, userId });

  return accepted;
}

/**
 * Changes the role of a group member (e.g., from MEMBER to ADMIN).
 * Note: Authorization checks must be done at route/controller layer.
 *
 * @param {string} groupId - ID of the group
 * @param {string} userId - ID of the member whose role is changed
 * @param {'ADMIN' | 'MEMBER'} role - New role to assign
 * @returns {Promise<object>} - Updated group member record
 * @throws {ApiError} - If member not found
 */
export async function changeMemberRole(groupId: string, userId: string, role: 'ADMIN' | 'MEMBER') {
  logger.info('changeMemberRole: Changing member role', { groupId, userId, role });

  const member = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
      active: true,
    },
  });
  if (!member) {
    logger.warn('changeMemberRole: Member not found', { groupId, userId });
    throw new ApiError('Member not found', 404);
  }

  const updated = await prisma.groupMember.update({
    where: { id: member.id },
    data: { role },
  });

  logger.info('changeMemberRole: Member role updated', { groupId, userId, newRole: role });

  return updated;
}
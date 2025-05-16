/**
 * @file group.controller.ts
 *
 * @description
 * Express controller module handling HTTP requests for Group entities.
 * Includes:
 * - Creation of new groups
 * - Fetching group details by ID
 * - Updating existing groups
 * - Inviting users to groups and handling invitation acceptance
 * - Managing group member roles (e.g., promote/demote admins)
 *
 * This module validates input using Zod schemas, handles business errors
 * via the ApiError class, and logs important events and errors.
 * It expects authenticated requests where applicable, using user info
 * injected by authentication middleware (`authMiddleware`).
 *
 * Each function sends appropriate HTTP responses and delegates
 * unhandled errors to Express error handling middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import * as groupService from '../services/group.service.js';
import { createGroupSchema, updateGroupSchema } from '../validation/group.validation.js';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js'; // Assumes a logger utility is in place

/**
 * Create a new group.
 * Requires authenticated user (creator).
 */
export const createGroupHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = createGroupSchema.parse(req.body);

    const creatorUserId = (req as any).user?.userId;
    if (!creatorUserId) {
      logger.warn('createGroupHandler: Unauthorized access attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    logger.info('createGroupHandler: Creating group', { creatorUserId, groupName: input.name });

    const group = await groupService.createGroup(input, creatorUserId);
    res.status(201).json(group);

    logger.info('createGroupHandler: Group created successfully', { groupId: group.id });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn('createGroupHandler: Validation failed', { errors: (err as ZodError).errors });
      res.status(400).json({ errors: (err as ZodError).errors });
      return;
    }
    if (err instanceof ApiError) {
      logger.warn('createGroupHandler: ApiError', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('createGroupHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Get a group by ID.
 */
export const getGroupHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const groupId = req.params.id;
    logger.info('getGroupHandler: Fetching group by id', { groupId });

    const group = await groupService.getGroupById(groupId);
    res.json(group);

    logger.info('getGroupHandler: Group retrieved', { groupId: group.id });
  } catch (err) {
    if (err instanceof ApiError) {
      logger.warn('getGroupHandler: ApiError', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('getGroupHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Update a group by ID.
 */
export const updateGroupHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = updateGroupSchema.parse(req.body);
    const groupId = req.params.id;

    logger.info('updateGroupHandler: Updating group', { groupId, updateData: input });

    const updated = await groupService.updateGroup(groupId, input);
    res.json(updated);

    logger.info('updateGroupHandler: Group updated', { groupId });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.warn('updateGroupHandler: Validation failed', { errors: (err as ZodError).errors });
      res.status(400).json({ errors: (err as ZodError).errors });
      return;
    }
    if (err instanceof ApiError) {
      logger.warn('updateGroupHandler: ApiError', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('updateGroupHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Invite a user to join a group.
 * Typically requires admin authorization at route level.
 */
export const inviteUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const groupId = req.params.id;
    const { userId } = req.body;

    logger.info('inviteUserHandler: Inviting user to group', { groupId, userId });

    const invitation = await groupService.inviteUserToGroup(groupId, userId);
    res.status(201).json(invitation);

    logger.info('inviteUserHandler: User invited', { groupId, userId });
  } catch (err) {
    if (err instanceof ApiError) {
      logger.warn('inviteUserHandler: ApiError', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('inviteUserHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Accept an invitation to join a group.
 * Requires authenticated user in request context.
 */
export const acceptInviteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user?.userId;
    if (!userId) {
      logger.warn('acceptInviteHandler: Unauthorized access');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    logger.info('acceptInviteHandler: User accepting invite', { groupId, userId });

    const accepted = await groupService.acceptGroupInvite(groupId, userId);
    res.json(accepted);

    logger.info('acceptInviteHandler: Invite accepted', { groupId, userId });
  } catch (err) {
    if (err instanceof ApiError) {
      logger.warn('acceptInviteHandler: ApiError', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('acceptInviteHandler: Unexpected error', { error: err });
    next(err);
  }
};

/**
 * Change a group member's role.
 * Admin authorization should be enforced at route level.
 */
export const changeMemberRoleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const groupId = req.params.id;
    const { userId, role } = req.body;

    logger.info('changeMemberRoleHandler: Changing member role', { groupId, userId, role });

    const updated = await groupService.changeMemberRole(groupId, userId, role);
    res.json(updated);

    logger.info('changeMemberRoleHandler: Member role changed', { groupId, userId, role });
  } catch (err) {
    if (err instanceof ApiError) {
      logger.warn('changeMemberRoleHandler: ApiError', { message: err.message, statusCode: err.statusCode });
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error('changeMemberRoleHandler: Unexpected error', { error: err });
    next(err);
  }
};
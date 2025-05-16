/**
 * @file group.routes.ts
 *
 * @description
 * Defines Express routes for group-related API endpoints.
 * All routes are protected by authentication middleware.
 * Includes:
 * - Group creation
 * - Fetching group details by ID
 * - Updating group information
 * - Inviting users to groups
 * - Accepting group invitations
 * - Changing group member roles
 */

import express from 'express';
import * as groupController from '../controllers/group.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes below
router.use(authMiddleware);

/**
 * POST /api/groups
 * Create a new group.
 */
router.post('/', groupController.createGroupHandler);

/**
 * GET /api/groups/:id
 * Retrieve details of a group by ID.
 */
router.get('/:id', groupController.getGroupHandler);

/**
 * PATCH /api/groups/:id
 * Update group information.
 */
router.patch('/:id', groupController.updateGroupHandler);

/**
 * POST /api/groups/:id/invite
 * Invite a user to join the group.
 * Expected body: { userId: string }
 */
router.post('/:id/invite', groupController.inviteUserHandler);

/**
 * POST /api/groups/:id/accept
 * Accept an invitation to join the group.
 * Authenticated user accepts invite for group with :id.
 */
router.post('/:id/accept', groupController.acceptInviteHandler);

/**
 * POST /api/groups/:id/role
 * Change the role of a group member.
 * Expected body: { userId: string, role: 'ADMIN' | 'MEMBER' }
 */
router.post('/:id/role', groupController.changeMemberRoleHandler);

export default router;
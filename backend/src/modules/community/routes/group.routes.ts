/**
 * @file src/modules/community/routes/group.routes.ts
 * @description
 * Group Routes — Voluntary Group Management
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { GroupController } from '../controllers/group.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { z } from 'zod';
import { asyncHandler } from '../../../core/utils/response.js';

const router = Router();

router.use(authenticate);

router.post(
  '/voluntary/create',
  validateRequest({
    schema: z.object({
      name: z.string().min(3),
      voluntaryType: z.string(),
      description: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      wardId: z.string().uuid().optional(),
      constituencyId: z.string().uuid().optional(),
      countyId: z.string().uuid().optional(),
    }),
    target: 'body',
  }),
  asyncHandler(GroupController.createVoluntaryGroup)
);

router.post(
  '/join',
  validateRequest({
    schema: z.object({
      groupId: z.string().uuid(),
    }),
    target: 'body',
  }),
  asyncHandler(GroupController.joinGroup)
);

router.post(
  '/leave',
  validateRequest({
    schema: z.object({
      groupId: z.string().uuid(),
    }),
    target: 'body',
  }),
  asyncHandler(GroupController.leaveGroup)
);

router.get('/my-groups', asyncHandler(GroupController.getMyGroups));

router.get(
  '/',
  validateRequest({
    schema: z.object({
      isSystem: z.enum(['true', 'false']).optional(),
      voluntaryType: z.string().optional(),
      systemType: z.string().optional(),
      search: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
    target: 'query',
  }),
  asyncHandler(GroupController.getGroups)
);

router.get('/:groupId/my-role', asyncHandler(GroupController.getMyRole));

router.get(
  '/:groupId/declaration',
  asyncHandler(GroupController.getDeclaration)
);

router.get('/:groupId', asyncHandler(GroupController.getGroupDetail));

router.get(
  '/:groupId/members',
  validateRequest({
    schema: z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
    target: 'query',
  }),
  asyncHandler(GroupController.getGroupMembers)
);

router.patch(
  '/:groupId/settings',
  validateRequest({
    schema: z.object({
      name: z.string().min(3).max(100).optional(),
      description: z.string().max(500).optional(),
    }),
    target: 'body',
  }),
  asyncHandler(GroupController.updateGroupSettings)
);

router.patch(
  '/:groupId/members/:userId/role',
  validateRequest({
    schema: z.object({
      role: z.enum([
        'MEMBER',
        'LEADER',
        'TREASURER',
        'SECRETARY',
        'AUDITOR',
        'FACILITATOR',
        'MENTOR',
        'MODERATOR',
      ]),
    }),
    target: 'body',
  }),
  asyncHandler(GroupController.changeMemberRole)
);

router.delete(
  '/:groupId/members/:userId',
  asyncHandler(GroupController.removeMember)
);

router.delete(
  '/:groupId/dissolve',
  validateRequest({
    schema: z.object({
      reason: z.string().min(10).max(500).optional(),
    }),
    target: 'body',
  }),
  asyncHandler(GroupController.dissolveGroup)
);

export default router;

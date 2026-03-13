/**
 * @file src/modules/projects/routes/project.routes.ts
 * @description
 * Project Routes
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { prisma } from '../../../core/database/client.js';
import { ProjectController } from '../controllers/project.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { z } from 'zod';
import { asyncHandler } from '../../../core/utils/response.js';
import { roleService } from '../../../core/services/role.service.js';

const router = Router();

router.use(authenticate);

const listQuerySchema = z.object({
  ownerGroupId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  status: z
    .enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'CANCELLED', 'COMPLETED'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get(
  '/',
  validateRequest({ schema: listQuerySchema, target: 'query' }),
  asyncHandler(ProjectController.listProjects)
);

router.get(
  '/:projectId',
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  asyncHandler(ProjectController.getProject)
);

router.post(
  '/from-proposal',
  validateRequest({
    schema: z.object({
      proposalId: z.string().uuid(),
    }),
    target: 'body',
  }),
  asyncHandler(ProjectController.createFromProposal)
);

router.post(
  '/milestone/start',
  validateRequest({
    schema: z.object({
      milestoneId: z.string().uuid(),
    }),
    target: 'body',
  }),
  authorize({
    scopeCheck: async (req) => {
      const { milestoneId } = req.body;
      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { projectId: true },
      });
      if (!milestone) return false;
      return roleService.isProjectLeader(req.user!.userId, milestone.projectId);
    },
  }),
  asyncHandler(ProjectController.startMilestone)
);

router.post(
  '/milestone/submit',
  validateRequest({
    schema: z.object({
      milestoneId: z.string().uuid(),
      proofUrl: z.string().url(),
      description: z.string(),
    }),
    target: 'body',
  }),
  asyncHandler(ProjectController.submitMilestone)
);

router.post(
  '/milestone/verify',
  validateRequest({
    schema: z.object({
      milestoneId: z.string().uuid(),
      approved: z.boolean(),
      feedback: z.string().optional(),
    }),
    target: 'body',
  }),
  authorize({
    scopeCheck: async (req) => {
      const { milestoneId } = req.body;
      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { projectId: true },
      });
      if (!milestone) return false;
      const isLeader = await roleService.isProjectLeader(
        req.user!.userId,
        milestone.projectId
      );
      const isVerifier = await roleService.isVerifier(req.user!.userId);
      return isLeader || isVerifier;
    },
  }),
  asyncHandler(ProjectController.verifyMilestone)
);

export default router;

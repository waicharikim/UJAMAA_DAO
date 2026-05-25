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
import { ApiError } from '../../../core/errors/index.js';

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

// ── Work Logging ─────────────────────────────────────────────────────────────

router.post(
  '/work-log',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({
    schema: z.object({
      milestoneId: z.string().uuid(),
      workType: z.enum(['MANUAL_LABOR', 'SKILLED_WORK', 'SUPERVISION']),
      description: z.string().min(10).max(1000),
      hours: z.number().positive().max(24),
      photoUrls: z.array(z.string().url()).max(5).optional(),
      witnessIds: z.array(z.string().uuid()).max(3).optional(),
    }),
    target: 'body',
  }),
  asyncHandler(ProjectController.logWork)
);

router.post(
  '/work-log/verify',
  validateRequest({
    schema: z.object({
      workLogId: z.string().uuid(),
      approved: z.boolean(),
      feedback: z.string().max(500).optional(),
    }),
    target: 'body',
  }),
  authorize({
    scopeCheck: async (req) => {
      const { workLogId } = req.body;
      const workLog = await prisma.physicalWorkLog.findUnique({
        where: { id: workLogId },
        select: { projectId: true },
      });
      if (!workLog) throw new ApiError('Work log not found', 404);
      if (!workLog.projectId) return false;
      const isLeader = await roleService.isProjectLeader(
        req.user!.userId,
        workLog.projectId
      );
      const isVerifier = await roleService.isVerifier(req.user!.userId);
      return isLeader || isVerifier;
    },
  }),
  asyncHandler(ProjectController.verifyWork)
);

router.get(
  '/milestone/:milestoneId/work-logs',
  validateRequest({
    schema: z.object({ milestoneId: z.string().uuid() }),
    target: 'params',
  }),
  asyncHandler(ProjectController.listWorkLogs)
);

// ── Task Actions ─────────────────────────────────────────────────────────────
// These must be defined before /:projectId to avoid Express treating 'tasks' as a projectId

router.post(
  '/tasks',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({
    schema: z.object({
      milestoneId: z.string().uuid(),
      title: z.string().min(3).max(200),
      description: z.string().max(1000).optional(),
      skillCategory: z
        .enum([
          'GENERAL',
          'CONSTRUCTION',
          'MASONRY',
          'ELECTRICAL',
          'PLUMBING',
          'CARPENTRY',
          'PAINTING',
          'FARMING',
          'TRANSPORT',
          'ADMINISTRATION',
          'TECHNOLOGY',
          'HEALTH',
          'EDUCATION',
          'FINANCE',
        ])
        .optional(),
      maxAssignees: z.number().int().min(1).max(20).optional(),
      dueDate: z.string().datetime().optional(),
    }),
    target: 'body',
  }),
  asyncHandler(ProjectController.createTask)
);

router.post(
  '/tasks/:taskId/claim',
  validateRequest({
    schema: z.object({ taskId: z.string().min(1) }),
    target: 'params',
  }),
  asyncHandler(ProjectController.claimTask)
);

router.patch(
  '/tasks/:taskId/done',
  validateRequest({
    schema: z.object({ taskId: z.string().min(1) }),
    target: 'params',
  }),
  asyncHandler(ProjectController.completeTask)
);

// ── QR Work Sessions ─────────────────────────────────────────────────────────

router.post(
  '/work-sessions',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({
    schema: z.object({
      milestoneId: z.string().uuid(),
      durationMinutes: z.number().int().min(30).max(480),
    }),
    target: 'body',
  }),
  asyncHandler(ProjectController.createWorkSession)
);

router.post(
  '/work-sessions/scan',
  validateRequest({
    schema: z.object({ qrSecret: z.string().min(1) }),
    target: 'body',
  }),
  asyncHandler(ProjectController.scanQr)
);

router.post(
  '/work-sessions/:sessionId/attest',
  validateRequest({
    schema: z.object({ sessionId: z.string().uuid() }),
    target: 'params',
  }),
  validateRequest({
    schema: z.object({ targetUserId: z.string().uuid() }),
    target: 'body',
  }),
  asyncHandler(ProjectController.attestPresence)
);

router.post(
  '/work-sessions/:sessionId/close',
  validateRequest({
    schema: z.object({ sessionId: z.string().uuid() }),
    target: 'params',
  }),
  authorize({
    scopeCheck: async (req) => {
      const session = await prisma.workSession.findUnique({
        where: { id: req.params.sessionId },
        select: { projectId: true },
      });
      if (!session) return false;
      return roleService.isProjectLeader(req.user!.userId, session.projectId);
    },
  }),
  asyncHandler(ProjectController.closeWorkSession)
);

router.get(
  '/work-sessions/:sessionId',
  validateRequest({
    schema: z.object({ sessionId: z.string().uuid() }),
    target: 'params',
  }),
  asyncHandler(ProjectController.getWorkSession)
);

// ── Project Task Board & Contributions ───────────────────────────────────────

const taskListQuerySchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  skillCategory: z
    .enum([
      'GENERAL',
      'CONSTRUCTION',
      'MASONRY',
      'ELECTRICAL',
      'PLUMBING',
      'CARPENTRY',
      'PAINTING',
      'FARMING',
      'TRANSPORT',
      'ADMINISTRATION',
      'TECHNOLOGY',
      'HEALTH',
      'EDUCATION',
      'FINANCE',
    ])
    .optional(),
});

router.get(
  '/:projectId/tasks',
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  validateRequest({ schema: taskListQuerySchema, target: 'query' }),
  asyncHandler(ProjectController.listProjectTasks)
);

router.get(
  '/:projectId/contributions',
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  asyncHandler(ProjectController.getMemberContributions)
);

// ── Project Membership & Contributions ───────────────────────────────────────

router.post(
  '/:projectId/join',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  asyncHandler(ProjectController.joinProject)
);

router.post(
  '/:projectId/members',
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  validateRequest({
    schema: z.object({
      userId: z.string().uuid(),
      role: z.enum(['LEAD', 'MANAGER', 'CONTRIBUTOR', 'VIEWER']).optional(),
    }),
    target: 'body',
  }),
  authorize({
    scopeCheck: async (req) =>
      roleService.isProjectLeader(req.user!.userId, req.params.projectId),
  }),
  asyncHandler(ProjectController.addMember)
);

router.delete(
  '/:projectId/members/:userId',
  validateRequest({
    schema: z.object({
      projectId: z.string().uuid(),
      userId: z.string().uuid(),
    }),
    target: 'params',
  }),
  authorize({
    scopeCheck: async (req) =>
      roleService.isProjectLeader(req.user!.userId, req.params.projectId),
  }),
  asyncHandler(ProjectController.removeMember)
);

router.patch(
  '/:projectId/members/:userId/role',
  validateRequest({
    schema: z.object({
      projectId: z.string().uuid(),
      userId: z.string().uuid(),
    }),
    target: 'params',
  }),
  validateRequest({
    schema: z.object({
      role: z.enum(['LEAD', 'MANAGER', 'CONTRIBUTOR', 'VIEWER']),
    }),
    target: 'body',
  }),
  authorize({
    scopeCheck: async (req) =>
      roleService.isProjectLeader(req.user!.userId, req.params.projectId),
  }),
  asyncHandler(ProjectController.updateMemberRole)
);

router.post(
  '/:projectId/contribute',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  validateRequest({
    schema: z.object({
      amount: z.number().int().positive().max(100_000),
    }),
    target: 'body',
  }),
  asyncHandler(ProjectController.contribute)
);

// ── Project Updates ────────────────────────────────────────────────────────────

router.post(
  '/:projectId/updates',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  validateRequest({
    schema: z.object({
      content: z.string().min(1).max(1000).trim(),
    }),
    target: 'body',
  }),
  asyncHandler(ProjectController.createUpdate)
);

router.get(
  '/:projectId/updates',
  validateRequest({
    schema: z.object({ projectId: z.string().uuid() }),
    target: 'params',
  }),
  validateRequest({
    schema: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().min(1).max(30).optional(),
    }),
    target: 'query',
  }),
  asyncHandler(ProjectController.listUpdates)
);

export default router;

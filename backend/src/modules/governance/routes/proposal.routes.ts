/**
 * @file src/modules/governance/routes/proposal.routes.ts
 * @description
 * Proposal Routes
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { ProposalController } from '../controllers/proposal.controller.js';
import { ProposalAnnotationController } from '../controllers/proposal-annotation.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { z } from 'zod';
import { asyncHandler } from '../../../core/utils/response.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(ProposalController.listProposals));

router.get('/needs-action', asyncHandler(ProposalController.getNeedsAction));

router.get('/:proposalId', asyncHandler(ProposalController.getProposal));

router.post(
  '/:proposalId/review',
  validateRequest({
    schema: z
      .object({
        decision: z.enum(['APPROVE', 'REJECT']),
        note: z.string().min(10).max(500).optional(),
      })
      .superRefine((data, ctx) => {
        if (data.decision === 'REJECT' && !data.note) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['note'],
            message: 'A rejection reason is required (min 10 characters)',
          });
        }
      }),
    target: 'body',
  }),
  asyncHandler(ProposalController.reviewProposal)
);

router.post(
  '/:proposalId/resubmit',
  asyncHandler(ProposalController.resubmitProposal)
);

router.post(
  '/create',
  validateRequest({
    schema: z.object({
      groupId: z.string().uuid(),
      title: z.string().min(10),
      description: z.string().min(50),
      fundingAmountKes: z.number().optional(),
      isEmergency: z.boolean().optional(),
      proposalScope: z.enum(['GROUP', 'COMMUNITY']).optional(),
      groupFundingAmount: z.number().optional(),
      locationFundingRequest: z.number().optional(),
    }),
    target: 'body',
  }),
  asyncHandler(ProposalController.createProposal)
);

router.post(
  '/start-voting',
  validateRequest({
    schema: z.object({
      proposalId: z.string().uuid(),
    }),
    target: 'body',
  }),
  asyncHandler(ProposalController.startVoting)
);

router.post(
  '/vote',
  validateRequest({
    schema: z.object({
      proposalId: z.string().uuid(),
      option: z.enum(['YES', 'NO', 'ABSTAIN']),
    }),
    target: 'body',
  }),
  asyncHandler(ProposalController.castVote)
);

router.post('/:proposalId/tally', asyncHandler(ProposalController.tallyVotes));

// ── Annotations (inline public participation) ─────────────────────────────
const createAnnotationSchema = z
  .object({
    fieldKey: z.enum(['description', 'rationale', 'alternatives']),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(1),
    quotedText: z.string().min(1).max(500),
    comment: z.string().min(1).max(2000),
  })
  .superRefine((data, ctx) => {
    if (data.endOffset <= data.startOffset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endOffset'],
        message: 'endOffset must be greater than startOffset',
      });
    }
  });

const reactSchema = z.object({
  type: z.enum(['UP', 'DOWN']).nullable(),
});

router.post(
  '/:proposalId/annotations',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: createAnnotationSchema, target: 'body' }),
  asyncHandler(ProposalAnnotationController.createAnnotation)
);

router.get(
  '/:proposalId/annotations',
  asyncHandler(ProposalAnnotationController.listAnnotations)
);

router.delete(
  '/:proposalId/annotations/:annotationId',
  asyncHandler(ProposalAnnotationController.deleteAnnotation)
);

router.post(
  '/:proposalId/annotations/:annotationId/react',
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: reactSchema, target: 'body' }),
  asyncHandler(ProposalAnnotationController.reactToAnnotation)
);

router.patch(
  '/:proposalId/memory',
  validateRequest({
    schema: z.object({
      rationale: z.string().min(10).max(2000).optional(),
      alternatives: z.string().min(10).max(2000).optional(),
    }),
    target: 'body',
  }),
  asyncHandler(ProposalController.updateMemory)
);

router.patch(
  '/:proposalId/outcome',
  validateRequest({
    schema: z.object({
      outcome: z.string().min(10).max(2000),
    }),
    target: 'body',
  }),
  asyncHandler(ProposalController.recordOutcome)
);

router.post(
  '/:proposalId/cancel',
  asyncHandler(ProposalController.cancelProposal)
);

router.patch(
  '/:proposalId/progress',
  validateRequest({
    schema: z.object({
      status: z.enum(['EXECUTING', 'COMPLETED']),
      note: z.string().max(2000).optional(),
    }),
    target: 'body',
  }),
  asyncHandler(ProposalController.updateProgress)
);

export default router;

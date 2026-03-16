/**
 * @file src/modules/governance/routes/proposal.routes.ts
 * @description
 * Proposal Routes
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { ProposalController } from '../controllers/proposal.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
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
    schema: z.object({
      decision: z.enum(['APPROVE', 'REJECT']),
      note: z.string().max(500).optional(),
    }),
    target: 'body',
  }),
  asyncHandler(ProposalController.reviewProposal)
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

export default router;

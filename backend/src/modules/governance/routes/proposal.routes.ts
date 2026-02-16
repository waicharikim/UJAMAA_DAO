/**
 * @file src/modules/governance/routes/proposal.routes.ts
 * @description
 * Proposal Routes
 * Version: 2.0 — December 2025
 */

import { Router } from "express";
import { ProposalController } from "../controllers/proposal.controller.js";
import { authenticate } from "../../../core/middleware/auth.middleware.js";
import { validateRequest } from "../../../core/middleware/ValidateRequests.js";
import { z } from "zod";
import { asyncHandler } from "../../../core/utils/response.js";

const router = Router();

router.use(authenticate);

router.post(
  "/create",
  validateRequest({
    schema: z.object({
      groupId: z.string().uuid(),
      title: z.string().min(10),
      description: z.string().min(50),
      fundingAmountKes: z.number().optional(),
      isEmergency: z.boolean().optional(),
    }),
    target: "body",
  }),
  asyncHandler(ProposalController.createProposal)
);

router.post(
  "/start-voting",
  validateRequest({
    schema: z.object({
      proposalId: z.string().uuid(),
    }),
    target: "body",
  }),
  asyncHandler(ProposalController.startVoting)
);

router.post(
  "/vote",
  validateRequest({
    schema: z.object({
      proposalId: z.string().uuid(),
      option: z.enum(["YES", "NO", "ABSTAIN"]),
    }),
    target: "body",
  }),
  asyncHandler(ProposalController.castVote)
);

router.post(
  "/:proposalId/tally",
  asyncHandler(ProposalController.tallyVotes)
);

export default router;
// backend/src/routes/vote.ts

import { Router, Request, Response } from "express";
import prisma from '../prismaClient.js';
import { ProposalStatus } from "@prisma/client";
import {
  getTokenBalance,
  deductTokens,
  HolderType as TokenHolderType,
} from '../services/tokenServices.js';
import {
  getImpactPoints,
  addImpactPoints,
  HolderType as ImpactHolderType,
} from '../services/impactPointService.js';

const router = Router();

const MIN_IMPACT_POINTS_TO_VOTE = 10;  // Example threshold
const IMPACT_POINTS_REWARD = 5;        // Points rewarded per vote

/**
 * POST /api/votes/cast
 * Cast a vote on a proposal.
 * Body params:
 * - proposalId: string
 * - voterId: string (user or group ID)
 * - isGroup: boolean
 * - vote: boolean (true = yes, false = no)
 * - tokensSpent: number
 */
router.post("/cast", async (req: Request, res: Response) => {
  try {
    const { proposalId, voterId, isGroup, vote, tokensSpent } = req.body;

    // Input validation
    if (
      !proposalId ||
      typeof voterId !== "string" ||
      typeof isGroup !== "boolean" ||
      typeof vote !== "boolean" ||
      !tokensSpent ||
      tokensSpent <= 0
    ) {
      return res.status(400).json({ success: false, error: "Invalid input" });
    }

    // Fetch proposal to verify voting status
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) {
      return res.status(404).json({ success: false, error: "Proposal not found" });
    }
    if (proposal.status !== ProposalStatus.VOTING) {
      return res.status(403).json({ success: false, error: "Voting not open" });
    }

    // Determine holder types
    const tokenHolderType = isGroup ? TokenHolderType.GROUP : TokenHolderType.USER;
    const impactHolderType = isGroup ? ImpactHolderType.GROUP : ImpactHolderType.USER;

    // Check impact points eligibility
    const currentImpactPoints = await getImpactPoints(impactHolderType, voterId);
    if (currentImpactPoints < MIN_IMPACT_POINTS_TO_VOTE) {
      return res.status(403).json({
        success: false,
        error: `Insufficient impact points (${currentImpactPoints}). Minimum required is ${MIN_IMPACT_POINTS_TO_VOTE}.`,
      });
    }

    // Check token balance and deduct tokens
    const currentTokenBalance = await getTokenBalance(tokenHolderType, voterId);
    if (currentTokenBalance < tokensSpent) {
      return res.status(403).json({ success: false, error: "Insufficient tokens" });
    }
    await deductTokens(tokenHolderType, voterId, tokensSpent);

    // Record the vote
    await prisma.vote.create({
      data: {
        proposalId,
        voterId,
        isGroup,
        vote,
        tokensSpent,
      },
    });

    // Reward impact points for voting participation
    await addImpactPoints(impactHolderType, voterId, IMPACT_POINTS_REWARD);

    return res.status(200).json({ success: true, message: "Vote recorded" });
  } catch (error) {
    console.error("Vote casting error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /api/votes/proposal/:id
 * Get aggregated voting results for a proposal.
 */
router.get("/proposal/:id", async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    const votes = await prisma.vote.findMany({ where: { proposalId } });

    if (!votes.length) {
      return res.status(404).json({ success: false, error: "No votes found" });
    }

    const yesVotes = votes.filter((v) => v.vote === true).length;
    const noVotes = votes.length - yesVotes;

    return res.status(200).json({
      success: true,
      totalVotes: votes.length,
      yesVotes,
      noVotes,
      result: yesVotes > noVotes ? "Approved" : noVotes > yesVotes ? "Rejected" : "Tie",
    });
  } catch (error) {
    console.error("Vote aggregation error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
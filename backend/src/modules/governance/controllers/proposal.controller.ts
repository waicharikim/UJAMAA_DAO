/**
 * @file src/modules/governance/controllers/proposal.controller.ts
 * @description
 * Proposal Controller
 * Version: 2.0 — December 2025
 */

import { Request, Response } from "express";
import { sendSuccess } from "../../../core/utils/response.js";
import { proposalService } from "../services/proposal.service.js";

export class ProposalController {
  static async createProposal(req: Request, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const proposal = await proposalService.createProposal(userId, dto);
    sendSuccess(res, proposal, "Proposal created");
  }

  static async startVoting(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.body;
    const result = await proposalService.startVoting(userId, proposalId);
    sendSuccess(res, result, "Voting started");
  }

  static async castVote(req: Request, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const result = await proposalService.castVote(userId, dto);
    sendSuccess(res, result, "Vote cast");
  }

  static async tallyVotes(req: Request, res: Response) {
    const { proposalId } = req.params;
    const result = await proposalService.tallyVotes(proposalId);
    sendSuccess(res, result, "Votes tallied");
  }
}
/**
 * @file src/modules/governance/controllers/proposal.controller.ts
 * @description
 * Proposal Controller
 * Version: 2.0 — December 2025
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { proposalService } from '../services/proposal.service.js';
import { ProposalStatus } from '@prisma/client';

export class ProposalController {
  static async createProposal(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const proposal = await proposalService.createProposal(userId, dto);
    sendSuccess(res, proposal, 'Proposal created');
  }

  static async startVoting(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.body;
    const result = await proposalService.startVoting(userId, proposalId);
    sendSuccess(res, result, 'Voting started');
  }

  static async castVote(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const result = await proposalService.castVote(userId, dto);
    sendSuccess(res, result, 'Vote cast');
  }

  static async tallyVotes(req: AuthRequest, res: Response) {
    const { proposalId } = req.params;
    const result = await proposalService.tallyVotes(proposalId);
    sendSuccess(res, result, 'Votes tallied');
  }

  static async getProposal(req: AuthRequest, res: Response) {
    const { proposalId } = req.params;
    const result = await proposalService.getProposal(proposalId);
    sendSuccess(res, result, 'Proposal retrieved');
  }

  static async listProposals(req: AuthRequest, res: Response) {
    const { groupId, status, limit, offset } = req.query;
    const result = await proposalService.listProposals({
      groupId: groupId as string | undefined,
      status: status as ProposalStatus | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    sendSuccess(res, result, 'Proposals retrieved');
  }
}

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
import { prisma } from '../../../core/database/client.js';
import { ProposalStatus, ProposalScope } from '@prisma/client';

export class ProposalController {
  static async createProposal(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const proposal = await proposalService.createProposal(userId, dto);
    sendSuccess(res, proposal, 'Proposal created');
  }

  static async reviewProposal(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;
    const { decision, note } = req.body;
    const result = await proposalService.reviewProposal(
      userId,
      proposalId,
      { decision, note },
      req.user!.roles ?? []
    );
    sendSuccess(res, result, 'Proposal reviewed');
  }

  static async startVoting(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.body;
    const systemRoles = req.user!.roles ?? [];
    const result = await proposalService.startVoting(
      userId,
      proposalId,
      systemRoles
    );
    sendSuccess(res, result, 'Voting started');
  }

  static async getNeedsAction(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;

    // Find all groups where this user is LEADER or ADMIN
    const memberships = await prisma.groupMember.findMany({
      where: { userId, active: true },
      select: { groupId: true, role: true },
    });

    const leaderGroupIds = memberships
      .filter((m) => m.role === 'LEADER')
      .map((m) => m.groupId);

    const systemRoles = req.user!.roles ?? [];
    const isLocationAdmin = systemRoles.some((r: string) =>
      [
        'location:ward_admin',
        'location:constituency_admin',
        'location:county_admin',
        'system:compliance_officer',
        'system:super_admin',
      ].includes(r)
    );

    const [myDrafts, pendingReview, pendingAdminReview, approvedForVoting] =
      await Promise.all([
        // My own DRAFTs (as creator)
        prisma.proposal.findMany({
          where: { creatorId: userId, status: ProposalStatus.DRAFT },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        // PENDING_REVIEW in groups where I am LEADER (need to forward or reject)
        leaderGroupIds.length > 0
          ? prisma.proposal.findMany({
              where: {
                groupId: { in: leaderGroupIds },
                status: ProposalStatus.PENDING_REVIEW,
              },
              orderBy: { updatedAt: 'desc' },
              take: 10,
            })
          : [],
        // PENDING_REVIEW accessible to location admins
        isLocationAdmin
          ? prisma.proposal.findMany({
              where: { status: ProposalStatus.PENDING_REVIEW },
              orderBy: { updatedAt: 'desc' },
              take: 10,
            })
          : [],
        // APPROVED_FOR_VOTING in groups where I am LEADER (need to open voting)
        leaderGroupIds.length > 0
          ? prisma.proposal.findMany({
              where: {
                groupId: { in: leaderGroupIds },
                status: ProposalStatus.APPROVED_FOR_VOTING,
              },
              orderBy: { updatedAt: 'desc' },
              take: 10,
            })
          : [],
      ]);

    const seen = new Set<string>();
    const proposals = [
      ...myDrafts,
      ...pendingReview,
      ...pendingAdminReview,
      ...approvedForVoting,
    ].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    sendSuccess(
      res,
      { proposals, total: proposals.length },
      'Needs-action proposals'
    );
  }

  static async castVote(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const result = await proposalService.castVote(
      userId,
      dto,
      req.user!.primaryWardId
    );
    sendSuccess(res, result, 'Vote cast');
  }

  static async tallyVotes(req: AuthRequest, res: Response) {
    const { proposalId } = req.params;
    const userId = req.user!.userId;
    const callerSystemRoles = req.user!.roles ?? [];
    const result = await proposalService.tallyVotes(
      proposalId,
      userId,
      callerSystemRoles
    );
    sendSuccess(res, result, 'Votes tallied');
  }

  static async getProposal(req: AuthRequest, res: Response) {
    const { proposalId } = req.params;
    const result = await proposalService.getProposal(proposalId);
    sendSuccess(res, result, 'Proposal retrieved');
  }

  static async listProposals(req: AuthRequest, res: Response) {
    const { groupId, status, scope, limit, offset } = req.query;
    const result = await proposalService.listProposals({
      groupId: groupId as string | undefined,
      status: status as ProposalStatus | undefined,
      scope: scope as ProposalScope | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      callerContext: {
        roles: req.user!.roles ?? [],
        primaryWardId: req.user!.primaryWardId,
      },
    });
    sendSuccess(res, result, 'Proposals retrieved');
  }

  static async updateMemory(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;
    const { rationale, alternatives } = req.body;
    const result = await proposalService.updateMemory(userId, proposalId, {
      rationale,
      alternatives,
    });
    sendSuccess(res, result, 'Memory updated');
  }

  static async recordOutcome(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;
    const { outcome } = req.body;
    const result = await proposalService.recordOutcome(
      userId,
      proposalId,
      outcome
    );
    sendSuccess(res, result, 'Outcome recorded');
  }

  static async cancelProposal(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;
    const result = await proposalService.cancelProposal(userId, proposalId);
    sendSuccess(res, result, 'Proposal cancelled');
  }

  static async resubmitProposal(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;
    const result = await proposalService.resubmitProposal(userId, proposalId);
    sendSuccess(
      res,
      result,
      'Proposal resubmitted — it is now in Draft for revision'
    );
  }

  static async updateProgress(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;
    const { status, note } = req.body;
    const result = await proposalService.updateProgress(userId, proposalId, {
      status,
      note,
    });
    sendSuccess(res, result, 'Proposal progress updated');
  }
}

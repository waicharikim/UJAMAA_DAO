/**
 * @file src/modules/elections/controllers/election.controller.ts
 * @description
 * HTTP handlers for election endpoints.
 * All handlers delegate to ElectionService and use sendSuccess/sendError.
 *
 * Version: 1.0 — March 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { electionService } from '../services/election.service.js';

export class ElectionController {
  static async listElections(req: AuthRequest, res: Response) {
    const { groupId, countyId, scope, status, page, limit } = req.query as any;
    const result = await electionService.listElections(
      {
        groupId,
        countyId,
        scope,
        status,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
      req.user?.userId
    );
    sendSuccess(res, result, 'Elections retrieved');
  }

  static async getMyElections(req: AuthRequest, res: Response) {
    const items = await electionService.getMyActiveElections(req.user!.userId);
    sendSuccess(res, { items }, 'Active elections for you');
  }

  static async getElection(req: AuthRequest, res: Response) {
    const election = await electionService.getElection(
      req.params.electionId,
      req.user?.userId
    );
    sendSuccess(res, election, 'Election retrieved');
  }

  static async nominate(req: AuthRequest, res: Response) {
    const result = await electionService.nominate(
      req.user!.userId,
      req.params.electionId,
      req.body.statement
    );
    sendSuccess(res, result, 'Nomination submitted', 201);
  }

  static async withdrawNomination(req: AuthRequest, res: Response) {
    await electionService.withdrawNomination(
      req.user!.userId,
      req.params.electionId
    );
    sendSuccess(res, {}, 'Nomination withdrawn');
  }

  static async castVote(req: AuthRequest, res: Response) {
    const result = await electionService.castVote(
      req.user!.userId,
      req.params.electionId,
      req.body.candidateId
    );
    sendSuccess(res, result, 'Vote cast successfully', 201);
  }

  static async triggerSchedule(req: AuthRequest, res: Response) {
    const result = await electionService.scheduleElectionsForEligibleScopes();
    sendSuccess(res, result, 'Election scheduling scan complete');
  }

  static async triggerTally(req: AuthRequest, res: Response) {
    await electionService.tallyAndClose(req.params.electionId);
    sendSuccess(res, {}, 'Election tallied and closed');
  }
}

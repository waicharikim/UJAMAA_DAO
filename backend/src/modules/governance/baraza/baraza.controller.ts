/**
 * @file src/modules/governance/baraza/baraza.controller.ts
 * @description
 * HTTP handlers for the Baraza deliberation engine:
 *   GET  /proposals/:proposalId/baraza  — latest completed deliberation (any member)
 *   POST /proposals/:proposalId/baraza  — author-triggered pre-submission run
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { prisma } from '../../../core/database/client.js';
import { barazaDeliberationService } from './baraza-deliberation.service.js';
import { queueBarazaDeliberation } from './baraza.job.js';

export class BarazaController {
  /** Latest completed deliberation for a proposal (null if none yet). */
  static async getDeliberation(req: AuthRequest, res: Response) {
    const { proposalId } = req.params;
    const deliberation = await barazaDeliberationService.getLatest(proposalId);
    sendSuccess(res, deliberation, 'Deliberation fetched');
  }

  /** Author requests a deliberation on their own proposal before submitting. */
  static async requestDeliberation(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { creatorId: true, groupId: true },
    });
    if (!proposal) throw ApiError.notFound('Proposal');
    if (proposal.creatorId !== userId)
      throw ApiError.forbidden(
        'Only the proposal author can request a deliberation'
      );
    if (!proposal.groupId)
      throw ApiError.badRequest(
        'This proposal has no associated group to deliberate within'
      );

    await queueBarazaDeliberation(proposalId, proposal.groupId, 'AUTHOR');
    sendSuccess(res, { queued: true }, 'Deliberation queued');
  }
}

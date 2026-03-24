/**
 * @file src/modules/community/controllers/conflict.controller.ts
 * @description Conflict Case Controller
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { conflictService } from '../services/conflict.service.js';

export class ConflictController {
  static async fileConflict(req: AuthRequest, res: Response) {
    const complainantId = req.user!.userId;
    const { respondentId, description, evidence } = req.body;
    const conflict = await conflictService.fileConflict(complainantId, {
      respondentId,
      description,
      evidence,
    });
    sendSuccess(res, conflict, 'Conflict case filed', 201);
  }

  static async listMyCases(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const cases = await conflictService.listUserCases(userId);
    sendSuccess(res, cases, 'Cases retrieved');
  }

  static async getCase(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { caseId } = req.params;
    const conflict = await conflictService.getCase(userId, caseId);
    sendSuccess(res, conflict, 'Case retrieved');
  }

  static async resolveCase(req: AuthRequest, res: Response) {
    const actorId = req.user!.userId;
    const { caseId } = req.params;
    const { resolution } = req.body;
    const result = await conflictService.resolveCase(
      actorId,
      caseId,
      resolution
    );
    sendSuccess(res, result, 'Case resolved');
  }
}

/**
 * @file src/modules/treasury/handlers/treasury.handlers.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { treasuryService } from '../services/treasury.service.js';
import { TransactionQueryDto } from '../types.js';

export class TreasuryHandlers {
  static async getMyGroupsSummary(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const summary = await treasuryService.getMyGroupsSummary(userId);
    sendSuccess(res, summary, 'My group treasuries retrieved');
  }

  static async getGroupTreasury(req: AuthRequest, res: Response) {
    const { groupId } = req.params;
    const treasury = await treasuryService.getGroupTreasury(groupId);
    sendSuccess(res, treasury, 'Treasury retrieved');
  }

  static async getTransactions(req: AuthRequest, res: Response) {
    const { groupId } = req.params;
    const query = req.query as unknown as TransactionQueryDto;
    const result = await treasuryService.getTransactions(groupId, query);
    sendSuccess(res, result, 'Transactions retrieved');
  }
}

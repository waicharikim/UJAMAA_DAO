/**
 * @file src/modules/economy/handlers/economy.handlers.ts
 * @description
 * Request handlers for economy endpoints
 *
 * Exposes:
 * - PR balance & history
 * - Dues payment history & status
 * - User commitments list
 * - Opt-in to monthly dues commitment
 *
 * Version: 1.1 — January 2026
 * Updated: Removed unused validator imports, made code airtight
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../services/participationRights.service.js';
import { duesService } from '../services/dues.service.js';
import { commitmentService } from '../services/commitment.service.js';
import { utWithdrawalService } from '../services/utWithdrawal.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { DuesTier } from '../types.js';

/**
 * GET /economy/pr
 * Get user's Participation Rights balance + recent history
 * Requires: COMMUNITY_VERIFIED
 */
export async function getPRBalance(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  const balance = await participationRightsService.getBalance(userId);
  const logs = await prisma.participationRightsLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20, // last 20 transactions
  });

  const history = logs.map((log) => ({
    amount: log.amount,
    balance: log.balance,
    reason: log.reason,
    createdAt: log.createdAt,
    metadata: log.metadata,
  }));

  sendSuccess(
    res,
    { balance, history },
    'Participation Rights retrieved successfully',
    200
  );
}

/**
 * GET /economy/dues/history
 * Get user's dues payment history & totals
 * Requires: COMMUNITY_VERIFIED
 */
export async function getDuesHistory(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  const status = await duesService.getUserCommitments(userId);

  sendSuccess(res, status, 'Dues payment history retrieved successfully', 200);
}

/**
 * GET /economy/commitments
 * Get user's active and past commitments
 * Requires: COMMUNITY_VERIFIED
 */
export async function getCommitments(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;

  const commitments = await commitmentService.getUserCommitments(userId);

  sendSuccess(res, commitments, 'Commitments retrieved successfully', 200);
}

/**
 * POST /economy/commitments/dues
 * Opt-in to monthly dues commitment
 * Requires: COMMUNITY_VERIFIED
 * Rate limited: 1 per month
 */
export async function optInDuesCommitment(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { tier, startPeriod, durationMonths } = req.body;

  const commitment = await duesService.createDuesCommitment(
    userId,
    tier as DuesTier,
    startPeriod,
    durationMonths
  );

  sendSuccess(
    res,
    commitment,
    'Dues commitment created successfully (voluntary monthly)',
    201
  );
}

/**
 * POST /economy/ut/withdraw
 * Cash out fiatBackedUtBalance → M-Pesa
 * Requires: COMMUNITY_VERIFIED
 */
export async function withdrawUt(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const result = await utWithdrawalService.withdraw(userId, req.body);
  sendSuccess(res, result, 'Withdrawal initiated — payout pending', 202);
}

/**
 * GET /economy/ut/withdrawals
 * Get user's UT withdrawal history + current balances
 * Requires: COMMUNITY_VERIFIED
 */
export async function getUtWithdrawals(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const result = await utWithdrawalService.getWithdrawals(userId);
  sendSuccess(res, result, 'UT withdrawal history retrieved', 200);
}

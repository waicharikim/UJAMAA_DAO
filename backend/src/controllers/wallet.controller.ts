/**
 * @file wallet.controller.ts
 * @description Wallet Controller: Handles read-only operations for wallet balances and transactions.
 *
 * NOTE: All write operations (updates) are handled by the economic/transfer service.
 */

import type { Response, NextFunction } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { getBalanceValidation, getTransactionsValidation } from '../validation/wallet.validation.js';
import * as walletService from '../services/wallet.service.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

// --- Authorization Helper ---
// Helper function to resolve the target ID based on ownership and role
function resolveHolderId(req: AuthRequest, holderType: 'USER' | 'GROUP', isGroupAdmin: boolean): string {
  // If requesting USER wallet, must be the authenticated user's ID
  if (holderType === 'USER') {
    return req.user!.userId;
  }

  // If requesting GROUP wallet
  const groupId = req.query.groupId;
  if (!groupId) {
    throw new ApiError('Group ID is required for GROUP holderType', 400, { code: 'GROUP_ID_REQUIRED' });
  }

  // Only group admins or auditors can view group wallets
  if (!isGroupAdmin) {
    throw new ApiError('Insufficient permissions to view this group wallet.', 403, { code: 'RBAC_GROUP_VIOLATION' });
  }

  return groupId as string;
}

/**
 * GET /wallet/balance
 * Get wallet balance for authenticated user or an authorized group.
 */
export const getBalanceHandler = [
  // 1. RBAC Check: Only the owner or a designated auditor/admin can access.
  authorize({
    allowedRoles: ['*'], // Self-service for all authenticated users
    requiredVerificationLevel: 'PHONE_VERIFIED'
  }),
  // 2. Zod Validation: Validates holderType and groupId (if present)
  validateRequest(getBalanceValidation),
  // 3. Controller Logic
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { holderType } = req.query as { holderType: 'USER' | 'GROUP' };
    const isGroupAdmin = req.userRoles?.some(r => r.role === 'group:admin' || r.role === 'economic:auditor');

    // Determine the ID based on permissions
    const holderId = resolveHolderId(req, holderType, isGroupAdmin || false);

    logger.info('Wallet: Fetching balance', { userId: req.user!.userId, holderType, holderId });

    // Ensure only the user's own wallet is retrieved unless they are an admin
    if (holderType === 'USER' && holderId !== req.user!.userId) {
         // This check is mainly a double-check, as resolveHolderId should handle it
        throw new ApiError('Unauthorized access to another user\'s wallet.', 403, { code: 'UNAUTHORIZED_WALLET_ACCESS' });
    }

    const wallet = await walletService.getWalletBalance(holderType, holderId);

    // Return human-friendly value
    res.json({
      data: {
        holderId: holderId,
        holderType: holderType,
        balance: wallet.balance.toString(),
        currency: wallet.currency,
      },
      meta: {
        updatedAt: wallet.updatedAt.toISOString(),
      }
    });
  })
];

/**
 * GET /wallet/transactions
 * Get wallet transactions for authenticated user or an authorized group.
 */
export const getTransactionsHandler = [
  // 1. RBAC Check: Same access rules as getting the balance
  authorize({
    allowedRoles: ['*'],
    requiredVerificationLevel: 'PHONE_VERIFIED'
  }),
  // 2. Zod Validation: Validates all query params (holderType, groupId, limit, offset)
  validateRequest(getTransactionsValidation),
  // 3. Controller Logic
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { holderType, limit, offset } = req.query as { holderType: 'USER' | 'GROUP', limit: number, offset: number };
    const isGroupAdmin = req.userRoles?.some(r => r.role === 'group:admin' || r.role === 'economic:auditor');

    // Determine the ID based on permissions
    const holderId = resolveHolderId(req, holderType, isGroupAdmin || false);

    // Ensure only the user's own wallet is retrieved unless they are an admin
    if (holderType === 'USER' && holderId !== req.user!.userId) {
        throw new ApiError('Unauthorized access to another user\'s wallet history.', 403, { code: 'UNAUTHORIZED_HISTORY_ACCESS' });
    }

    logger.info('Wallet: Fetching transactions', { userId: req.user!.userId, holderType, holderId, limit, offset });

    const txs = await walletService.getWalletTransactions(holderType, holderId, limit, offset);

    // Map transactions to strip sensitive internal fields if necessary, and format decimals
    const formattedTxs = txs.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toString(),
      mpesaReceipt: t.mpesaReceipt,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    }));

    res.json({
      data: formattedTxs,
      meta: {
        holderId: holderId,
        holderType: holderType,
        pagination: { limit, offset, count: formattedTxs.length },
      }
    });
  })
];

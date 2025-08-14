import type { Request, Response, NextFunction } from 'express';
import * as walletService from '../services/wallet.service.js';
import { ApiError } from '../utils/ApiError.js';

// Get wallet balance for authenticated user or group
export async function getBalanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });

    const holderType = (req.query.holderType as string)?.toUpperCase() === 'GROUP' ? 'GROUP' : 'USER';
    const holderId = holderType === 'USER' ? req.user.userId : (req.query.groupId as string);

    if (!holderId) throw new ApiError('holderId required', 400);

    const wallet = await walletService.getWalletBalance(holderType, holderId);

    // Return human-friendly value
    res.json({
      balance: wallet.balance.toString(),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

// Get wallet transactions for authenticated user or group
export async function getTransactionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });

    const holderType = (req.query.holderType as string)?.toUpperCase() === 'GROUP' ? 'GROUP' : 'USER';
    const holderId = holderType === 'USER' ? req.user.userId : (req.query.groupId as string);
    if (!holderId) throw new ApiError('holderId required', 400);

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const txs = await walletService.getWalletTransactions(holderType, holderId, limit, offset);

    res.json({ transactions: txs.map(t => ({ 
      id: t.id,
      type: t.type,
      amount: t.amount.toString(),
      mpesaReceipt: t.mpesaReceipt,
      status: t.status,
      createdAt: t.createdAt,
    })) });
  } catch (err) {
    next(err);
  }
}
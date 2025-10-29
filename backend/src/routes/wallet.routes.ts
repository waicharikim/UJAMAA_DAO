/**
 * @file wallet.routes.ts
 *
 * @description
 * Express router for the UJAMAADAO Wallet system.
 * Handles read-only operations for user and group balances/transactions.
 */

import { Router } from 'express';
import { getBalanceHandler, getTransactionsHandler } from '../controllers/wallet.controller.js';
import { authenticate } from '../middlewares/authenticate.js'; // Assuming this exists

const walletRouter = Router();

// Middleware applied to all wallet routes
walletRouter.use(authenticate);

/**
 * GET /api/wallet/balance
 * Fetches the current balance for the authenticated user or an authorized group.
 * Protected by RBAC (authorize) and input validation (validateRequest).
 */
walletRouter.get('/balance', getBalanceHandler);

/**
 * GET /api/wallet/transactions
 * Fetches the paginated transaction history for the authenticated user or an authorized group.
 * Protected by RBAC (authorize) and input validation (validateRequest).
 */
walletRouter.get('/transactions', getTransactionsHandler);


export default walletRouter;

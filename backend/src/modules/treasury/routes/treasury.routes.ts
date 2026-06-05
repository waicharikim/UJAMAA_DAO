/**
 * @file src/modules/treasury/routes/treasury.routes.ts
 *
 * GET  /treasury/:groupId              — get treasury (any member, SUPER_ADMIN)
 * GET  /treasury/:groupId/transactions — transaction history (LEADER, SUPER_ADMIN)
 *
 * Treasury funds move ONLY through governed paths — there is deliberately NO
 * manual admin deposit/withdraw endpoint, so no single person can move community
 * funds (ADR / launch integrity: "nobody controls it alone"):
 *   - IN  → M-Pesa deposits credit the treasury (payments module).
 *   - OUT → governance-approved proposal disbursement (governance module).
 * The treasuryService.deposit/withdraw methods remain, called only by those
 * governed flows — never directly from an HTTP route.
 */

import { Router } from 'express';
import { TreasuryHandlers } from '../handlers/treasury.handlers.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import { transactionQuerySchema } from '../validators/treasury.validators.js';

const router = Router();

router.use(authenticate);

// Summary of all group treasuries the user belongs to
router.get('/my-groups', asyncHandler(TreasuryHandlers.getMyGroupsSummary));

// Any authenticated user can view treasury info
router.get('/:groupId', asyncHandler(TreasuryHandlers.getGroupTreasury));

router.get(
  '/:groupId/transactions',
  validateRequest({ schema: transactionQuerySchema, target: 'query' }),
  asyncHandler(TreasuryHandlers.getTransactions)
);

export default router;

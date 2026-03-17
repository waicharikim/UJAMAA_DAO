/**
 * @file src/modules/treasury/routes/treasury.routes.ts
 *
 * GET  /treasury/:groupId              — get treasury (any member, SUPER_ADMIN)
 * GET  /treasury/:groupId/transactions — transaction history (LEADER, SUPER_ADMIN)
 * POST /treasury/:groupId/deposit      — credit treasury (SUPER_ADMIN only)
 * POST /treasury/:groupId/withdraw     — debit treasury (SUPER_ADMIN only)
 */

import { Router } from 'express';
import { TreasuryHandlers } from '../handlers/treasury.handlers.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import { SystemRoles } from '../../../core/rbac/roles.js';
import {
  depositSchema,
  withdrawSchema,
  transactionQuerySchema,
} from '../validators/treasury.validators.js';

const router = Router();

router.use(authenticate);

// Any authenticated user can view treasury info
router.get('/:groupId', asyncHandler(TreasuryHandlers.getGroupTreasury));

router.get(
  '/:groupId/transactions',
  validateRequest({ schema: transactionQuerySchema, target: 'query' }),
  asyncHandler(TreasuryHandlers.getTransactions)
);

router.post(
  '/:groupId/deposit',
  authorize({ allowedRoles: [SystemRoles.SUPER_ADMIN] }),
  validateRequest({ schema: depositSchema, target: 'body' }),
  asyncHandler(TreasuryHandlers.deposit)
);

router.post(
  '/:groupId/withdraw',
  authorize({ allowedRoles: [SystemRoles.SUPER_ADMIN] }),
  validateRequest({ schema: withdrawSchema, target: 'body' }),
  asyncHandler(TreasuryHandlers.withdraw)
);

export default router;

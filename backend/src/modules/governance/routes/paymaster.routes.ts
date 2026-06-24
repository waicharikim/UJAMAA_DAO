/**
 * @file src/modules/governance/routes/paymaster.routes.ts
 *
 * POST /api/v1/governance/paymaster — NO auth; ERC-7677 paymaster proxy for
 * gasless user-signed castVote transactions. Mounted BEFORE the authenticated
 * governance router so it is not caught by `router.use(authenticate)`.
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/utils/response.js';
import { paymasterProxy } from '../controllers/paymaster.controller.js';

const router = Router();

router.post('/', asyncHandler(paymasterProxy));

export default router;

/**
 * @file src/modules/payments/routes/payment.routes.ts
 *
 * POST /api/v1/payments/initiate           — auth required; start M-Pesa STK push (Buni)
 * POST /api/v1/payments/webhook/buni       — NO auth; Buni/Safaricom STK push callback
 * POST /api/v1/payments/webhook/buni-b2c   — NO auth; Buni/Safaricom B2C result callback
 * GET  /api/v1/payments/status/:txRef      — auth required; poll payment status
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/utils/response.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import {
  initiatePaymentSchema,
  buniCallbackSchema,
  buniB2cCallbackSchema,
  txRefParamSchema,
} from '../validators/payment.validators.js';
import {
  initiatePayment,
  handleBuniWebhook,
  handleBuniB2cWebhook,
  getPaymentStatus,
} from '../handlers/payment.handlers.js';

const router = Router();

/** POST /initiate — auth required */
router.post(
  '/initiate',
  authenticate,
  validateRequest({ schema: initiatePaymentSchema, target: 'body' }),
  asyncHandler(initiatePayment)
);

/** POST /webhook/buni — Buni/Safaricom STK callback; NO auth */
router.post(
  '/webhook/buni',
  validateRequest({ schema: buniCallbackSchema, target: 'body' }),
  asyncHandler(handleBuniWebhook)
);

/** POST /webhook/buni-b2c — Buni/Safaricom B2C result callback; NO auth */
router.post(
  '/webhook/buni-b2c',
  validateRequest({ schema: buniB2cCallbackSchema, target: 'body' }),
  asyncHandler(handleBuniB2cWebhook)
);

/** GET /status/:txRef — auth required */
router.get(
  '/status/:txRef',
  authenticate,
  validateRequest({ schema: txRefParamSchema, target: 'params' }),
  asyncHandler(getPaymentStatus)
);

export default router;

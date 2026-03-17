/**
 * @file src/modules/payments/routes/payment.routes.ts
 *
 * POST /api/v1/payments/initiate         — auth required; start M-Pesa (Buni) or card (Flutterwave)
 * POST /api/v1/payments/webhook          — NO auth; Flutterwave card webhook
 * POST /api/v1/payments/webhook/buni     — NO auth; Buni/Safaricom STK push callback
 * GET  /api/v1/payments/status/:txRef    — auth required; poll payment status
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/utils/response.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import {
  initiatePaymentSchema,
  webhookPayloadSchema,
  buniCallbackSchema,
  txRefParamSchema,
} from '../validators/payment.validators.js';
import {
  initiatePayment,
  handleWebhook,
  handleBuniWebhook,
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

/** POST /webhook — Flutterwave card; NO auth */
router.post(
  '/webhook',
  validateRequest({ schema: webhookPayloadSchema, target: 'body' }),
  asyncHandler(handleWebhook)
);

/** POST /webhook/buni — Buni/Safaricom STK callback; NO auth */
router.post(
  '/webhook/buni',
  validateRequest({ schema: buniCallbackSchema, target: 'body' }),
  asyncHandler(handleBuniWebhook)
);

/** GET /status/:txRef — auth required */
router.get(
  '/status/:txRef',
  authenticate,
  validateRequest({ schema: txRefParamSchema, target: 'params' }),
  asyncHandler(getPaymentStatus)
);

export default router;

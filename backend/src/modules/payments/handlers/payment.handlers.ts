import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { InitiatePaymentDto, BuniCallbackPayload } from '../types.js';

/**
 * POST /api/v1/payments/initiate
 * Auth required — start an M-Pesa STK push via Buni
 */
export async function initiatePayment(
  req: Request,
  res: Response
): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) throw ApiError.authenticationError('Not authenticated');

  const dto: InitiatePaymentDto = req.body;
  const result = await paymentService.initiatePayment(userId, dto);
  sendSuccess(res, result, 'Payment initiated', 200);
}

/**
 * POST /api/v1/payments/webhook/buni
 * NO auth — Buni/Safaricom STK push callback; must respond with KCB ack format
 */
export async function handleBuniWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const payload = req.body as BuniCallbackPayload;
  const ack = await paymentService.handleBuniWebhook(payload);
  res.status(200).json(ack);
}

/**
 * GET /api/v1/payments/status/:txRef
 * Auth required — poll payment status
 */
export async function getPaymentStatus(
  req: Request,
  res: Response
): Promise<void> {
  const userId = (req as any).user?.userId;
  if (!userId) throw ApiError.authenticationError('Not authenticated');

  const { txRef } = req.params;
  const record = await paymentService.getPaymentStatus(txRef, userId);
  sendSuccess(res, record, 'Payment status', 200);
}

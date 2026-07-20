/**
 * @file src/modules/economy/jobs/ut-payout.jobs.ts
 *
 * BullMQ job: process-mpesa-payout
 *
 * Triggered by utWithdrawalService.withdraw() immediately after the
 * UtWithdrawal record is created with status PENDING.
 *
 * Calls Buni B2C payout API. Status stays PENDING until the B2C callback
 * at POST /payments/webhook/buni-b2c confirms success or failure.
 *
 * On job failure (network error, Buni error): BullMQ retries 3× with
 * exponential backoff. After all retries exhausted, the failed-job handler
 * in workers.ts calls utWithdrawalService.refundPayout() to return the
 * balance to the user.
 */

import { logger } from '../../../core/logger/logger.js';
import { prisma } from '../../../core/database/client.js';
import { paymentService } from '../../payments/services/payment.service.js';

export const MPESA_PAYOUT_JOB = 'process-mpesa-payout';

export interface MpesaPayoutJobData {
  withdrawalId: string;
  amountKes: number;
  mpesaPhone: string;
}

export async function processMpesaPayout(
  data: MpesaPayoutJobData
): Promise<void> {
  const { withdrawalId, amountKes, mpesaPhone } = data;

  const withdrawal = await prisma.utWithdrawal.findUnique({
    where: { id: withdrawalId },
  });

  if (!withdrawal) {
    logger.warn(
      { withdrawalId },
      '[PAYOUT] Withdrawal record not found — skipping'
    );
    return;
  }

  if (withdrawal.status !== 'PENDING') {
    logger.info(
      { withdrawalId, status: withdrawal.status },
      '[PAYOUT] Already processed — idempotent skip'
    );
    return;
  }

  await paymentService.initiateB2CPayout({
    withdrawalId,
    amountKes,
    mpesaPhone,
  });

  logger.info(
    { withdrawalId, amountKes },
    '[PAYOUT] B2C payout request accepted — awaiting callback'
  );
}

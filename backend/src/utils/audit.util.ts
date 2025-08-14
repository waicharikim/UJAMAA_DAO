/**
 * @file audit.util.ts
 * @description
 * Transaction-aware audit helper. Writes a userAudit row using the
 * provided transaction client (tx) if given, otherwise falls back to global prisma.
 *
 * When used inside a prisma.$transaction, pass the tx client so the audit write
 * participates in the same transaction as the state change.
 */

import prisma from '../prismaClient.js';
import logger from './logger.js';
import type { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient | typeof prisma;

export async function logUserAudit(
  params: {
    userId: string;
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
    changedBy?: string | null;
  },
  tx?: TxClient
) {
  const client = tx ?? prisma;

  // Create the audit row. If called inside a transaction (tx provided), this uses tx.
  try {
    return await client.userAudit.create({
      data: {
        userId: params.userId,
        field: params.field,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        changedBy: params.changedBy ?? null,
        timestamp: new Date(),
      },
    });
  } catch (err) {
    // Log and rethrow so caller (transaction) can decide rollback behavior.
    logger.error('logUserAudit failed', { err, userId: params.userId, field: params.field });
    throw err;
  }
}
/**
 * @file src/modules/treasury/jobs/treasury.jobs.ts
 * @description
 * On-demand worker job that mirrors a treasury ledger movement on-chain.
 *
 * Enqueued by treasuryService.deposit/withdraw after the DB write. The anchor is
 * signed with the RECORDER_ROLE minter key which lives on the WORKER only — so a
 * deposit/withdraw that ran on the web process still gets anchored here. Mirrors
 * the governance CLOSE_PROPOSAL_ONCHAIN_JOB pattern exactly.
 *
 * Best-effort + null-guarded: a no-op when the chain is unconfigured
 * (getTreasuryContract() === null, i.e. no TREASURY_CONTRACT_ADDRESS / minter
 * key). The off-chain ledger is always the source of truth; anchoring is a
 * tamper-evident mirror that activates the moment the env is set — no code change.
 */

import { ethers } from 'ethers';
import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { getTreasuryContract } from '../../../core/blockchain/client.js';

export const ANCHOR_TREASURY_TX_JOB = 'anchor-treasury-tx';

export interface AnchorTreasuryTxPayload {
  transactionId: string;
}

/**
 * Anchor a single WalletTransaction's record hash on-chain.
 *
 * Idempotent: re-running re-anchors the same hash (the contract has no dedup
 * guard by design — a correction can be re-anchored), so at-least-once delivery
 * is safe. Skips if the row already carries an anchorTxHash.
 */
export async function processAnchorTreasuryTx(
  transactionId: string
): Promise<void> {
  const treasury = getTreasuryContract();
  if (!treasury) return; // dormant — chain not configured (web or pre-deploy)

  const tx = await prisma.walletTransaction.findUnique({
    where: { id: transactionId },
    include: { treasury: { select: { groupId: true } } },
  });
  if (!tx) return;
  if (tx.anchorTxHash) return; // already anchored

  try {
    const txIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(tx.id));
    const groupIdBytes32 = ethers.keccak256(
      ethers.toUtf8Bytes(tx.treasury.groupId)
    );
    const dataHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        `${tx.id}:${tx.treasuryId}:${tx.amount.toString()}:${tx.currency}:${tx.transactionType}:${tx.referenceType ?? ''}:${tx.createdAt.toISOString()}:${tx.initiatedById ?? ''}`
      )
    );
    const kind = tx.transactionType === 'DEBIT' ? 1 : 0;

    const chainTx = await treasury.recordTransaction(
      txIdBytes32,
      groupIdBytes32,
      dataHash,
      kind
    );

    await prisma.walletTransaction.update({
      where: { id: tx.id },
      data: { anchorTxHash: chainTx.hash },
    });

    logger.info(
      { job: ANCHOR_TREASURY_TX_JOB, transactionId, txHash: chainTx.hash },
      '[TREASURY] Ledger movement anchored on-chain'
    );
  } catch (err) {
    logger.warn(
      { job: ANCHOR_TREASURY_TX_JOB, transactionId, err },
      '[TREASURY] On-chain anchor failed — off-chain ledger intact'
    );
  }
}

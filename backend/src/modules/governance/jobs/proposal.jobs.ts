/**
 * @file src/modules/governance/jobs/proposal.jobs.ts
 * @description
 * BullMQ job processors for proposal lifecycle automation.
 *
 * Two jobs run on the governance queue daily:
 *  1. tally-proposals        — close voting on proposals past votingEndsAt
 *  2. expire-proposal-review — auto-reject PENDING_REVIEW proposals older than 30 days
 */

import { prisma } from '../../../core/database/client.js';
import { logger } from '../../../core/logger/logger.js';
import { proposalService } from '../services/proposal.service.js';
import { deliberationService } from '../services/deliberation.service.js';
import { notificationService } from '../../notifications/services/notification.service.js';
import { NotificationType } from '../../notifications/types.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { getGovernanceContract } from '../../../core/blockchain/client.js';
import { ethers } from 'ethers';

export const TALLY_PROPOSALS_JOB = 'tally-proposals';
export const EXPIRE_PROPOSAL_REVIEW_JOB = 'expire-proposal-review';
export const GENERATE_DELIBERATION_SUMMARY_JOB =
  'generate-deliberation-summary';
export const OPEN_PROPOSAL_ONCHAIN_JOB = 'open-proposal-onchain';

/**
 * On-demand job enqueued when voting opens. Opens the on-chain voting window so
 * users can cast unforgeable, self-signed votes (GovernanceVoting.castVote with
 * msg.sender = voter). Best-effort: the off-chain DB record is the source of
 * truth for tally/quorum UX; the chain is the trustless mirror. No-op on the web
 * service / when blockchain env is unset (getGovernanceContract() === null).
 *
 * Idempotent: skips if the proposal is already open/closed on-chain, so retries
 * and at-least-once delivery are safe.
 */
export async function processOpenProposalOnChain(
  proposalId: string
): Promise<void> {
  const gov = getGovernanceContract();
  if (!gov) return;

  try {
    const id = ethers.keccak256(ethers.toUtf8Bytes(proposalId));
    const status: bigint = await gov.proposalStatus(id);
    if (status !== 0n) {
      logger.info(
        {
          job: OPEN_PROPOSAL_ONCHAIN_JOB,
          proposalId,
          status: status.toString(),
        },
        '[GOV] Proposal already opened/closed on-chain — skipping'
      );
      return;
    }
    await gov.openProposal(id);
    logger.info(
      { job: OPEN_PROPOSAL_ONCHAIN_JOB, proposalId },
      '[GOV] On-chain voting window opened'
    );
  } catch (err) {
    logger.warn(
      { proposalId, err },
      '[GOV] On-chain openProposal failed — DB voting record intact'
    );
  }
}

/**
 * On-demand job enqueued when voting opens. Distils community annotations into
 * a neutral digest. No-op when CLAUDE_API_KEY is unset.
 */
export async function processGenerateDeliberationSummary(
  proposalId: string
): Promise<void> {
  logger.info(
    { job: GENERATE_DELIBERATION_SUMMARY_JOB, proposalId },
    '[Proposals] Generating deliberation summary'
  );
  await deliberationService.generateAndStore(proposalId);
}

export async function processTallyProposals(): Promise<void> {
  logger.info(
    { job: TALLY_PROPOSALS_JOB },
    '[Proposals] Tallying expired votes'
  );

  const expired = await prisma.proposal.findMany({
    where: {
      status: 'VOTING',
      votingEndsAt: { lte: new Date() },
    },
    select: { id: true, title: true },
  });

  let tallied = 0;
  for (const proposal of expired) {
    try {
      await proposalService.tallyVotes(proposal.id);
      tallied++;
    } catch (err) {
      logger.error(
        { proposalId: proposal.id, err },
        '[Proposals] Failed to tally proposal'
      );
    }
  }

  logger.info(
    { tallied, total: expired.length },
    '[Proposals] Tally run complete'
  );
}

const REVIEW_EXPIRY_DAYS = 30;

export async function processExpireProposalReview(): Promise<void> {
  logger.info(
    { job: EXPIRE_PROPOSAL_REVIEW_JOB },
    '[Proposals] Checking for stale reviews'
  );

  const cutoff = new Date(
    Date.now() - REVIEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const stale = await prisma.proposal.findMany({
    where: {
      status: 'PENDING_REVIEW',
      updatedAt: { lte: cutoff },
    },
    select: { id: true, title: true, creatorId: true },
  });

  let expired = 0;
  for (const proposal of stale) {
    try {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          status: 'REJECTED',
          reviewNote: `Review period expired after ${REVIEW_EXPIRY_DAYS} days without administrator action.`,
        },
      });

      if (proposal.creatorId) {
        await auditService.log(
          proposal.creatorId,
          AuditAction.PROPOSAL_STATUS_CHANGED,
          'Proposal',
          proposal.id,
          {
            newStatus: 'REJECTED',
            reason: 'review_expired',
            title: proposal.title,
          }
        );

        await notificationService.send({
          userId: proposal.creatorId,
          type: NotificationType.PROPOSAL_REJECTED,
          title: 'Proposal review expired',
          message: `"${proposal.title}" was automatically rejected after ${REVIEW_EXPIRY_DAYS} days without administrator review.`,
          data: { proposalId: proposal.id },
        });
      }

      expired++;
    } catch (err) {
      logger.error(
        { proposalId: proposal.id, err },
        '[Proposals] Failed to expire stale review'
      );
    }
  }

  logger.info(
    { expired, total: stale.length },
    '[Proposals] Review expiry run complete'
  );
}

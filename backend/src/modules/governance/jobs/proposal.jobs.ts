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
import { notificationService } from '../../notifications/services/notification.service.js';
import { NotificationType } from '../../notifications/types.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';

export const TALLY_PROPOSALS_JOB = 'tally-proposals';
export const EXPIRE_PROPOSAL_REVIEW_JOB = 'expire-proposal-review';

export async function processTallyProposals(): Promise<void> {
  logger.info({ job: TALLY_PROPOSALS_JOB }, '[Proposals] Tallying expired votes');

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

  logger.info({ tallied, total: expired.length }, '[Proposals] Tally run complete');
}

const REVIEW_EXPIRY_DAYS = 30;

export async function processExpireProposalReview(): Promise<void> {
  logger.info({ job: EXPIRE_PROPOSAL_REVIEW_JOB }, '[Proposals] Checking for stale reviews');

  const cutoff = new Date(Date.now() - REVIEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

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
          { newStatus: 'REJECTED', reason: 'review_expired', title: proposal.title }
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

  logger.info({ expired, total: stale.length }, '[Proposals] Review expiry run complete');
}

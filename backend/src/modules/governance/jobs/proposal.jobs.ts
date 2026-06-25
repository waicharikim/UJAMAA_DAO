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
export const CLOSE_PROPOSAL_ONCHAIN_JOB = 'close-proposal-onchain';

/**
 * Canonical serialization of a proposal's content for the on-chain content hash.
 * STABLE + DOCUMENTED: an auditor recomputes keccak256(utf8(this)) from the public
 * proposal fields and compares it to
 *   proposalContentHash[keccak256(utf8(proposalId))]
 * on the GovernanceVoting contract. If a single field was altered off-chain after
 * voting opened, the hashes won't match — proving tampering. Field order and the
 * empty-string-for-null convention are part of the format: do NOT change them
 * without a contract version bump (it would invalidate prior anchors).
 */
function canonicalProposalContent(p: {
  id: string;
  title: string | null;
  description: string | null;
  rationale: string | null;
  alternatives: string | null;
  proposalType: string | null;
  kind: string | null;
  proposalScope: string | null;
  budget: unknown;
  groupId: string | null;
  targetWardId: string | null;
  targetConstituencyId: string | null;
  targetCountyId: string | null;
}): string {
  return JSON.stringify({
    id: p.id,
    title: p.title ?? '',
    description: p.description ?? '',
    rationale: p.rationale ?? '',
    alternatives: p.alternatives ?? '',
    proposalType: p.proposalType ?? '',
    kind: p.kind ?? '',
    proposalScope: p.proposalScope ?? '',
    budget: p.budget != null ? String(p.budget) : '',
    groupId: p.groupId ?? '',
    targetWardId: p.targetWardId ?? '',
    targetConstituencyId: p.targetConstituencyId ?? '',
    targetCountyId: p.targetCountyId ?? '',
  });
}

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
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        title: true,
        description: true,
        rationale: true,
        alternatives: true,
        proposalType: true,
        kind: true,
        proposalScope: true,
        budget: true,
        groupId: true,
        targetWardId: true,
        targetConstituencyId: true,
        targetCountyId: true,
      },
    });
    if (!proposal) {
      logger.warn(
        { proposalId },
        '[GOV] Proposal not found — skipping on-chain open'
      );
      return;
    }
    // Anchor a hash of the canonical proposal content so the off-chain text is
    // tamper-evident ("what was voted on, and why" is verifiable, not just the vote).
    const contentHash = ethers.keccak256(
      ethers.toUtf8Bytes(canonicalProposalContent(proposal))
    );
    await gov.openProposal(id, contentHash);
    logger.info(
      { job: OPEN_PROPOSAL_ONCHAIN_JOB, proposalId, contentHash },
      '[GOV] On-chain voting window opened (content anchored)'
    );
  } catch (err) {
    logger.warn(
      { proposalId, err },
      '[GOV] On-chain openProposal failed — DB voting record intact'
    );
  }
}

/**
 * On-demand job enqueued when a proposal is tallied. Closes the on-chain voting
 * window (if open) and attests the result (1 = approved, 2 = rejected). Signs
 * with the minter key (RECORDER_ROLE) which lives on the WORKER — so a user/admin
 * tally on the web process still anchors the result via this job. Mirrors
 * processOpenProposalOnChain. Best-effort + null-guarded (no-op on web / when the
 * blockchain env is unset).
 *
 * Idempotent: skips if never opened (status 0); a re-run after success just
 * re-attempts close/recordResult, which the contract rejects ("already
 * closed/recorded") and the catch swallows — so at-least-once delivery is safe.
 */
export async function processCloseProposalOnChain(
  proposalId: string,
  approved: boolean
): Promise<void> {
  const gov = getGovernanceContract();
  if (!gov) return;

  try {
    const id = ethers.keccak256(ethers.toUtf8Bytes(proposalId));
    // status: 0 = never opened, 1 = open, 2 = closed.
    const status: bigint = await gov.proposalStatus(id);
    if (status === 0n) {
      logger.info(
        { job: CLOSE_PROPOSAL_ONCHAIN_JOB, proposalId },
        '[GOV] Proposal never opened on-chain — skipping result attestation'
      );
      return;
    }
    if (status === 1n) {
      await gov.closeProposal(id);
      logger.info(
        { job: CLOSE_PROPOSAL_ONCHAIN_JOB, proposalId },
        '[GOV] On-chain voting window closed'
      );
    }
    await gov.recordResult(id, approved ? 1 : 2);
    logger.info(
      { job: CLOSE_PROPOSAL_ONCHAIN_JOB, proposalId, approved },
      '[GOV] On-chain result recorded'
    );
  } catch (err) {
    logger.warn(
      { proposalId, err },
      '[GOV] On-chain result failed — DB record intact'
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

/**
 * @file src/modules/governance/baraza/baraza.job.ts
 * @description
 * BullMQ job processor for async Baraza deliberation runs, plus the
 * queueBarazaDeliberation() helper used by the proposal lifecycle hooks.
 * Registered on the governance queue worker in src/workers.ts.
 */

import { Job } from 'bullmq';
import { prisma } from '../../../core/database/client.js';
import { governanceQueue } from '../../../core/queue/index.js';
import { logger } from '../../../core/logger/logger.js';
import { barazaDeliberationService } from './baraza-deliberation.service.js';
import { barazaTelegramService } from './baraza-telegram.service.js';

export const BARAZA_DELIBERATION_JOB = 'BARAZA_DELIBERATION';

export interface BarazaDeliberationJobData {
  proposalId: string;
  groupId: string;
  triggeredBy: 'AUTHOR' | 'ADMIN' | 'AUTO';
}

/**
 * Processes a queued Baraza deliberation:
 *   1. posts an "in progress" notice to the group's Telegram baraza(s)
 *   2. runs the full 7-agent deliberation (content-hash deduped, never throws)
 *   3. posts the formatted result, or a failure notice
 */
export async function processBarazaDeliberationJob(
  job: Job<BarazaDeliberationJobData>
): Promise<void> {
  const { proposalId, groupId, triggeredBy } = job.data;

  logger.info(
    { jobId: job.id, proposalId, groupId, triggeredBy },
    '[BARAZA_JOB] Starting deliberation job'
  );

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { title: true },
  });
  const title = proposal?.title ?? 'Untitled proposal';

  await barazaTelegramService.postInProgress(groupId, title);

  const deliberationId = await barazaDeliberationService.run(
    proposalId,
    groupId,
    triggeredBy
  );

  if (deliberationId) {
    const result = await barazaDeliberationService.getLatest(proposalId);
    if (result) {
      await barazaTelegramService.postResult(groupId, title, result);
    }
    logger.info(
      { jobId: job.id, proposalId, deliberationId },
      '[BARAZA_JOB] Deliberation completed'
    );
  } else {
    await barazaTelegramService.postFailure(groupId, title);
    logger.warn(
      { jobId: job.id, proposalId },
      '[BARAZA_JOB] Deliberation returned null — Qwen unavailable or proposal not found'
    );
  }
}

/**
 * Queue a Baraza deliberation job.
 * Uses jobId deduplication — only one deliberation runs per proposal at a time.
 */
export async function queueBarazaDeliberation(
  proposalId: string,
  groupId: string,
  triggeredBy: 'AUTHOR' | 'ADMIN' | 'AUTO' = 'AUTO'
): Promise<void> {
  await governanceQueue.add(
    BARAZA_DELIBERATION_JOB,
    { proposalId, groupId, triggeredBy } satisfies BarazaDeliberationJobData,
    {
      jobId: `baraza-${proposalId}`, // deduplication — one job per proposal
      attempts: 2,
      backoff: { type: 'fixed', delay: 30_000 },
    }
  );

  logger.info(
    { proposalId, groupId, triggeredBy },
    '[BARAZA] Deliberation job queued'
  );
}

// =============================================================================
// LIFECYCLE HOOKS (wired in proposal-lifecycle.service.ts)
// =============================================================================
// HOOK 1 — tryVoluntaryGroupScopeFastTrack(): after the proposal is set to
//          APPROVED_FOR_VOTING, queueBarazaDeliberation(id, groupId, 'AUTO').
// HOOK 2 — handlePendingReviewStage() APPROVE branch: after status →
//          APPROVED_FOR_VOTING, queueBarazaDeliberation(id, groupId, 'ADMIN').
// HOOK 3 — author-triggered pre-submission: POST /proposals/:id/baraza →
//          queueBarazaDeliberation(id, groupId, 'AUTHOR') (creator-gated).
// =============================================================================

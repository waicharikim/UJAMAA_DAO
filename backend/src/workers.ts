/**
 * @file src/workers.ts
 * @description
 * Dedicated BullMQ worker process — processes all background queues
 *
 * This process should run separately from the web server.
 *
 * Run with:
 *   node dist/workers.js           (production)
 *   tsx src/workers.ts             (development)
 *
 * Version: 1.4 — February 2026
 * Features: graceful shutdown, full error handling, failed job alerts, dead-letter queue
 */

import './tracer.js';
import * as Sentry from '@sentry/node';
import { logger } from './core/logger/logger.js';
import { registerAllJobs } from './core/jobs/register.js';
import { createWorker, createQueue } from './core/queue/index.js';

// ─────────────────────────────────────────────
// Import job processors
// ─────────────────────────────────────────────

import {
  USER_CLEANUP_JOB_NAME,
  processUserCleanup,
} from './modules/user/jobs/user-cleanup.jobs.js';

import {
  MONTHLY_PR_REGENERATION_JOB,
  processMonthlyPRRegeneration,
} from './modules/economy/jobs/pr-regeneration.jobs.js';

import {
  MONTHLY_PR_INACTIVITY_DECAY_JOB,
  processInactivityDecay,
} from './modules/economy/jobs/pr-decay.jobs.js';

import {
  DAILY_COMMITMENT_PENALTIES_JOB,
  processCommitmentPenalties,
} from './modules/economy/jobs/commitment-penalties.jobs.js';

import {
  AUTH_CLEANUP_JOB_NAME,
  processAuthCleanup,
} from './modules/auth/jobs/auth-cleanup.jobs.js';

import {
  processBarazaAttendanceReward,
  processBarazaSendInvite,
  processBarazaDemandScan,
} from './modules/integration/jobs/baraza-reward.jobs.js';
import { processBarazaSessionReminder } from './modules/integration/jobs/baraza-reminder.jobs.js';
import { BotJobName } from './modules/integration/types.js';

import {
  DUES_REMINDER_JOB,
  processDuesReminder,
} from './modules/notifications/jobs/dues-reminder.jobs.js';

import {
  ProjectJobName,
  processWorkSessionClose,
} from './modules/projects/jobs/work-session.jobs.js';

import {
  SCHEDULE_ELECTIONS_JOB,
  OPEN_NOMINATIONS_JOB,
  OPEN_VOTING_JOB,
  TALLY_RESULTS_JOB,
  processScheduleElections,
  processOpenNominations,
  processOpenVoting,
  processTallyResults,
} from './modules/elections/jobs/election.jobs.js';

import {
  TALLY_PROPOSALS_JOB,
  EXPIRE_PROPOSAL_REVIEW_JOB,
  GENERATE_DELIBERATION_SUMMARY_JOB,
  OPEN_PROPOSAL_ONCHAIN_JOB,
  CLOSE_PROPOSAL_ONCHAIN_JOB,
  processTallyProposals,
  processExpireProposalReview,
  processGenerateDeliberationSummary,
  processOpenProposalOnChain,
  processCloseProposalOnChain,
} from './modules/governance/jobs/proposal.jobs.js';
import {
  BARAZA_DELIBERATION_JOB,
  processBarazaDeliberationJob,
} from './modules/governance/baraza/baraza.job.js';
import {
  COLLECT_CURRENT_AFFAIRS_JOB,
  processCurrentAffairsCollection,
} from './modules/governance/current-affairs/current-affairs.job.js';

import {
  MPESA_PAYOUT_JOB,
  processMpesaPayout,
  MpesaPayoutJobData,
} from './modules/economy/jobs/ut-payout.jobs.js';
import { utWithdrawalService } from './modules/economy/services/utWithdrawal.service.js';
import {
  ANCHOR_TREASURY_TX_JOB,
  processAnchorTreasuryTx,
  type AnchorTreasuryTxPayload,
} from './modules/treasury/jobs/treasury.jobs.js';

// ─────────────────────────────────────────────
// Graceful shutdown & error handling
// ─────────────────────────────────────────────

async function shutdownWorkers(signal: string): Promise<void> {
  logger.info(
    { operationType: 'WORKER', signal },
    `${signal} received — draining and closing workers`
  );
  try {
    await Promise.all([
      economyWorker.close(),
      userCleanupWorker.close(),
      integrationWorker.close(),
      notificationsWorker.close(),
      governanceWorker.close(),
      projectWorker.close(),
    ]);
    logger.info({ operationType: 'WORKER' }, 'All workers drained and closed');
  } catch (err) {
    logger.error(
      { operationType: 'WORKER', error: String(err) },
      'Error closing workers during shutdown'
    );
  }
  await Sentry.close(2000);
  process.exit(0);
}

process.on('SIGINT', () => shutdownWorkers('SIGINT'));
process.on('SIGTERM', () => shutdownWorkers('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error(
    { operationType: 'WORKER', error: err.message, stack: err.stack },
    'Uncaught exception in worker — exiting'
  );
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(
    {
      operationType: 'WORKER',
      reason: reason instanceof Error ? reason.message : String(reason),
    },
    'Unhandled promise rejection in worker'
  );
});

// ─────────────────────────────────────────────
// Create workers for each queue
// ─────────────────────────────────────────────

const economyWorker = createWorker('economy', async (job) => {
  const { name } = job;

  try {
    if (name === MONTHLY_PR_REGENERATION_JOB) {
      await Sentry.withMonitor(
        MONTHLY_PR_REGENERATION_JOB,
        () => processMonthlyPRRegeneration(),
        {
          schedule: { type: 'crontab', value: '5 0 1 * *' },
          checkinMargin: 5,
          maxRuntime: 30,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (name === MONTHLY_PR_INACTIVITY_DECAY_JOB) {
      await Sentry.withMonitor(
        MONTHLY_PR_INACTIVITY_DECAY_JOB,
        () => processInactivityDecay(),
        {
          schedule: { type: 'crontab', value: '10 0 2 * *' },
          checkinMargin: 5,
          maxRuntime: 30,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (name === DAILY_COMMITMENT_PENALTIES_JOB) {
      await Sentry.withMonitor(
        DAILY_COMMITMENT_PENALTIES_JOB,
        () => processCommitmentPenalties(),
        {
          schedule: { type: 'crontab', value: '0 2 * * *' },
          checkinMargin: 5,
          maxRuntime: 15,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (name === MPESA_PAYOUT_JOB) {
      await processMpesaPayout(job.data as MpesaPayoutJobData);
    } else if (name === ANCHOR_TREASURY_TX_JOB) {
      await processAnchorTreasuryTx(
        (job.data as AnchorTreasuryTxPayload).transactionId
      );
    } else {
      logger.warn(
        { jobName: name, queue: 'economy' },
        'Unknown economy job received'
      );
    }
  } catch (err) {
    logger.error(
      {
        jobId: job.id,
        jobName: name,
        queue: 'economy',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Economy job failed'
    );
    throw err;
  }
});

const userCleanupWorker = createWorker('user-cleanup', async (job) => {
  try {
    if (job.name === USER_CLEANUP_JOB_NAME) {
      await Sentry.withMonitor(
        USER_CLEANUP_JOB_NAME,
        () => processUserCleanup(job),
        {
          schedule: { type: 'interval', value: 4, unit: 'hour' },
          checkinMargin: 10,
          maxRuntime: 20,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (job.name === AUTH_CLEANUP_JOB_NAME) {
      await Sentry.withMonitor(
        AUTH_CLEANUP_JOB_NAME,
        () => processAuthCleanup(job),
        {
          schedule: { type: 'crontab', value: '0 3 * * *' },
          checkinMargin: 5,
          maxRuntime: 10,
          timezone: 'Africa/Nairobi',
        }
      );
    } else {
      logger.warn(
        { jobName: job.name, queue: 'user-cleanup' },
        'Unknown user-cleanup job'
      );
    }
  } catch (err) {
    logger.error(
      {
        jobId: job.id,
        jobName: job.name,
        queue: 'user-cleanup',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'User cleanup job failed'
    );
    throw err;
  }
});

const integrationWorker = createWorker('integration', async (job) => {
  try {
    if (job.name === BotJobName.BARAZA_ATTENDANCE_REWARD) {
      await processBarazaAttendanceReward(job);
    } else if (job.name === BotJobName.BARAZA_SEND_INVITE) {
      await processBarazaSendInvite(job);
    } else if (job.name === BotJobName.BARAZA_SESSION_REMINDER) {
      await processBarazaSessionReminder(job);
    } else if (job.name === BotJobName.BARAZA_DEMAND_SCAN) {
      await processBarazaDemandScan();
    } else {
      logger.warn(
        { jobName: job.name, queue: 'integration' },
        'Unknown integration job received'
      );
    }
  } catch (err) {
    logger.error(
      {
        jobId: job.id,
        jobName: job.name,
        queue: 'integration',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Integration job failed'
    );
    throw err;
  }
});

const governanceWorker = createWorker('governance', async (job) => {
  try {
    if (job.name === SCHEDULE_ELECTIONS_JOB) {
      await Sentry.withMonitor(
        SCHEDULE_ELECTIONS_JOB,
        () => processScheduleElections(),
        {
          schedule: { type: 'crontab', value: '0 1 1 * *' },
          checkinMargin: 5,
          maxRuntime: 20,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (job.name === OPEN_NOMINATIONS_JOB) {
      await Sentry.withMonitor(
        OPEN_NOMINATIONS_JOB,
        () => processOpenNominations(),
        {
          schedule: { type: 'crontab', value: '15 0 * * *' },
          checkinMargin: 5,
          maxRuntime: 10,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (job.name === OPEN_VOTING_JOB) {
      await Sentry.withMonitor(OPEN_VOTING_JOB, () => processOpenVoting(), {
        schedule: { type: 'crontab', value: '20 0 * * *' },
        checkinMargin: 5,
        maxRuntime: 10,
        timezone: 'Africa/Nairobi',
      });
    } else if (job.name === TALLY_RESULTS_JOB) {
      await Sentry.withMonitor(TALLY_RESULTS_JOB, () => processTallyResults(), {
        schedule: { type: 'crontab', value: '25 0 * * *' },
        checkinMargin: 5,
        maxRuntime: 15,
        timezone: 'Africa/Nairobi',
      });
    } else if (job.name === TALLY_PROPOSALS_JOB) {
      await Sentry.withMonitor(
        TALLY_PROPOSALS_JOB,
        () => processTallyProposals(),
        {
          schedule: { type: 'crontab', value: '30 0 * * *' },
          checkinMargin: 5,
          maxRuntime: 15,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (job.name === EXPIRE_PROPOSAL_REVIEW_JOB) {
      await Sentry.withMonitor(
        EXPIRE_PROPOSAL_REVIEW_JOB,
        () => processExpireProposalReview(),
        {
          schedule: { type: 'crontab', value: '35 0 * * *' },
          checkinMargin: 5,
          maxRuntime: 10,
          timezone: 'Africa/Nairobi',
        }
      );
    } else if (job.name === GENERATE_DELIBERATION_SUMMARY_JOB) {
      // On-demand (enqueued when voting opens) — not scheduled, so no Sentry monitor.
      await processGenerateDeliberationSummary(job.data.proposalId);
    } else if (job.name === OPEN_PROPOSAL_ONCHAIN_JOB) {
      // On-demand (enqueued when voting opens) — opens the on-chain voting window.
      await processOpenProposalOnChain(job.data.proposalId);
    } else if (job.name === CLOSE_PROPOSAL_ONCHAIN_JOB) {
      // On-demand (enqueued on tally) — closes the window + attests the result.
      await processCloseProposalOnChain(job.data.proposalId, job.data.approved);
    } else if (job.name === BARAZA_DELIBERATION_JOB) {
      // On-demand (enqueued on approval) — runs the 7-agent Baraza deliberation.
      await processBarazaDeliberationJob(job);
    } else if (job.name === COLLECT_CURRENT_AFFAIRS_JOB) {
      // Weekly — refresh current-affairs indicators (best-effort, fails open).
      await processCurrentAffairsCollection();
    } else {
      logger.warn(
        { jobName: job.name, queue: 'governance' },
        'Unknown governance job received'
      );
    }
  } catch (err) {
    logger.error(
      {
        jobId: job.id,
        jobName: job.name,
        queue: 'governance',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Governance job failed'
    );
    throw err;
  }
});

const projectWorker = createWorker('project', async (job) => {
  try {
    if (job.name === ProjectJobName.WORK_SESSION_CLOSE) {
      await processWorkSessionClose(job);
    } else {
      logger.warn(
        { jobName: job.name, queue: 'project' },
        'Unknown project job received'
      );
    }
  } catch (err) {
    logger.error(
      {
        jobId: job.id,
        jobName: job.name,
        queue: 'project',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Project job failed'
    );
    throw err;
  }
});

const notificationsWorker = createWorker('notifications', async (job) => {
  try {
    if (job.name === DUES_REMINDER_JOB) {
      await Sentry.withMonitor(DUES_REMINDER_JOB, () => processDuesReminder(), {
        schedule: { type: 'crontab', value: '0 8 * * *' },
        checkinMargin: 5,
        maxRuntime: 15,
        timezone: 'Africa/Nairobi',
      });
    } else {
      logger.warn(
        { jobName: job.name, queue: 'notifications' },
        'Unknown notifications job received'
      );
    }
  } catch (err) {
    logger.error(
      {
        jobId: job.id,
        jobName: job.name,
        queue: 'notifications',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Notifications job failed'
    );
    throw err;
  }
});

// ─────────────────────────────────────────────
// Start the worker & register repeatable jobs
// ─────────────────────────────────────────────

async function startWorker() {
  logger.info(
    { operationType: 'WORKER' },
    'Background worker process starting...'
  );

  try {
    await registerAllJobs();
    logger.info(
      { operationType: 'WORKER' },
      'Worker ready — all queues active and processing'
    );
  } catch (err) {
    logger.error(
      {
        operationType: 'WORKER',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Failed to start worker / register jobs'
    );
    process.exit(1);
  }
}

startWorker();

// ─────────────────────────────────────────────
// FAILED JOB ALERTS + DEAD-LETTER QUEUE
// ─────────────────────────────────────────────

const deadLetterQueue = createQueue('dead-letter');

const failedJobHandler = async (job: any, err: Error) => {
  // Trigger only on final failure (after max retries)
  if (
    job.failedReason === 'exhausted' ||
    job.attemptsMade >= job.opts.attempts
  ) {
    // Refund the user if a payout job permanently fails
    if (job.name === MPESA_PAYOUT_JOB) {
      const { withdrawalId } = job.data as MpesaPayoutJobData;
      try {
        await utWithdrawalService.refundPayout(withdrawalId, err.message);
      } catch (refundErr) {
        logger.error(
          { withdrawalId, error: String(refundErr) },
          '[PAYOUT] CRITICAL: refund after job failure itself failed — manual intervention required'
        );
      }
    }

    logger.critical(
      {
        operationType: 'JOB_FAILED_FINAL',
        queue: job.queueName,
        jobId: job.id,
        jobName: job.name,
        attempts: job.attemptsMade,
        error: err.message,
        data: JSON.stringify(job.data || {}),
        timestamp: new Date().toISOString(),
      },
      'CRITICAL: Job failed permanently — moving to dead-letter queue'
    );

    // Move job to dead-letter queue for later inspection/retry
    await deadLetterQueue.add(
      'failed-job',
      {
        originalQueue: job.queueName,
        jobName: job.name,
        jobId: job.id,
        attempts: job.attemptsMade,
        error: err.message,
        data: job.data || {},
        timestamp: new Date().toISOString(),
      },
      { removeOnComplete: true }
    );

    // Send real-time alert (customize email or Slack below)
    await sendJobFailureAlert({
      queue: job.queueName,
      jobName: job.name,
      jobId: job.id,
      attempts: job.attemptsMade,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};

// Wire failedJobHandler to every worker's 'failed' event.
// Workers emit 'failed' after all retries are exhausted.
economyWorker.on('failed', failedJobHandler);
userCleanupWorker.on('failed', failedJobHandler);
integrationWorker.on('failed', failedJobHandler);
notificationsWorker.on('failed', failedJobHandler);
governanceWorker.on('failed', failedJobHandler);

/**
 * Send alert when a job fails permanently
 * Customize this function — choose email, Slack, or both
 */
async function sendJobFailureAlert(info: {
  queue: string;
  jobName: string;
  jobId: string;
  attempts: number;
  error: string;
  timestamp: string;
}) {
  const message = `
🚨 CRITICAL JOB FAILURE

Queue: ${info.queue}
Job: ${info.jobName}
Job ID: ${info.jobId}
Attempts: ${info.attempts}
Error: ${info.error}
Time: ${info.timestamp}

Check dead-letter queue or dashboard: /admin/queues
  `.trim();

  logger.error(
    { operationType: 'JOB_FAILURE', metadata: { alert: message } },
    'Job failure alert triggered'
  );

  // ── EMAIL ALERT (uncomment & configure Nodemailer or your email lib) ──
  /*
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your SMTP provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'admin@ujamaadao.org',
      subject: `Job Failure Alert: ${info.jobName} (${info.queue})`,
      text: message,
    });

    logger.info({ operationType: "ALERT_SENT", type: "email" }, "Failure alert email sent");
  } catch (alertErr) {
    logger.error(
      { operationType: "ALERT_FAILURE", error: String(alertErr) },
      "Failed to send failure alert email"
    );
  }
  */

  // ── SLACK ALERT (uncomment & add webhook URL) ──
  /*
  try {
    await fetch("https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    logger.info({ operationType: "ALERT_SENT", type: "slack" }, "Failure alert sent to Slack");
  } catch (alertErr) {
    logger.error(
      { operationType: "ALERT_FAILURE", error: String(alertErr) },
      "Failed to send Slack alert"
    );
  }
  */
}

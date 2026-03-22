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
} from './modules/integration/jobs/baraza-reward.jobs.js';
import { BotJobName } from './modules/integration/types.js';

import {
  DUES_REMINDER_JOB,
  processDuesReminder,
} from './modules/notifications/jobs/dues-reminder.jobs.js';

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
    ]);
    logger.info({ operationType: 'WORKER' }, 'All workers drained and closed');
  } catch (err) {
    logger.error(
      { operationType: 'WORKER', error: String(err) },
      'Error closing workers during shutdown'
    );
  }
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
      await processMonthlyPRRegeneration();
    } else if (name === MONTHLY_PR_INACTIVITY_DECAY_JOB) {
      await processInactivityDecay();
    } else if (name === DAILY_COMMITMENT_PENALTIES_JOB) {
      await processCommitmentPenalties();
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
      await processUserCleanup(job);
    } else if (job.name === AUTH_CLEANUP_JOB_NAME) {
      await processAuthCleanup(job);
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
      await processScheduleElections();
    } else if (job.name === OPEN_NOMINATIONS_JOB) {
      await processOpenNominations();
    } else if (job.name === OPEN_VOTING_JOB) {
      await processOpenVoting();
    } else if (job.name === TALLY_RESULTS_JOB) {
      await processTallyResults();
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

const notificationsWorker = createWorker('notifications', async (job) => {
  try {
    if (job.name === DUES_REMINDER_JOB) {
      await processDuesReminder();
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

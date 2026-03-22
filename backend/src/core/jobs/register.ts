/**
 * @file src/core/jobs/register.ts
 * @description
 * Registers ALL recurring / scheduled BullMQ jobs in the system
 *
 * This is the single place where new scheduled jobs should be added.
 * Each job is added as a repeatable job with a unique ID.
 *
 * Version: 1.1 — February 2026
 */

import { logger } from '../logger/logger.js';
import {
  economyQueue,
  userCleanupQueue,
  notificationsQueue,
  governanceQueue,
} from '../queue/index.js';

// ─────────────────────────────────────────────
// Import all job names & processors
// ─────────────────────────────────────────────

import { USER_CLEANUP_JOB_NAME } from '../../modules/user/jobs/user-cleanup.jobs.js';

import { MONTHLY_PR_REGENERATION_JOB } from '../../modules/economy/jobs/pr-regeneration.jobs.js';
import { MONTHLY_PR_INACTIVITY_DECAY_JOB } from '../../modules/economy/jobs/pr-decay.jobs.js';

import { DAILY_COMMITMENT_PENALTIES_JOB } from '../../modules/economy/jobs/commitment-penalties.jobs.js';

import { AUTH_CLEANUP_JOB_NAME } from '../../modules/auth/jobs/auth-cleanup.jobs.js';

import { DUES_REMINDER_JOB } from '../../modules/notifications/jobs/dues-reminder.jobs.js';

import {
  SCHEDULE_ELECTIONS_JOB,
  OPEN_NOMINATIONS_JOB,
  OPEN_VOTING_JOB,
  TALLY_RESULTS_JOB,
} from '../../modules/elections/jobs/election.jobs.js';

export async function registerAllJobs(): Promise<void> {
  logger.info(
    { operationType: 'JOB_REGISTER' },
    'Registering all BullMQ repeatable jobs'
  );

  try {
    // ─────────────────────────────────────────────
    // USER CLEANUP JOB
    // Every 4 hours - all user-related cleanups
    // ─────────────────────────────────────────────
    await userCleanupQueue.add(
      USER_CLEANUP_JOB_NAME,
      {},
      {
        repeat: { every: 4 * 60 * 60 * 1000 }, // 4 hours
        jobId: USER_CLEANUP_JOB_NAME,
        removeOnComplete: { age: 3600 * 24 * 7 }, // 1 week
        removeOnFail: { age: 3600 * 24 * 30 }, // 1 month
      }
    );
    logger.info({ job: USER_CLEANUP_JOB_NAME }, 'Job registered');

    // ─────────────────────────────────────────────
    // MONTHLY PR REGENERATION
    // 00:05 on the 1st of every month
    // ─────────────────────────────────────────────
    await economyQueue.add(
      MONTHLY_PR_REGENERATION_JOB,
      {},
      {
        repeat: { pattern: '5 0 1 * *' },
        jobId: MONTHLY_PR_REGENERATION_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: MONTHLY_PR_REGENERATION_JOB }, 'Job registered');

    // ─────────────────────────────────────────────
    // MONTHLY PR INACTIVITY DECAY
    // 00:10 on the 2nd of every month (runs after regen on the 1st)
    // ADR-026: 5%/month for users inactive ≥60 days, floor = 100 PR
    // ─────────────────────────────────────────────
    await economyQueue.add(
      MONTHLY_PR_INACTIVITY_DECAY_JOB,
      {},
      {
        repeat: { pattern: '10 0 2 * *' },
        jobId: MONTHLY_PR_INACTIVITY_DECAY_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: MONTHLY_PR_INACTIVITY_DECAY_JOB }, 'Job registered');

    // ─────────────────────────────────────────────
    // DAILY COMMITMENT PENALTIES
    // Every day at 02:00
    // ─────────────────────────────────────────────
    await economyQueue.add(
      DAILY_COMMITMENT_PENALTIES_JOB,
      {},
      {
        repeat: { pattern: '0 2 * * *' },
        jobId: DAILY_COMMITMENT_PENALTIES_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: DAILY_COMMITMENT_PENALTIES_JOB }, 'Job registered');

    // ─────────────────────────────────────────────
    // AUTH CLEANUP JOB
    // Every day at 03:00 — email verification & password reset token cleanup
    // ─────────────────────────────────────────────
    await userCleanupQueue.add(
      AUTH_CLEANUP_JOB_NAME,
      {},
      {
        repeat: { pattern: '0 3 * * *' },
        jobId: AUTH_CLEANUP_JOB_NAME,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: AUTH_CLEANUP_JOB_NAME }, 'Job registered');

    // ─────────────────────────────────────────────
    // DUES REMINDER JOB
    // Every day at 08:00 — sends dues reminders on days 26–28 of each month
    // ─────────────────────────────────────────────
    await notificationsQueue.add(
      DUES_REMINDER_JOB,
      {},
      {
        repeat: { pattern: '0 8 * * *' },
        jobId: DUES_REMINDER_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: DUES_REMINDER_JOB }, 'Job registered');

    // ─────────────────────────────────────────────
    // ELECTION SCHEDULING
    // 01:00 on 1st of every month — scan all groups/counties for eligible elections
    // ─────────────────────────────────────────────
    await governanceQueue.add(
      SCHEDULE_ELECTIONS_JOB,
      {},
      {
        repeat: { pattern: '0 1 1 * *' },
        jobId: SCHEDULE_ELECTIONS_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: SCHEDULE_ELECTIONS_JOB }, 'Job registered');

    // ─────────────────────────────────────────────
    // OPEN NOMINATIONS
    // Daily 00:15 — PENDING → NOMINATIONS_OPEN
    // ─────────────────────────────────────────────
    await governanceQueue.add(
      OPEN_NOMINATIONS_JOB,
      {},
      {
        repeat: { pattern: '15 0 * * *' },
        jobId: OPEN_NOMINATIONS_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: OPEN_NOMINATIONS_JOB }, 'Job registered');

    // ─────────────────────────────────────────────
    // OPEN VOTING
    // Daily 00:20 — NOMINATIONS_OPEN → VOTING_OPEN
    // ─────────────────────────────────────────────
    await governanceQueue.add(
      OPEN_VOTING_JOB,
      {},
      {
        repeat: { pattern: '20 0 * * *' },
        jobId: OPEN_VOTING_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: OPEN_VOTING_JOB }, 'Job registered');

    // ─────────────────────────────────────────────
    // TALLY ELECTION RESULTS
    // Daily 00:25 — VOTING_OPEN → CLOSED + apply role
    // ─────────────────────────────────────────────
    await governanceQueue.add(
      TALLY_RESULTS_JOB,
      {},
      {
        repeat: { pattern: '25 0 * * *' },
        jobId: TALLY_RESULTS_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: TALLY_RESULTS_JOB }, 'Job registered');

    logger.info(
      { operationType: 'JOB_REGISTER' },
      'All BullMQ repeatable jobs successfully registered'
    );
  } catch (err) {
    logger.error(
      {
        operationType: 'JOB_REGISTER',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Failed to register BullMQ jobs'
    );
    throw err;
  }
}

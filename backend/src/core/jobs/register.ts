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

import { logger } from "../logger/logger.js";
import { economyQueue, userCleanupQueue } from "../queue/index.js";

// ─────────────────────────────────────────────
// Import all job names & processors
// ─────────────────────────────────────────────

import {
  USER_CLEANUP_JOB_NAME,
  processUserCleanup,
} from "../../modules/user/jobs/user-cleanup.jobs.js";

import {
  MONTHLY_PR_REGENERATION_JOB,
  processMonthlyPRRegeneration,
} from "../../modules/economy/jobs/pr-regeneration.jobs.js";

import {
  DAILY_COMMITMENT_PENALTIES_JOB,
  processCommitmentPenalties,
} from "../../modules/economy/jobs/commitment-penalties.jobs.js";

// Add future jobs here when needed
// import { SOME_OTHER_JOB, processOtherJob } from "...";

export async function registerAllJobs(): Promise<void> {
  logger.info(
    { operationType: "JOB_REGISTER" },
    "Registering all BullMQ repeatable jobs"
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
        removeOnFail: { age: 3600 * 24 * 30 },    // 1 month
      }
    );
    logger.info({ job: USER_CLEANUP_JOB_NAME }, "Job registered");

    // ─────────────────────────────────────────────
    // MONTHLY PR REGENERATION
    // 00:05 on the 1st of every month
    // ─────────────────────────────────────────────
    await economyQueue.add(
      MONTHLY_PR_REGENERATION_JOB,
      {},
      {
        repeat: { pattern: "5 0 1 * *" },
        jobId: MONTHLY_PR_REGENERATION_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: MONTHLY_PR_REGENERATION_JOB }, "Job registered");

    // ─────────────────────────────────────────────
    // DAILY COMMITMENT PENALTIES
    // Every day at 02:00
    // ─────────────────────────────────────────────
    await economyQueue.add(
      DAILY_COMMITMENT_PENALTIES_JOB,
      {},
      {
        repeat: { pattern: "0 2 * * *" },
        jobId: DAILY_COMMITMENT_PENALTIES_JOB,
        removeOnComplete: { age: 3600 * 24 * 7 },
        removeOnFail: { age: 3600 * 24 * 30 },
      }
    );
    logger.info({ job: DAILY_COMMITMENT_PENALTIES_JOB }, "Job registered");

    // ─────────────────────────────────────────────
    // Add future jobs here
    // ─────────────────────────────────────────────
    // await someQueue.add("daily-report", {}, { repeat: { pattern: "0 3 * * *" } });

    logger.info(
      { operationType: "JOB_REGISTER" },
      "All BullMQ repeatable jobs successfully registered"
    );
  } catch (err) {
    logger.error(
      {
        operationType: "JOB_REGISTER",
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      "Failed to register BullMQ jobs"
    );
    throw err;
  }
}
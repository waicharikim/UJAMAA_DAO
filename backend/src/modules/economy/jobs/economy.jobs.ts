/**
 * @file src/modules/economy/jobs/economy.jobs.ts
 * @description
 * Scheduled jobs for economy module
 */

import { logger } from "../../../core/logger/logger.js";
import { participationRightsService } from "../services/participationRights.service.js";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_MONTH = 30 * ONE_DAY;

/**
 * Register all economy-related scheduled jobs
 */
export function setupEconomyJobs() {
  // Daily check for monthly tasks
  setInterval(async () => {
    try {
      const now = new Date();
      const isFirstOfMonth = now.getDate() === 1;

      if (isFirstOfMonth) {
        logger.info({ operationType: "JOB" }, "Running monthly PR regeneration");
        await participationRightsService.monthlyRegeneration();
      }

      logger.debug({ operationType: "JOB" }, "Running commitment penalty check");
      await participationRightsService.applyCommitmentPenalties();
    } catch (err) {
      logger.error(
        { operationType: "JOB", error: err instanceof Error ? err.message : String(err) },
        "Economy jobs failed"
      );
    }
  }, ONE_DAY);
}
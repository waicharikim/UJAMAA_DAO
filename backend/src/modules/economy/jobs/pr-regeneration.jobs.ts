import { logger } from "../../../core/logger/logger.js";
import { participationRightsService } from "../services/participationRights.service.js";

export const MONTHLY_PR_REGENERATION_JOB = "monthly-pr-regeneration";

export async function processMonthlyPRRegeneration() {
  try {
    logger.info(
      { job: MONTHLY_PR_REGENERATION_JOB },
      "Starting monthly PR regeneration"
    );

    await participationRightsService.monthlyRegeneration();

    logger.info(
      { job: MONTHLY_PR_REGENERATION_JOB },
      "Monthly PR regeneration completed"
    );
  } catch (err) {
    logger.error(
      {
        job: MONTHLY_PR_REGENERATION_JOB,
        error: err instanceof Error ? err.message : String(err),
      },
      "Monthly PR regeneration failed"
    );
    throw err; // BullMQ will retry if configured
  }
}
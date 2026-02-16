import { logger } from "../../../core/logger/logger.js";
import { participationRightsService } from "../services/participationRights.service.js";

export const DAILY_COMMITMENT_PENALTIES_JOB = "daily-commitment-penalties";

export async function processCommitmentPenalties() {
  try {
    logger.info(
      { job: DAILY_COMMITMENT_PENALTIES_JOB },
      "Starting daily commitment penalty check"
    );

    await participationRightsService.applyCommitmentPenalties();

    logger.info(
      { job: DAILY_COMMITMENT_PENALTIES_JOB },
      "Daily commitment penalty check completed"
    );
  } catch (err) {
    logger.error(
      {
        job: DAILY_COMMITMENT_PENALTIES_JOB,
        error: err instanceof Error ? err.message : String(err),
      },
      "Daily commitment penalty check failed"
    );
    throw err;
  }
}
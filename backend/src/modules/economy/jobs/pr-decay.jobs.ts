import { logger } from '../../../core/logger/logger.js';
import { participationRightsService } from '../services/participationRights.service.js';

export const MONTHLY_PR_INACTIVITY_DECAY_JOB = 'monthly-pr-inactivity-decay';

export async function processInactivityDecay() {
  try {
    logger.info(
      { job: MONTHLY_PR_INACTIVITY_DECAY_JOB },
      'Starting monthly PR inactivity decay'
    );

    await participationRightsService.applyInactivityDecay();

    logger.info(
      { job: MONTHLY_PR_INACTIVITY_DECAY_JOB },
      'Monthly PR inactivity decay completed'
    );
  } catch (err) {
    logger.error(
      {
        job: MONTHLY_PR_INACTIVITY_DECAY_JOB,
        error: err instanceof Error ? err.message : String(err),
      },
      'Monthly PR inactivity decay failed'
    );
    throw err;
  }
}

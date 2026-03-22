/**
 * @file src/modules/elections/jobs/election.jobs.ts
 * @description
 * BullMQ job processors for election lifecycle.
 *
 * Four jobs run on the governance queue:
 *  1. schedule-elections   — monthly: check thresholds, create new elections
 *  2. open-nominations     — daily:   PENDING → NOMINATIONS_OPEN
 *  3. open-voting          — daily:   NOMINATIONS_OPEN → VOTING_OPEN
 *  4. tally-results        — daily:   VOTING_OPEN → CLOSED + apply role
 *
 * Version: 1.0 — March 2026
 */

import { logger } from '../../../core/logger/logger.js';
import { electionService } from '../services/election.service.js';

export const SCHEDULE_ELECTIONS_JOB = 'schedule-elections';
export const OPEN_NOMINATIONS_JOB = 'open-election-nominations';
export const OPEN_VOTING_JOB = 'open-election-voting';
export const TALLY_RESULTS_JOB = 'tally-election-results';

export async function processScheduleElections(): Promise<void> {
  logger.info(
    { job: SCHEDULE_ELECTIONS_JOB },
    '[Elections] Running scheduling scan'
  );
  const result = await electionService.scheduleElectionsForEligibleScopes();
  logger.info({ ...result }, '[Elections] Scheduling scan done');
}

export async function processOpenNominations(): Promise<void> {
  logger.info(
    { job: OPEN_NOMINATIONS_JOB },
    '[Elections] Opening nominations for eligible elections'
  );
  const count = await electionService.openNominations();
  logger.info({ count }, '[Elections] Nominations opened');
}

export async function processOpenVoting(): Promise<void> {
  logger.info(
    { job: OPEN_VOTING_JOB },
    '[Elections] Opening voting for eligible elections'
  );
  const count = await electionService.openVoting();
  logger.info({ count }, '[Elections] Voting opened');
}

export async function processTallyResults(): Promise<void> {
  logger.info(
    { job: TALLY_RESULTS_JOB },
    '[Elections] Tallying expired elections'
  );
  const count = await electionService.tallyAndCloseExpired();
  logger.info({ count }, '[Elections] Elections tallied');
}

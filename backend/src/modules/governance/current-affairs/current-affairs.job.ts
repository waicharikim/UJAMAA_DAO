/**
 * @file src/modules/governance/current-affairs/current-affairs.job.ts
 * @description
 * Scheduled collector run: fetches each indicator source (best-effort) and stores
 * the results. Registered weekly on the governance queue — these figures move
 * slowly (EPRA monthly, CPI monthly). Each collector fails open independently.
 */

import { logger } from '../../../core/logger/logger.js';
import { currentAffairsService } from './current-affairs.service.js';
import { collectEpraFuel } from './collectors/epra.js';
import { collectMoneyAcademy } from './collectors/x-moneyacademy.js';

export const COLLECT_CURRENT_AFFAIRS_JOB = 'collect-current-affairs';

// Add new collectors here as sources are built up over time.
const COLLECTORS = [collectEpraFuel, collectMoneyAcademy];

export async function processCurrentAffairsCollection(): Promise<void> {
  logger.info('[CURRENT_AFFAIRS] Running collectors');
  let stored = 0;
  for (const collect of COLLECTORS) {
    try {
      const indicators = await collect();
      for (const ind of indicators) {
        await currentAffairsService.upsertFromCollector(ind);
        stored++;
      }
    } catch (err) {
      // A broken collector must never break the run.
      logger.warn({ err }, '[CURRENT_AFFAIRS] collector threw');
    }
  }
  logger.info({ stored }, '[CURRENT_AFFAIRS] Collection complete');
}

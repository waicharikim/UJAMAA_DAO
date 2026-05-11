/**
 * @file src/modules/projects/jobs/work-session.jobs.ts
 * @description BullMQ job: auto-close a WorkSession when its QR window expires.
 */

import { Job } from 'bullmq';
import { logger } from '../../../core/logger/logger.js';
import { projectService } from '../services/project.service.js';
import { ProjectJobName, WorkSessionCloseJobData } from '../types.js';

export { ProjectJobName };

export async function processWorkSessionClose(
  job: Job<WorkSessionCloseJobData>
): Promise<void> {
  const { sessionId } = job.data;
  logger.info(
    { operationType: 'WORK_SESSION', sessionId },
    'Auto-closing work session'
  );
  await projectService.closeWorkSession(sessionId);
}

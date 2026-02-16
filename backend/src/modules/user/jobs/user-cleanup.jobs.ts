/**
 * @file src/modules/user/jobs/user-cleanup.job.ts
 * @description
 * BullMQ job: Full periodic cleanup for user-related data
 *
 * Runs every 4 hours (configurable)
 * Cleans:
 * - Expired temporary locations
 * - Timed-out vouching requests
 * - Stale/expired residence change requests
 * - Expired phone verification codes
 * - Old revoked/expired sessions
 * - Old low-severity security events (optional)
 *
 * Version: 1.2 — February 2026
 */

import { logger } from "../../../core/logger/logger.js";
import { userService } from "../services/user.service.js";
import { sessionDeviceService } from "../../auth/services/session-device.service.js";
import { phoneVerificationService } from "../../auth/services/phone-verification.service.js";
//import { securityEventService } from "../../auth/services/security-events.service.js"; // assume you have this

// Job name (used for repeatable scheduling)
export const USER_CLEANUP_JOB_NAME = "user-cleanup";

/**
 * Main cleanup processor — runs all cleanup tasks
 */
export async function processUserCleanup(job: any): Promise<void> {
  const jobId = job?.id || "manual-run";

  try {
    logger.info(
      { jobId, operationType: "JOB", queue: "user-cleanup" },
      "Starting full user cleanup cycle"
    );

    const results = await Promise.allSettled([
      // 1. Expired temporary locations
      userService.cleanupExpiredTemporaryLocations(),

      // 2. Vouching timeouts
      userService.checkVouchingTimeouts(),

      // 3. Expired residence change requests
      userService.expireResidenceChangeRequests(),

      // 4. Expired phone verification codes
      phoneVerificationService.cleanupExpiredCodes(),

      // 5. Old/revoked sessions cleanup
      sessionDeviceService.cleanupExpiredSessions(),

      // 6. Optional: old low-severity security events
      // securityEventService.cleanupOldLowSeverityEvents(),
    ]);

    // Summarize results
    const summary: Record<string, any> = {};
    results.forEach((result, index) => {
      const taskNames = [
        "temp-locations",
        "vouching-timeouts",
        "residence-requests",
        "phone-codes",
        "expired-sessions",
        // "security-events",
      ];
      const name = taskNames[index];

      if (result.status === "fulfilled") {
        summary[name] = result.value ?? "success";
      } else {
        summary[name] = {
          status: "failed",
          error: result.reason?.message || String(result.reason),
        };
        logger.error(
          { jobId, task: name, error: result.reason },
          "Cleanup task failed"
        );
      }
    });

    logger.info(
      {
        jobId,
        operationType: "JOB",
        queue: "user-cleanup",
        summary,
      },
      "User cleanup cycle completed"
    );

  } catch (error) {
    logger.error(
      {
        jobId,
        operationType: "JOB",
        queue: "user-cleanup",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Critical: User cleanup cycle failed"
    );

    throw error; // Let BullMQ retry or mark failed
  }
}
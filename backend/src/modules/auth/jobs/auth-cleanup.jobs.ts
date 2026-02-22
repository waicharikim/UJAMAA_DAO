/**
 * @file src/modules/auth/jobs/auth-cleanup.jobs.ts
 * @description
 * BullMQ job: Periodic cleanup of expired auth tokens + old security events
 *
 * Runs daily at 03:00
 * Cleans:
 * - Expired email verification tokens
 * - Expired password reset tokens
 * - Resolved security events older than 90 days
 *
 * Note: Phone verification codes and sessions are already handled
 * by the user-cleanup job (every 4 hours).
 *
 * Version: 1.1 — February 2026
 */

import { logger } from "../../../core/logger/logger.js";
import { tokenService } from "../services/token.service.js";
import { securityEventsService } from "../services/security-events.service.js";

export const AUTH_CLEANUP_JOB_NAME = "auth-cleanup";

/**
 * Main processor — runs all auth cleanup tasks
 */
export async function processAuthCleanup(job: any): Promise<void> {
  const jobId = job?.id || "manual-run";

  logger.info(
    { jobId, operationType: "JOB", queue: "user-cleanup" },
    "[AUTH-CLEANUP] Starting auth token cleanup cycle"
  );

  const [verificationResult, passwordResetResult, securityEventsResult] = await Promise.allSettled([
    tokenService.cleanupExpiredVerificationTokens(),
    tokenService.cleanupExpiredPasswordResetTokens(),
    securityEventsService.cleanupOldEvents(),
  ]);

  const summary: Record<string, any> = {};

  if (verificationResult.status === "fulfilled") {
    summary["verification-tokens"] = verificationResult.value;
  } else {
    summary["verification-tokens"] = {
      status: "failed",
      error: verificationResult.reason?.message || String(verificationResult.reason),
    };
    logger.error(
      { jobId, task: "verification-tokens", error: verificationResult.reason },
      "[AUTH-CLEANUP] Verification token cleanup failed"
    );
  }

  if (passwordResetResult.status === "fulfilled") {
    summary["password-reset-tokens"] = passwordResetResult.value;
  } else {
    summary["password-reset-tokens"] = {
      status: "failed",
      error: passwordResetResult.reason?.message || String(passwordResetResult.reason),
    };
    logger.error(
      { jobId, task: "password-reset-tokens", error: passwordResetResult.reason },
      "[AUTH-CLEANUP] Password reset token cleanup failed"
    );
  }

  if (securityEventsResult.status === "fulfilled") {
    summary["security-events"] = securityEventsResult.value;
  } else {
    summary["security-events"] = {
      status: "failed",
      error: securityEventsResult.reason?.message || String(securityEventsResult.reason),
    };
    logger.error(
      { jobId, task: "security-events", error: securityEventsResult.reason },
      "[AUTH-CLEANUP] Security events cleanup failed"
    );
  }

  logger.info(
    { jobId, operationType: "JOB", queue: "user-cleanup", summary },
    "[AUTH-CLEANUP] Auth token cleanup cycle completed"
  );
}

/**
 * @file src/modules/auth/jobs/auth-cleanup.jobs.ts
 * @description
 * BullMQ job: Periodic cleanup of expired auth tokens
 *
 * Runs daily at 03:00
 * Cleans:
 * - Expired email verification tokens
 * - Expired password reset tokens
 *
 * Note: Phone verification codes and sessions are already handled
 * by the user-cleanup job (every 4 hours).
 *
 * Version: 1.0 — February 2026
 */

import { logger } from "../../../core/logger/logger.js";
import { tokenService } from "../services/token.service.js";

export const AUTH_CLEANUP_JOB_NAME = "auth-cleanup";

/**
 * Main processor — runs all auth token cleanup tasks
 */
export async function processAuthCleanup(job: any): Promise<void> {
  const jobId = job?.id || "manual-run";

  logger.info(
    { jobId, operationType: "JOB", queue: "user-cleanup" },
    "[AUTH-CLEANUP] Starting auth token cleanup cycle"
  );

  const [verificationResult, passwordResetResult] = await Promise.allSettled([
    tokenService.cleanupExpiredVerificationTokens(),
    tokenService.cleanupExpiredPasswordResetTokens(),
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

  logger.info(
    { jobId, operationType: "JOB", queue: "user-cleanup", summary },
    "[AUTH-CLEANUP] Auth token cleanup cycle completed"
  );
}

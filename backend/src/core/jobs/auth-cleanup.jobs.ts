import cron from "node-cron";
import { sessionService } from "../../modules/auth/services/session.service.js";
import { tokenService } from "../../modules/auth/services/token.service.js";
import { phoneVerificationService } from "../../modules/auth/services/phone-verification.service.js";
import { passwordResetService } from "../../modules/auth/services/password-reset.service.js";
import { sessionDeviceService } from "../../modules/auth/services/session-device.service.js";
import { securityEventsService } from "../../modules/auth/services/security-events.service.js";
import { logger } from "../logger/logger.js";

/**
 * Daily cleanup jobs at 3 AM
 */
export function setupAuthCleanupJobs() {
  // Cleanup expired sessions (daily at 3:00 AM)
  cron.schedule("0 3 * * *", async () => {
    try {
      const count = await sessionService.cleanupExpiredSessions();
      logger.info({ operationType: "GENERAL" }, `Cleaned up ${count} expired sessions`);
    } catch (error) {
      logger.error({ operationType: "GENERAL", error }, "Failed to cleanup sessions");
    }
  });

  // Cleanup expired verification tokens (daily at 3:10 AM)
  cron.schedule("10 3 * * *", async () => {
    try {
      const count = await tokenService.cleanupExpiredVerificationTokens();
      logger.info({ operationType: "GENERAL" }, `Cleaned up ${count} verification tokens`);
    } catch (error) {
      logger.error({ operationType: "GENERAL", error }, "Failed to cleanup tokens");
    }
  });

  // Cleanup expired phone verification codes (daily at 3:20 AM)
  cron.schedule("20 3 * * *", async () => {
    try {
      const count = await phoneVerificationService.cleanupExpiredCodes();
      logger.info({ operationType: "GENERAL" }, `Cleaned up ${count} phone codes`);
    } catch (error) {
      logger.error({ operationType: "GENERAL", error }, "Failed to cleanup phone codes");
    }
  });

  // Cleanup expired password reset tokens (daily at 3:30 AM)
  cron.schedule("30 3 * * *", async () => {
    try {
      const count = await passwordResetService.cleanupExpiredTokens();
      logger.info({ operationType: "GENERAL" }, `Cleaned up ${count} reset tokens`);
    } catch (error) {
      logger.error({ operationType: "GENERAL", error }, "Failed to cleanup reset tokens");
    }
  });

  // Cleanup old security events (weekly on Sunday at 4:00 AM)
  cron.schedule("0 4 * * 0", async () => {
    try {
      const count = await securityEventsService.cleanupOldEvents();
      logger.info({ operationType: "GENERAL" }, `Cleaned up ${count} old security events`);
    } catch (error) {
      logger.error({ operationType: "GENERAL", error }, "Failed to cleanup security events");
    }
  });

  logger.info({ operationType: "GENERAL" }, "Auth cleanup cron jobs scheduled");
}
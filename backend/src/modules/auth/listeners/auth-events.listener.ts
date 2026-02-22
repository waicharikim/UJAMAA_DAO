/**
 * @file src/modules/auth/listeners/auth-events.listener.ts
 * @description
 * Auth Module Event Listeners — Login, logout, and phone verification events.
 *
 * Provides structured audit logging for auth lifecycle events.
 * Additional side effects (security alerts, rate limiting signals) are added here
 * as they are implemented — never by directly importing other module services.
 */

import { eventBus } from "../../../core/utils/eventBus.js";
import { logger } from "../../../core/logger/logger.js";

export async function registerAuthListeners(): Promise<void> {
  // Successful login — structured audit entry for every login method
  eventBus.on("auth.login", (data: { userId: string; method: string; sessionId: string }) => {
    logger.info(
      {
        operationType: "AUTH",
        userId: data.userId,
        metadata: { method: data.method, sessionId: data.sessionId, event: "auth.login" },
      },
      "User login recorded"
    );
  });

  // Session logout
  eventBus.on("auth.logout", (data: { userId: string; sessionId: string }) => {
    logger.info(
      {
        operationType: "AUTH",
        userId: data.userId,
        metadata: { sessionId: data.sessionId, event: "auth.logout" },
      },
      "User logout recorded"
    );
  });

  // Mass logout (revoke all sessions) — higher severity for monitoring
  eventBus.on("auth.logout.all", (data: { userId: string }) => {
    logger.warn(
      {
        operationType: "SECURITY",
        userId: data.userId,
        metadata: { event: "auth.logout.all" },
      },
      "All sessions revoked for user"
    );
  });

  // Phone verified — auth owns this lifecycle step; economy listener handles PR award separately
  eventBus.on("user.phone.verified", (data: { userId: string }) => {
    logger.info(
      {
        operationType: "AUTH",
        userId: data.userId,
        metadata: { event: "user.phone.verified" },
      },
      "Phone verification recorded — verificationLevel upgraded to PHONE_VERIFIED"
    );
  });

  logger.info(
    { operationType: "SYSTEM" },
    "Auth event listeners registered (login, logout, logout.all, phone.verified)"
  );
}

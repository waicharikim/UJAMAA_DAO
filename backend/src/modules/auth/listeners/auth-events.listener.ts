/**
 * @file src/modules/auth/listeners/auth-events.listener.ts
 * @description
 * Auth Module Event Listeners — Session, brute-force, and token events.
 *
 * Currently a stub. Auth-specific side effects (audit trail, alert on
 * repeated failures, etc.) will be wired here as they are implemented.
 */

import { logger } from "../../../core/logger/logger.js";

export async function registerAuthListeners(): Promise<void> {
  // Placeholder — no auth-specific listeners yet.
  // Future listeners (e.g. auth.failed, auth.locked, auth.session.expired) go here.
  logger.info(
    { operationType: "SYSTEM" },
    "Auth event listeners registered (no-op stub)"
  );
}

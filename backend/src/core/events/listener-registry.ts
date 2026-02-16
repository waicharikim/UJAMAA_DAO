/**
 * @file src/core/events/listener-registry.ts
 * @description
 * Event Listener Registry - Central place to register all event listeners
 * 
 * Call `registerAllListeners()` once during app startup (in index.ts or app.ts).
 * All heavy event handling should be moved to the worker process later.
 * 
 * Version: 1.1 — February 2026
 * Updated: Added real listeners for existing events, removed unused imports
 */

import { eventBus } from "../utils/eventBus.js";
import { logger } from "../logger/logger.js";

// ─────────────────────────────────────────────
// Import listener registration functions
// ─────────────────────────────────────────────

// Economy / PR related
import { registerEconomyListeners } from "../../modules/economy/listeners/onboarding-events.listeners.js";

// Auth / User related (verification, profile, etc.)
import { registerAuthListeners } from "../../modules/auth/listeners/auth-events.listener.js";

// Add future modules here when ready:
// import { registerCommunityListeners } from "../../modules/community/listeners/community-events.listener.js";
// import { registerGovernanceListeners } from "../../modules/governance/listeners/governance-events.listener.js";

/**
 * Register all event listeners across the application.
 * 
 * This should be called once during startup — preferably in the worker process
 * for heavy listeners, or in the web server for lightweight ones.
 * 
 * @example
 * // In index.ts or worker.ts
 * await registerAllListeners();
 */
export async function registerAllListeners(): Promise<void> {
  try {
    logger.info(
      { operationType: "EVENT_REGISTRY" },
      "Starting event listener registration..."
    );

    // Register listeners from each module
    await Promise.all([
      registerEconomyListeners(),
      registerAuthListeners(),
      // Add more when modules are ready:
      // registerCommunityListeners(),
      // registerGovernanceListeners(),
    ]);

    // Log summary
    const stats = eventBus.getStats?.() || []; // fallback if getStats doesn't exist yet
    const totalListeners = stats.reduce((sum: number, s: any) => sum + (s.listeners || 0), 0);

    logger.info(
      { 
        operationType: "EVENT_REGISTRY",
        metadata: { 
          registeredEvents: stats.length,
          totalListeners,
          events: stats.map((s: any) => ({ event: s.event, count: s.listeners || 0 }))
        }
      },
      `Event listeners registered successfully (${stats.length} events, ${totalListeners} listeners)`
    );
  } catch (error) {
    logger.error(
      {
        operationType: "EVENT_REGISTRY_ERROR",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      },
      "Failed to register event listeners"
    );
    throw error;
  }
}

/**
 * Unregister all event listeners (useful for testing, hot reload, or shutdown)
 */
export function unregisterAllListeners(): void {
  eventBus.removeAllListeners();
  logger.info(
    { operationType: "EVENT_REGISTRY" },
    "All event listeners unregistered"
  );
}
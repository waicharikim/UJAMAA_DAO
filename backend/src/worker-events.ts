/**
 * @file src/worker-events.ts
 * @description
 * Event listeners that run in the background worker process
 * (not in the web server)
 */

import { eventBus } from "./core/utils/eventBus.js";
import { participationRightsService } from "./modules/economy/services/participationRights.service.js";
// import other services you need...

export function registerWorkerListeners() {
  // Example: award PR when verification completes
  eventBus.on("user.verification.completed", async (payload) => {
    try {
      const { userId, level } = payload;
      let amount = 0;

      switch (level) {
        case "EMAIL_VERIFIED": amount = PR_CONFIG.EMAIL_VERIFIED; break;
        case "PHONE_VERIFIED": amount = PR_CONFIG.PHONE_VERIFIED; break;
        case "COMMUNITY_VERIFIED": amount = PR_CONFIG.COMMUNITY_VERIFIED; break;
        case "LOCATION_VERIFIED": amount = PR_CONFIG.LOCATION_VERIFIED; break;
      }

      if (amount > 0) {
        await participationRightsService.award(
          userId,
          amount,
          `VERIFICATION_${level}` as ParticipationRightsReason
        );
      }
    } catch (err) {
      logger.error(
        { operationType: "EVENT_ERROR", event: "user.verification.completed", error: String(err) },
        "Failed to process verification completed event"
      );
    }
  });

  // Add other heavy listeners here...
  // eventBus.on("governance.vote.cast", async (payload) => { ... });
  // eventBus.on("user.profile.updated", async (payload) => { ... });

  logger.info({ operationType: "EVENTS" }, "Worker event listeners registered");
}
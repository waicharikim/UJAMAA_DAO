/**
 * @file src/modules/economy/listeners/onboarding-events.listener.ts
 * @description
 * Economy Module Event Listeners - Onboarding & Verification Events
 * 
 * This module listens to onboarding-related events and awards PR accordingly.
 * Separation of concerns: Auth handles authentication, Economy handles rewards.
 * 
 * Version: 1.0 — January 2026
 */

import { eventBus } from "../../../core/utils/eventBus.js";
import { logger } from "../../../core/logger/logger.js";
import { participationRightsService } from "../services/participationRights.service.js";
import { ParticipationRightsReason, PR_CONFIG } from "../../onboarding/types.js";

/**
 * Register all onboarding-related event listeners
 */
export async function registerOnboardingListeners(): Promise<void> {
  // User created (account registration)
  eventBus.on("user.created", async (data: { userId: string; email: string }) => {
    try {
      logger.debug(
        { 
          operationType: "ECONOMY", 
          userId: data.userId,
          metadata: { event: "user.created" }
        },
        "User created event received (no PR awarded at registration)"
      );
      // No PR awarded at registration - only after email verification
    } catch (error) {
      logger.error(
        {
          operationType: "ECONOMY",
          userId: data.userId,
          metadata: { 
            event: "user.created",
            error: error instanceof Error ? error.message : String(error)
          },
        },
        "Error handling user.created event"
      );
    }
  });

  // Email verified - Award PR
  eventBus.on("user.email.verified", async (data: { 
    userId: string; 
    primaryWardId: string;
    secondaryWardId: string;
  }) => {
    try {
      logger.info(
        { 
          operationType: "ECONOMY", 
          userId: data.userId,
          metadata: { event: "user.email.verified" }
        },
        "Email verification event received - awarding PR"
      );

      await participationRightsService.award(
        data.userId,
        PR_CONFIG.EMAIL_VERIFIED, // 50 points
        ParticipationRightsReason.EMAIL_VERIFIED,
        {
          event: "email_verified",
          timestamp: new Date().toISOString(),
        }
      );

      logger.info(
        { 
          operationType: "ECONOMY", 
          userId: data.userId,
          metadata: { 
            amount: PR_CONFIG.EMAIL_VERIFIED,
            reason: ParticipationRightsReason.EMAIL_VERIFIED
          }
        },
        "PR awarded for email verification"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "ECONOMY",
          userId: data.userId,
          metadata: { 
            event: "user.email.verified",
            error: error instanceof Error ? error.message : String(error)
          },
        },
        "Failed to award PR for email verification"
      );
      // Don't throw - event handler should be resilient
    }
  });

  // Phone verified - Award PR
  eventBus.on("user.phone.verified", async (data: { userId: string }) => {
    try {
      await participationRightsService.award(
        data.userId,
        PR_CONFIG.PHONE_VERIFIED, // 50 points
        ParticipationRightsReason.PHONE_VERIFIED,
        {
          event: "phone_verified",
          timestamp: new Date().toISOString(),
        }
      );

      logger.info(
        { operationType: "ECONOMY", userId: data.userId },
        "PR awarded for phone verification"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "ECONOMY",
          userId: data.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to award PR for phone verification"
      );
    }
  });

  // Wallet connected - Award PR
  eventBus.on("user.wallet.connected", async (data: { userId: string; walletAddress: string }) => {
    try {
      await participationRightsService.award(
        data.userId,
        PR_CONFIG.WALLET_CONNECTED, // 25 points
        ParticipationRightsReason.WALLET_CONNECTED,
        {
          event: "wallet_connected",
          walletAddress: data.walletAddress,
          timestamp: new Date().toISOString(),
        }
      );

      logger.info(
        { operationType: "ECONOMY", userId: data.userId },
        "PR awarded for wallet connection"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "ECONOMY",
          userId: data.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to award PR for wallet connection"
      );
    }
  });

  // Community verified - Award PR
  eventBus.on("user.community.verified", async (data: { userId: string }) => {
    try {
      await participationRightsService.award(
        data.userId,
        PR_CONFIG.COMMUNITY_VERIFIED, // 50 points
        ParticipationRightsReason.COMMUNITY_VERIFIED,
        {
          event: "community_verified",
          timestamp: new Date().toISOString(),
        }
      );

      logger.info(
        { operationType: "ECONOMY", userId: data.userId },
        "PR awarded for community verification"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "ECONOMY",
          userId: data.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to award PR for community verification"
      );
    }
  });

  // Location verified - Award PR
  eventBus.on("user.location.verified", async (data: { userId: string }) => {
    try {
      await participationRightsService.award(
        data.userId,
        PR_CONFIG.LOCATION_VERIFIED, // 75 points
        ParticipationRightsReason.LOCATION_VERIFIED,
        {
          event: "location_verified",
          timestamp: new Date().toISOString(),
        }
      );

      logger.info(
        { operationType: "ECONOMY", userId: data.userId },
        "PR awarded for location verification"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "ECONOMY",
          userId: data.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to award PR for location verification"
      );
    }
  });

  // Full onboarding complete - Award remaining PR
  eventBus.on("user.onboarding.complete", async (data: { userId: string }) => {
    try {
      // Award remaining 50 PR (user already got 50 for email verification)
      // Total: 100 PR for complete onboarding
      await participationRightsService.award(
        data.userId,
        50, // Remaining points (50 already awarded for email)
        ParticipationRightsReason.ONBOARDING_COMPLETE,
        {
          event: "onboarding_complete",
          timestamp: new Date().toISOString(),
        }
      );

      logger.info(
        { operationType: "ECONOMY", userId: data.userId },
        "PR awarded for completing full onboarding"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "ECONOMY",
          userId: data.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to award PR for onboarding completion"
      );
    }
  });

  logger.info(
    { operationType: "SYSTEM" },
    "Economy onboarding listeners registered"
  );
}
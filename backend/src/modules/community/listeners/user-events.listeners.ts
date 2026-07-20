/**
 * @file src/modules/community/listeners/user-events.listener.ts
 * @description
 * Community Module Event Listeners - User Lifecycle Events
 *
 * This module listens to user-related events and handles group enrollment.
 * Separation of concerns: Auth handles authentication, Community handles groups.
 *
 * Version: 1.0 — January 2026
 */

import { eventBus } from '../../../core/utils/eventBus.js';
import { logger } from '../../../core/logger/logger.js';
import { groupMembershipService } from '../services/groupMembership.service.js';
import { prisma } from '../../../core/database/client.js';

/**
 * Register all community-related event listeners
 */
export async function registerCommunityListeners(): Promise<void> {
  // Email verified - Enroll in system groups
  eventBus.on(
    'user.email.verified',
    async (data: {
      userId: string;
      primaryWardId: string;
      secondaryWardId: string;
    }) => {
      try {
        logger.info(
          {
            operationType: 'COMMUNITY',
            userId: data.userId,
            metadata: {
              event: 'user.email.verified',
              primaryWardId: data.primaryWardId,
              secondaryWardId: data.secondaryWardId,
            },
          },
          'Email verification event received - enrolling in system groups'
        );

        await groupMembershipService.enrollInSystemGroups(
          data.userId,
          data.primaryWardId,
          data.secondaryWardId
        );

        await prisma.onboardingProgress
          .update({
            where: { userId: data.userId },
            data: { joinedWardGroup: true, currentStep: 'EXPLORE_COMMUNITY' },
          })
          .catch((err: Error) =>
            logger.error(
              { userId: data.userId, err: err.message },
              'Failed to update onboarding: joinedWardGroup'
            )
          );

        logger.info(
          {
            operationType: 'COMMUNITY',
            userId: data.userId,
            metadata: {
              primaryWardId: data.primaryWardId,
              secondaryWardId: data.secondaryWardId,
            },
          },
          'User enrolled in system groups successfully'
        );
      } catch (error) {
        logger.error(
          {
            operationType: 'COMMUNITY',
            userId: data.userId,
            metadata: {
              event: 'user.email.verified',
              primaryWardId: data.primaryWardId,
              secondaryWardId: data.secondaryWardId,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'Failed to enroll user in system groups'
        );
        // Don't throw - event handler should be resilient
        // User can still login, group enrollment can be retried
      }
    }
  );

  // Residence changed - Update group memberships
  eventBus.on(
    'user.residence.changed',
    async (data: {
      userId: string;
      oldPrimaryWardId: string;
      newPrimaryWardId: string;
      newSecondaryWardId?: string;
    }) => {
      try {
        logger.info(
          {
            operationType: 'COMMUNITY',
            userId: data.userId,
            metadata: {
              event: 'user.residence.changed',
              oldPrimaryWardId: data.oldPrimaryWardId,
              newPrimaryWardId: data.newPrimaryWardId,
            },
          },
          'Residence change event received - updating group memberships'
        );

        await groupMembershipService.updateResidenceGroups(
          data.userId,
          data.newPrimaryWardId,
          data.newSecondaryWardId
        );

        logger.info(
          {
            operationType: 'COMMUNITY',
            userId: data.userId,
            metadata: {
              newPrimaryWardId: data.newPrimaryWardId,
            },
          },
          'Group memberships updated after residence change'
        );
      } catch (error) {
        logger.error(
          {
            operationType: 'COMMUNITY',
            userId: data.userId,
            metadata: {
              event: 'user.residence.changed',
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'Failed to update group memberships after residence change'
        );
      }
    }
  );

  logger.info(
    { operationType: 'SYSTEM' },
    'Community user listeners registered'
  );
}

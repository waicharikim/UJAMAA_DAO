/**
 * @file src/modules/onboarding/services/onboarding.service.ts
 * @description
 * Onboarding Service — Guided User Journey
 *
 * Handles:
 * - Progress tracking
 * - Tutorial completion + rewards
 * - Milestone achievements + rewards
 * - Feature gating checks
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from '../../../core/database/client.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';

export class OnboardingService {
  /**
   * Get user's onboarding progress
   */
  async getProgress(userId: string) {
    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    const tutorials = await prisma.onboardingTutorial.findMany({
      select: {
        key: true,
        title: true,
        requiredFor: true,
        ipReward: true,
        prReward: true,
      },
    });

    const completions = await prisma.userTutorialCompletion.findMany({
      where: { userId },
      select: {
        tutorialId: true,
        completed: true,
        ipEarned: true,
        prEarned: true,
      },
    });

    const milestones = await prisma.onboardingMilestone.findMany({
      where: { userId },
      select: { milestoneKey: true, achieved: true },
    });

    return {
      progress,
      tutorials,
      completions,
      milestones,
    };
  }

  /**
   * Complete a tutorial — award rewards
   */
  async completeTutorial(userId: string, tutorialKey: string) {
    const tutorial = await prisma.onboardingTutorial.findUnique({
      where: { key: tutorialKey },
    });

    if (!tutorial || !tutorial.active) {
      throw ApiError.notFound('Tutorial', tutorialKey);
    }

    const existing = await prisma.userTutorialCompletion.findUnique({
      where: { userId_tutorialId: { userId, tutorialId: tutorial.id } },
    });

    if (existing?.completed) {
      return existing; // Already completed
    }

    const completion = await prisma.userTutorialCompletion.upsert({
      where: { userId_tutorialId: { userId, tutorialId: tutorial.id } },
      update: {
        completed: true,
        completedAt: new Date(),
        ipEarned: tutorial.ipReward,
        prEarned: tutorial.prReward,
      },
      create: {
        userId,
        tutorialId: tutorial.id,
        completed: true,
        completedAt: new Date(),
        ipEarned: tutorial.ipReward,
        prEarned: tutorial.prReward,
      },
    });

    // Award rewards
    if (tutorial.prReward > 0) {
      await participationRightsService.award(
        userId,
        tutorial.prReward,
        ParticipationRightsReason.EDUCATION_MODULE_COMPLETED,
        { tutorialKey }
      );
    }

    // TODO: Award IP when impact point service ready

    logger.info({ userId, tutorialKey }, 'Tutorial completed');

    return completion;
  }

  /**
   * Mark milestone (first vote, first proposal, etc.)
   */
  async markMilestone(userId: string, milestoneKey: string) {
    const existing = await prisma.onboardingMilestone.findUnique({
      where: { userId_milestoneKey: { userId, milestoneKey } },
    });

    if (existing?.achieved) return existing;

    const milestone = await prisma.onboardingMilestone.create({
      data: {
        userId,
        milestoneKey,
        ipEarned: 50, // From config
        prEarned: 25,
        achievedAt: new Date(),
      },
    });

    // Award rewards
    await participationRightsService.award(
      userId,
      milestone.prEarned,
      ParticipationRightsReason.MILESTONE_VERIFIED, // or specific
      { milestoneKey }
    );

    logger.info({ userId, milestoneKey }, 'Onboarding milestone achieved');

    return milestone;
  }

  /**
   * Check if user has completed required tutorials for a feature
   */
  async hasRequiredTutorials(
    userId: string,
    requiredFor: string
  ): Promise<boolean> {
    const required = await prisma.onboardingTutorial.findMany({
      where: { requiredFor, active: true },
    });

    if (required.length === 0) return true;

    const completed = await prisma.userTutorialCompletion.count({
      where: {
        userId,
        tutorialId: { in: required.map((t) => t.id) },
        completed: true,
      },
    });

    return completed === required.length;
  }
}

export const onboardingService = new OnboardingService();

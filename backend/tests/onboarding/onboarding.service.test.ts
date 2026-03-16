/**
 * @file tests/onboarding/onboarding.service.test.ts
 * @description Unit tests for OnboardingService.
 * Uses real Prisma + test DB. DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    award: vi.fn().mockResolvedValue(undefined),
    spend: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, vi } from 'vitest';
import { OnboardingService } from '../../src/modules/onboarding/services/onboarding.service.js';
import { createOnboardingUser, seedTutorial } from './helpers.js';

const service = new OnboardingService();

// ─────────────────────────────────────────────
// getProgress
// ─────────────────────────────────────────────

describe('OnboardingService.getProgress', () => {
  it('returns empty state for user with no records', async () => {
    const user = await createOnboardingUser('progress@test.com');

    const result = await service.getProgress(user.id);
    expect(result.progress).toBeNull();
    expect(result.tutorials).toEqual([]);
    expect(result.completions).toEqual([]);
    expect(result.milestones).toEqual([]);
  });

  it('returns tutorials when they exist', async () => {
    const user = await createOnboardingUser('withtutorials@test.com');
    await seedTutorial('platform_intro');
    await seedTutorial('governance_basics');

    const result = await service.getProgress(user.id);
    expect(result.tutorials).toHaveLength(2);
    expect(result.tutorials.map((t) => t.key)).toContain('platform_intro');
  });
});

// ─────────────────────────────────────────────
// completeTutorial
// ─────────────────────────────────────────────

describe('OnboardingService.completeTutorial', () => {
  it('completes tutorial and returns completion record', async () => {
    const user = await createOnboardingUser('completer@test.com');
    await seedTutorial('platform_intro', { prReward: 10 });

    const result = await service.completeTutorial(user.id, 'platform_intro');
    expect(result.completed).toBe(true);
    expect(result.userId).toBe(user.id);
    expect(result.prEarned).toBe(10);
  });

  it('throws 404 for unknown tutorial key', async () => {
    const user = await createOnboardingUser('unknowntut@test.com');

    await expect(
      service.completeTutorial(user.id, 'nonexistent_tutorial')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns existing completion without re-running if already done', async () => {
    const user = await createOnboardingUser('repeated@test.com');
    await seedTutorial('governance_basics', { prReward: 5 });

    const first = await service.completeTutorial(user.id, 'governance_basics');
    const second = await service.completeTutorial(user.id, 'governance_basics');

    expect(first.id).toBe(second.id);
  });

  it('marks tutorial as inactive — throws 404', async () => {
    const user = await createOnboardingUser('inactive_tut@test.com');
    const tutorial = await seedTutorial('inactive_tutorial');
    // Deactivate it
    await import('../../src/core/database/client.js').then(({ prisma }) =>
      prisma.onboardingTutorial.update({
        where: { id: tutorial.id },
        data: { active: false },
      })
    );

    await expect(
      service.completeTutorial(user.id, 'inactive_tutorial')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────
// markMilestone
// ─────────────────────────────────────────────

describe('OnboardingService.markMilestone', () => {
  it('creates milestone record on first call', async () => {
    const user = await createOnboardingUser('milestone@test.com');

    const result = await service.markMilestone(user.id, 'first_vote');
    expect(result.milestoneKey).toBe('first_vote');
    expect(result.userId).toBe(user.id);
    expect(result.achievedAt).toBeDefined();
  });

  it('returns existing record without duplicating on second call', async () => {
    const user = await createOnboardingUser('milestone2@test.com');

    const first = await service.markMilestone(user.id, 'first_proposal');
    const second = await service.markMilestone(user.id, 'first_proposal');

    expect(first.id).toBe(second.id);
  });
});

// ─────────────────────────────────────────────
// hasRequiredTutorials
// ─────────────────────────────────────────────

describe('OnboardingService.hasRequiredTutorials', () => {
  it('returns true when no tutorials are required for the feature', async () => {
    const user = await createOnboardingUser('norequired@test.com');

    const result = await service.hasRequiredTutorials(user.id, 'VOTING');
    expect(result).toBe(true);
  });

  it('returns false when required tutorial not completed', async () => {
    const user = await createOnboardingUser('incomplete@test.com');
    await seedTutorial('voting_intro', { requiredFor: 'VOTING' });

    const result = await service.hasRequiredTutorials(user.id, 'VOTING');
    expect(result).toBe(false);
  });

  it('returns true when all required tutorials are completed', async () => {
    const user = await createOnboardingUser('completed@test.com');
    await seedTutorial('voting_complete', { requiredFor: 'VOTING_COMPLETE' });
    await service.completeTutorial(user.id, 'voting_complete');

    const result = await service.hasRequiredTutorials(user.id, 'VOTING_COMPLETE');
    expect(result).toBe(true);
  });
});

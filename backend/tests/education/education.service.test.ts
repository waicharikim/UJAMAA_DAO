/**
 * @file tests/education/education.service.test.ts
 * @description Unit tests for EducationService (real DB, no mocks).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EducationService } from '../../src/modules/education/services/education.service.js';
import { prisma } from '../../src/core/database/client.js';
import { createEducationUser, seedModule, seedProgress } from './helpers.js';

const service = new EducationService();

// ─────────────────────────────────────────────
// listModules
// ─────────────────────────────────────────────

describe('EducationService.listModules', () => {
  it('returns empty list when no modules exist', async () => {
    const result = await service.listModules({});
    expect(result.modules).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns only verified modules', async () => {
    const creator = await createEducationUser('list-creator@test.com');
    await seedModule(creator.id, { verified: true, title: 'Verified' });
    await seedModule(creator.id, { verified: false, title: 'Unverified' });

    const result = await service.listModules({});
    expect(result.modules.length).toBe(1);
    expect(result.modules[0].title).toBe('Verified');
    expect(result.total).toBe(1);
  });

  it('filters by category', async () => {
    const creator = await createEducationUser('list-cat@test.com');
    await seedModule(creator.id, { category: 'governance' });
    await seedModule(creator.id, { category: 'economy' });

    const result = await service.listModules({ category: 'governance' });
    expect(result.modules.length).toBe(1);
    expect(result.modules[0].category).toBe('governance');
  });

  it('filters by difficulty', async () => {
    const creator = await createEducationUser('list-diff@test.com');
    await seedModule(creator.id, { difficulty: 'BEGINNER' });
    await seedModule(creator.id, { difficulty: 'EXPERT' });

    const result = await service.listModules({ difficulty: 'BEGINNER' });
    expect(result.modules.length).toBe(1);
    expect(result.modules[0].difficulty).toBe('BEGINNER');
  });

  it('paginates correctly', async () => {
    const creator = await createEducationUser('list-page@test.com');
    for (let i = 0; i < 5; i++) {
      await seedModule(creator.id, { title: `Module ${i}` });
    }
    const page1 = await service.listModules({ limit: 3, offset: 0 });
    const page2 = await service.listModules({ limit: 3, offset: 3 });
    expect(page1.modules.length).toBe(3);
    expect(page2.modules.length).toBe(2);
    expect(page1.total).toBe(5);
  });
});

// ─────────────────────────────────────────────
// getModule
// ─────────────────────────────────────────────

describe('EducationService.getModule', () => {
  it('returns module with creator info', async () => {
    const creator = await createEducationUser('getmod-creator@test.com');
    const mod = await seedModule(creator.id);

    const result = await service.getModule(mod.id);
    expect(result.id).toBe(mod.id);
    expect(result.creator.id).toBe(creator.id);
    expect(result.assessment).toBeNull();
    expect(result.userProgress).toBeNull();
  });

  it('returns userProgress when user has started', async () => {
    const creator = await createEducationUser('getmod-prog@test.com');
    const user = await createEducationUser('getmod-user@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');

    const result = await service.getModule(mod.id, user.id);
    expect(result.userProgress).not.toBeNull();
    expect(result.userProgress?.status).toBe('IN_PROGRESS');
  });

  it('throws 404 for unknown moduleId', async () => {
    await expect(
      service.getModule('00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────
// startModule
// ─────────────────────────────────────────────

describe('EducationService.startModule', () => {
  it('creates IN_PROGRESS record on first call', async () => {
    const creator = await createEducationUser('start-creator@test.com');
    const user = await createEducationUser('start-user@test.com');
    const mod = await seedModule(creator.id);

    const result = await service.startModule(user.id, mod.id);
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.progress).toBe(0);
    expect(result.userId).toBe(user.id);
  });

  it('is idempotent — second call returns existing record', async () => {
    const creator = await createEducationUser('start-idem-creator@test.com');
    const user = await createEducationUser('start-idem-user@test.com');
    const mod = await seedModule(creator.id);

    const first = await service.startModule(user.id, mod.id);
    const second = await service.startModule(user.id, mod.id);
    expect(second.id).toBe(first.id);
  });

  it('throws 404 for unknown module', async () => {
    const user = await createEducationUser('start-404@test.com');
    await expect(
      service.startModule(user.id, '00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 for unverified module', async () => {
    const creator = await createEducationUser('start-unv-creator@test.com');
    const user = await createEducationUser('start-unv-user@test.com');
    const mod = await seedModule(creator.id, { verified: false });

    await expect(
      service.startModule(user.id, mod.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────
// completeModule
// ─────────────────────────────────────────────

describe('EducationService.completeModule', () => {
  it('marks module COMPLETED and sets completedAt', async () => {
    const creator = await createEducationUser('complete-creator@test.com');
    const user = await createEducationUser('complete-user@test.com');
    const mod = await seedModule(creator.id, { completionIP: 10 });
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');

    const result = await service.completeModule(user.id, mod.id, { score: 85 });
    expect(result.status).toBe('COMPLETED');
    expect(result.progress).toBe(100);
    expect(result.score).toBe(85);
    expect(result.completedAt).not.toBeNull();
    expect(result.ipAwarded).toBe(10);
  });

  it('is idempotent — second call returns existing COMPLETED record', async () => {
    const creator = await createEducationUser('complete-idem-c@test.com');
    const user = await createEducationUser('complete-idem-u@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'COMPLETED');

    const result = await service.completeModule(user.id, mod.id);
    expect(result.status).toBe('COMPLETED');
  });

  it('throws 400 if module was never started', async () => {
    const creator = await createEducationUser('complete-nostart-c@test.com');
    const user = await createEducationUser('complete-nostart-u@test.com');
    const mod = await seedModule(creator.id);

    await expect(
      service.completeModule(user.id, mod.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for unknown module', async () => {
    const user = await createEducationUser('complete-404@test.com');
    await expect(
      service.completeModule(user.id, '00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────
// submitReview
// ─────────────────────────────────────────────

describe('EducationService.submitReview', () => {
  it('creates review for a completed module', async () => {
    const creator = await createEducationUser('review-creator@test.com');
    const user = await createEducationUser('review-user@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'COMPLETED');

    const result = await service.submitReview(user.id, mod.id, {
      rating: 5,
      comment: 'Great module!',
    });
    expect(result.rating).toBe(5);
    expect(result.comment).toBe('Great module!');
    expect(result.moduleId).toBe(mod.id);
  });

  it('updates module averageRating', async () => {
    const creator = await createEducationUser('review-avg-c@test.com');
    const u1 = await createEducationUser('review-avg-u1@test.com');
    const u2 = await createEducationUser('review-avg-u2@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(u1.id, mod.id, 'COMPLETED');
    await seedProgress(u2.id, mod.id, 'COMPLETED');

    await service.submitReview(u1.id, mod.id, { rating: 4 });
    await service.submitReview(u2.id, mod.id, { rating: 2 });

    const updated = await prisma.educationalModule.findUnique({ where: { id: mod.id } });
    expect(Number(updated?.averageRating)).toBe(3);
  });

  it('throws 400 if module not completed', async () => {
    const creator = await createEducationUser('review-400-c@test.com');
    const user = await createEducationUser('review-400-u@test.com');
    const mod = await seedModule(creator.id);
    // not started

    await expect(
      service.submitReview(user.id, mod.id, { rating: 3 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 if module only started, not completed', async () => {
    const creator = await createEducationUser('review-ip-c@test.com');
    const user = await createEducationUser('review-ip-u@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');

    await expect(
      service.submitReview(user.id, mod.id, { rating: 3 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 for unknown module', async () => {
    const user = await createEducationUser('review-404@test.com');
    await expect(
      service.submitReview(user.id, '00000000-0000-0000-0000-000000000000', { rating: 5 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

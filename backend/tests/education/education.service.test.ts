/**
 * @file tests/education/education.service.test.ts
 * @description Unit tests for EducationService (real DB, no mocks).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EducationService } from '../../src/modules/education/services/education.service.js';
import { prisma } from '../../src/core/database/client.js';
import {
  createEducationUser,
  createEligibleAuthor,
  seedModule,
  seedProgress,
  seedDraftModule,
  seedSubmittedModule,
  seedRejectedModule,
  VALID_MODULE_DTO,
} from './helpers.js';

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

// ─────────────────────────────────────────────
// getMyProgress
// ─────────────────────────────────────────────

describe('EducationService.getMyProgress', () => {
  it('returns empty lists when user has no progress', async () => {
    const user = await createEducationUser('myprog-empty@test.com');
    const result = await service.getMyProgress(user.id);
    expect(result.inProgress).toEqual([]);
    expect(result.completed).toEqual([]);
  });

  it('separates IN_PROGRESS and COMPLETED modules', async () => {
    const creator = await createEducationUser('myprog-creator@test.com');
    const user = await createEducationUser('myprog-user@test.com');
    const modA = await seedModule(creator.id, { title: 'Module A' });
    const modB = await seedModule(creator.id, { title: 'Module B' });
    await seedProgress(user.id, modA.id, 'IN_PROGRESS');
    await seedProgress(user.id, modB.id, 'COMPLETED');

    const result = await service.getMyProgress(user.id);
    expect(result.inProgress).toHaveLength(1);
    expect(result.inProgress[0].id).toBe(modA.id);
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].id).toBe(modB.id);
  });

  it('excludes unverified modules from progress results', async () => {
    const creator = await createEducationUser('myprog-unv-c@test.com');
    const user = await createEducationUser('myprog-unv-u@test.com');
    const unverified = await seedModule(creator.id, { verified: false });
    await seedProgress(user.id, unverified.id, 'COMPLETED');

    const result = await service.getMyProgress(user.id);
    expect(result.completed).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// getAuthorshipEligibility
// ─────────────────────────────────────────────

describe('EducationService.getAuthorshipEligibility', () => {
  it('returns not-eligible with zero IP and zero completed modules', async () => {
    const user = await createEducationUser('elig-zero@test.com');
    const result = await service.getAuthorshipEligibility(user.id);
    expect(result.eligible).toBe(false);
    expect(result.completedModules).toBe(0);
    expect(result.currentIP).toBe(0);
  });

  it('returns not-eligible when IP is sufficient but modules are not', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'elig-nomod@test.com',
        name: 'No Modules',
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        globalImpactPoints: 200,
      },
    });
    const result = await service.getAuthorshipEligibility(user.id);
    expect(result.eligible).toBe(false);
    expect(result.completedModules).toBe(0);
    expect(result.requiredModules).toBe(3);
  });

  it('returns not-eligible when modules are sufficient but IP is not', async () => {
    const creator = await createEducationUser('elig-noip-c@test.com');
    const user = await createEducationUser('elig-noip-u@test.com');
    for (let i = 0; i < 3; i++) {
      const mod = await seedModule(creator.id, { verified: true });
      await seedProgress(user.id, mod.id, 'COMPLETED');
    }
    const result = await service.getAuthorshipEligibility(user.id);
    expect(result.eligible).toBe(false);
    expect(result.completedModules).toBe(3);
    expect(result.currentIP).toBe(0);
  });

  it('returns eligible when both thresholds are met', async () => {
    const author = await createEligibleAuthor('elig-yes@test.com');
    const result = await service.getAuthorshipEligibility(author.id);
    expect(result.eligible).toBe(true);
    expect(result.completedModules).toBeGreaterThanOrEqual(3);
    expect(result.currentIP).toBeGreaterThanOrEqual(result.requiredIP);
  });

  it('requires more IP for long-tenured accounts', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'elig-old@test.com',
        name: 'Old Account',
        verificationLevel: 'COMMUNITY_VERIFIED',
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        globalImpactPoints: 200,
        createdAt: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000), // 366 days ago
      },
    });
    const result = await service.getAuthorshipEligibility(user.id);
    expect(result.requiredIP).toBe(500);
    expect(result.eligible).toBe(false); // 200 IP < 500 required
  });
});

// ─────────────────────────────────────────────
// createModule
// ─────────────────────────────────────────────

describe('EducationService.createModule', () => {
  it('throws 403 when user does not meet eligibility criteria', async () => {
    const user = await createEducationUser('create-inelig@test.com');
    await expect(
      service.createModule(user.id, VALID_MODULE_DTO)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates a DRAFT module with correct fields', async () => {
    const author = await createEligibleAuthor('create-ok@test.com');
    const result = await service.createModule(author.id, VALID_MODULE_DTO);
    expect(result.status).toBe('DRAFT');
    expect(result.verified).toBe(false);
    expect(result.submittedAt).toBeNull();
    expect(result.title).toBe(VALID_MODULE_DTO.title);
    expect(result.creator.id).toBe(author.id);
    expect(result.completionIP).toBe(VALID_MODULE_DTO.completionIP);
  });

  it('persists the module to the database', async () => {
    const author = await createEligibleAuthor('create-persist@test.com');
    const result = await service.createModule(author.id, VALID_MODULE_DTO);
    const inDb = await prisma.educationalModule.findUnique({ where: { id: result.id } });
    expect(inDb).not.toBeNull();
    expect(inDb!.title).toBe(VALID_MODULE_DTO.title);
  });
});

// ─────────────────────────────────────────────
// updateModule
// ─────────────────────────────────────────────

describe('EducationService.updateModule', () => {
  it('throws 403 when user is not eligible', async () => {
    const ineligible = await createEducationUser('upd-inelig-c@test.com');
    const mod = await seedDraftModule(ineligible.id);
    await expect(
      service.updateModule(ineligible.id, mod.id, { title: 'New Title Here' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('updates title and content on own DRAFT', async () => {
    const author = await createEligibleAuthor('upd-ok@test.com');
    const mod = await seedDraftModule(author.id);
    const result = await service.updateModule(author.id, mod.id, { title: 'Revised Title Here' });
    expect(result.title).toBe('Revised Title Here');
    expect(result.status).toBe('DRAFT');
  });

  it('throws 403 for a different user\'s module', async () => {
    const authorA = await createEligibleAuthor('upd-owner-a@test.com');
    const authorB = await createEligibleAuthor('upd-owner-b@test.com');
    const mod = await seedDraftModule(authorB.id);
    await expect(
      service.updateModule(authorA.id, mod.id, { title: 'Hijacked Title!' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 for a submitted module', async () => {
    const author = await createEligibleAuthor('upd-submitted@test.com');
    const mod = await seedSubmittedModule(author.id);
    await expect(
      service.updateModule(author.id, mod.id, { title: 'Try To Edit' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for an approved module', async () => {
    const author = await createEligibleAuthor('upd-approved@test.com');
    const mod = await seedModule(author.id, { verified: true });
    await expect(
      service.updateModule(author.id, mod.id, { title: 'Try To Edit' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────
// submitModule
// ─────────────────────────────────────────────

describe('EducationService.submitModule', () => {
  it('transitions DRAFT → SUBMITTED and sets submittedAt', async () => {
    const author = await createEligibleAuthor('submit-ok@test.com');
    const mod = await seedDraftModule(author.id);
    const result = await service.submitModule(author.id, mod.id);
    expect(result.status).toBe('SUBMITTED');
    expect(result.submittedAt).not.toBeNull();
  });

  it('throws 400 if already submitted (pending review)', async () => {
    const author = await createEligibleAuthor('submit-dup@test.com');
    const mod = await seedSubmittedModule(author.id);
    await expect(
      service.submitModule(author.id, mod.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 if already approved', async () => {
    const author = await createEligibleAuthor('submit-approved@test.com');
    const mod = await seedModule(author.id, { verified: true });
    await expect(
      service.submitModule(author.id, mod.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('allows re-submitting a rejected module', async () => {
    const author = await createEligibleAuthor('submit-resubmit@test.com');
    const mod = await seedRejectedModule(author.id);
    const result = await service.submitModule(author.id, mod.id);
    expect(result.status).toBe('SUBMITTED');
    expect(result.rejectionReason).toBeNull();
  });

  it('throws 403 for a different user\'s module', async () => {
    const authorA = await createEligibleAuthor('submit-owner-a@test.com');
    const authorB = await createEligibleAuthor('submit-owner-b@test.com');
    const mod = await seedDraftModule(authorB.id);
    await expect(
      service.submitModule(authorA.id, mod.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────
// deleteModule
// ─────────────────────────────────────────────

describe('EducationService.deleteModule', () => {
  it('deletes own DRAFT and removes it from the database', async () => {
    const author = await createEligibleAuthor('del-ok@test.com');
    const mod = await seedDraftModule(author.id);
    await service.deleteModule(author.id, mod.id);
    const inDb = await prisma.educationalModule.findUnique({ where: { id: mod.id } });
    expect(inDb).toBeNull();
  });

  it('allows deleting a submitted (pending review) module', async () => {
    const author = await createEligibleAuthor('del-submitted@test.com');
    const mod = await seedSubmittedModule(author.id);
    await service.deleteModule(author.id, mod.id);
    const inDb = await prisma.educationalModule.findUnique({ where: { id: mod.id } });
    expect(inDb).toBeNull();
  });

  it('throws 403 for a different user\'s module', async () => {
    const authorA = await createEducationUser('del-owner-a@test.com');
    const authorB = await createEducationUser('del-owner-b@test.com');
    const mod = await seedDraftModule(authorB.id);
    await expect(
      service.deleteModule(authorA.id, mod.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 for an approved module', async () => {
    const author = await createEducationUser('del-approved@test.com');
    const mod = await seedModule(author.id, { verified: true });
    await expect(
      service.deleteModule(author.id, mod.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────
// getMyModules
// ─────────────────────────────────────────────

describe('EducationService.getMyModules', () => {
  it('returns empty array for user with no authored modules', async () => {
    const user = await createEducationUser('mymod-empty@test.com');
    const result = await service.getMyModules(user.id);
    expect(result).toEqual([]);
  });

  it('returns all own modules with correct derived status', async () => {
    const author = await createEligibleAuthor('mymod-all@test.com');
    const draft = await seedDraftModule(author.id, 'My Draft');
    const submitted = await seedSubmittedModule(author.id);
    const approved = await seedModule(author.id, { verified: true, title: 'My Approved' });

    const result = await service.getMyModules(author.id);
    // createEligibleAuthor seeds 3 prerequisite APPROVED modules; plus draft/submitted/approved = 6 total
    expect(result).toHaveLength(6);

    const statuses = result.map((m) => m.status);
    expect(statuses).toContain('DRAFT');
    expect(statuses).toContain('SUBMITTED');
    expect(statuses).toContain('APPROVED');
  });

  it('does not return modules created by other users', async () => {
    const authorA = await createEducationUser('mymod-iso-a@test.com');
    const authorB = await createEducationUser('mymod-iso-b@test.com');
    await seedDraftModule(authorB.id, 'Not Mine');

    const result = await service.getMyModules(authorA.id);
    expect(result).toHaveLength(0);
  });
});

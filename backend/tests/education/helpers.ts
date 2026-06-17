/**
 * @file tests/education/helpers.ts
 * @description Shared seed helpers for education module tests.
 * NOT a test file — imported by education test files.
 */

import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

// ─── User helpers ─────────────────────────────────────────────────────────────

export async function createEducationUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Education Test User',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
    },
  });
}

// ─── Module helpers ───────────────────────────────────────────────────────────

export async function seedModule(
  creatorId: string,
  overrides: {
    title?: string;
    verified?: boolean;
    completionIP?: number;
    difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
    category?: string;
  } = {}
) {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title: overrides.title ?? 'Test Education Module',
      description: 'A module for testing purposes',
      content: 'Full module content goes here',
      mediaUrls: [],
      duration: 30,
      difficulty: overrides.difficulty ?? 'BEGINNER',
      category: overrides.category ?? 'governance',
      verified: overrides.verified ?? true,
      completionIP: overrides.completionIP ?? 10,
    },
  });
}

export async function seedProgress(
  userId: string,
  moduleId: string,
  status: 'IN_PROGRESS' | 'COMPLETED' = 'IN_PROGRESS'
) {
  return prisma.userEducationalProgress.create({
    data: {
      userId,
      moduleId,
      status,
      progress: status === 'COMPLETED' ? 100 : 0,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      // A COMPLETED module has already paid out — mirror the once-ever guard so
      // re-completing a pre-existing completion never re-awards (see migration).
      rewardAwarded: status === 'COMPLETED',
    },
  });
}

// Canonical quiz shape: { prompt, options: string[], answer: numeric index }.
// Default answer key is [0, 1, 2] → submit [0,1,0] to pass (2/3), [2,2,2] to fail.
export async function seedAssessment(
  moduleId: string,
  overrides: {
    passingScore?: number;
    maxAttempts?: number;
    questions?: Array<{ prompt: string; options: string[]; answer: number }>;
  } = {}
) {
  return prisma.educationalAssessment.create({
    data: {
      moduleId,
      questions: overrides.questions ?? [
        { prompt: 'Q1', options: ['A', 'B', 'C'], answer: 0 },
        { prompt: 'Q2', options: ['A', 'B', 'C'], answer: 1 },
        { prompt: 'Q3', options: ['A', 'B', 'C'], answer: 2 },
      ],
      passingScore: overrides.passingScore ?? 60,
      maxAttempts: overrides.maxAttempts ?? 5,
    },
  });
}

// ─── Authorship helpers ───────────────────────────────────────────────────────

/** Creates a COMMUNITY_VERIFIED user with 200 IP + 3 COMPLETED modules — satisfies the tiered IP gate for new accounts (threshold: 150). */
export async function createEligibleAuthor(email: string) {
  const author = await prisma.user.create({
    data: {
      email,
      name: 'Eligible Author',
      verificationLevel: 'COMMUNITY_VERIFIED',
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      locationVerified: false,
      globalImpactPoints: 200,
    },
  });
  for (let i = 0; i < 3; i++) {
    const mod = await seedModule(author.id, {
      verified: true,
      title: `Prereq Module ${i}`,
    });
    await seedProgress(author.id, mod.id, 'COMPLETED');
  }
  return author;
}

// ─── Module state seeders ─────────────────────────────────────────────────────

/** Unverified draft — no submittedAt, no rejectionReason. */
export async function seedDraftModule(
  creatorId: string,
  title = 'Draft Module'
) {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title,
      description: 'A draft module for testing purposes.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: false,
      completionIP: 10,
    },
  });
}

/** Submitted — awaiting admin review. */
export async function seedSubmittedModule(creatorId: string) {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title: 'Submitted Module',
      description: 'A submitted module awaiting review.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: false,
      completionIP: 10,
      submittedAt: new Date(),
      rejectionReason: null,
    },
  });
}

/** Rejected — submittedAt + rejectionReason set, verified false. */
export async function seedRejectedModule(creatorId: string) {
  return prisma.educationalModule.create({
    data: {
      creatorId,
      title: 'Rejected Module',
      description: 'A rejected module for testing purposes.',
      content: 'Introduction to the topic. ' + 'x'.repeat(80),
      mediaUrls: [],
      duration: 20,
      difficulty: 'BEGINNER',
      category: 'governance',
      verified: false,
      completionIP: 10,
      submittedAt: new Date(Date.now() - 86_400_000),
      rejectionReason: 'Content is too brief and lacks depth.',
    },
  });
}

/** Valid CreateModuleDto — satisfies all validators (title ≥5, desc ≥20, content ≥100). */
export const VALID_MODULE_DTO = {
  title: 'Ward Budget Fundamentals',
  description:
    'Learn how ward development funds are allocated and tracked by county governments.',
  content:
    'Ward development funds are allocated annually by county governments. This module explains the allocation formula, how to access expenditure reports, and how community members can participate in budget review meetings.',
  duration: 25,
  difficulty: 'BEGINNER' as const,
  category: 'governance',
  completionIP: 15,
};

// ─── JWT helper ───────────────────────────────────────────────────────────────

export function makeEducationToken(
  userId: string,
  extra: Partial<JwtPayload> = {}
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: 'COMMUNITY_VERIFIED',
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 50,
      emailVerified: true,
      phoneVerified: true,
      communityVerified: true,
      type: 'permanent',
      ...extra,
    },
    '1h',
    0
  );
}

export function makeEmailVerifiedToken(userId: string): string {
  return makeEducationToken(userId, {
    verificationLevel: 'EMAIL_VERIFIED',
    communityVerified: false,
  });
}

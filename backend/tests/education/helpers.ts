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
    },
  });
}

export async function seedAssessment(moduleId: string) {
  return prisma.educationalAssessment.create({
    data: {
      moduleId,
      questions: [{ q: 'What is Ujamaa?', options: ['A', 'B'], answer: 'A' }],
      passingScore: 70,
      maxAttempts: 3,
    },
  });
}

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

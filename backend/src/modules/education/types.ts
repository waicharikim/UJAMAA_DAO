/**
 * @file src/modules/education/types.ts
 * @description DTOs and types for the Education module.
 * Version: 1.0 — March 2026
 */

export enum ProgressStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface ListModulesDto {
  category?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
}

export interface CompleteModuleDto {
  score?: number;
}

export interface SubmitReviewDto {
  rating: number; // 1–5
  comment?: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface EducationModuleDto {
  id: string;
  title: string;
  description: string;
  content: string;
  mediaUrls: string[];
  duration: number;
  difficulty: string;
  category: string;
  verified: boolean;
  completionIP: number;
  views: number;
  averageRating: number;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
  };
  _count?: {
    progress: number;
    reviews: number;
  };
}

export interface EducationModuleDetailDto extends EducationModuleDto {
  assessment: {
    id: string;
    passingScore: number;
    maxAttempts: number;
    questions: unknown;
  } | null;
  userProgress?: {
    status: string;
    progress: number;
    score: number | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
}

export interface ListModulesResultDto {
  modules: EducationModuleDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProgressDto {
  id: string;
  userId: string;
  moduleId: string;
  status: string;
  progress: number;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
  ipAwarded?: number;
}

export interface ReviewDto {
  id: string;
  moduleId: string;
  userId: string;
  rating: number;
  comment: string | null;
  helpful: number;
  createdAt: string;
}

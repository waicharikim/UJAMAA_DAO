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
  // Selected option index per question, in question order. Graded server-side.
  answers?: number[];
}

// A single quiz question as stored (with the correct answer key).
// NEVER serialize `answer` to clients — use QuizQuestionPublic for that.
export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number; // index into options
}

// Quiz question shape served to clients — answer key stripped.
export interface QuizQuestionPublic {
  prompt: string;
  options: string[];
}

export interface SubmitReviewDto {
  rating: number; // 1–5
  comment?: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export type ModuleStatus = 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED';

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
  status: ModuleStatus;
  rejectionReason?: string | null;
  submittedAt?: string | null;
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

export interface CreateModuleDto {
  title: string;
  description: string;
  content: string;
  mediaUrls?: string[];
  duration: number;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  category: string;
  completionIP?: number;
}

export interface UpdateModuleDto {
  title?: string;
  description?: string;
  content?: string;
  mediaUrls?: string[];
  duration?: number;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  category?: string;
  completionIP?: number;
}

export interface RejectModuleDto {
  reason: string;
}

export interface AuthorshipEligibilityDto {
  eligible: boolean;
  completedModules: number;
  requiredModules: number;
  currentIP: number;
  requiredIP: number;
  daysOnPlatform: number;
}

export interface EducationModuleDetailDto extends EducationModuleDto {
  assessment: {
    id: string;
    passingScore: number;
    maxAttempts: number;
    questions: QuizQuestionPublic[]; // answer key stripped
  } | null;
  userProgress?: {
    status: string;
    progress: number;
    score: number | null;
    startedAt: string;
    completedAt: string | null;
    rewardAwarded: boolean;
    attempts: number;
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
  // Quiz feedback (present when the module has a comprehension quiz)
  passed?: boolean;
  attemptsUsed?: number;
  attemptsRemaining?: number;
  passingScore?: number;
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

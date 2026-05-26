/**
 * @file src/modules/education/services/education.service.ts
 * @description Education Service — module discovery, progress tracking, IP awards.
 * Version: 1.0 — March 2026
 */

import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { GlobalImpactPointService } from '../../reputation/service/impactPoint.service.js';
import { participationRightsService } from '../../economy/services/participationRights.service.js';
import { ParticipationRightsReason } from '../../economy/types.js';
import { ImpactPointReason } from '../../reputation/types.js';
import type {
  ListModulesDto,
  CompleteModuleDto,
  SubmitReviewDto,
  ListModulesResultDto,
  EducationModuleDto,
  EducationModuleDetailDto,
  ProgressDto,
  ReviewDto,
} from '../types.js';

const ipService = new GlobalImpactPointService();

function mapModule(m: any): EducationModuleDto {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    content: m.content,
    mediaUrls: m.mediaUrls,
    duration: m.duration,
    difficulty: m.difficulty,
    category: m.category,
    verified: m.verified,
    completionIP: m.completionIP,
    views: m.views,
    averageRating: Number(m.averageRating),
    createdAt: m.createdAt.toISOString(),
    creator: { id: m.creator.id, name: m.creator.name },
    _count: m._count,
  };
}

export class EducationService {
  // ── List modules (public) ───────────────────────────────────────────────────

  async listModules(dto: ListModulesDto): Promise<ListModulesResultDto> {
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;

    const where: any = { verified: true };
    if (dto.category) where.category = dto.category;
    if (dto.difficulty) where.difficulty = dto.difficulty;

    const [modules, total] = await Promise.all([
      prisma.educationalModule.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          _count: { select: { progress: true, reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.educationalModule.count({ where }),
    ]);

    return { modules: modules.map(mapModule), total, limit, offset };
  }

  // ── Get single module (public) ──────────────────────────────────────────────

  async getModule(
    moduleId: string,
    requestingUserId?: string
  ): Promise<EducationModuleDetailDto> {
    const module = await prisma.educationalModule.findUnique({
      where: { id: moduleId },
      include: {
        creator: { select: { id: true, name: true } },
        assessments: {
          select: {
            id: true,
            passingScore: true,
            maxAttempts: true,
            questions: true,
          },
        },
        _count: { select: { progress: true, reviews: true } },
      },
    });

    if (!module) throw ApiError.notFound('Module not found');

    // Increment view count (fire-and-forget — never fail the response)
    prisma.educationalModule
      .update({ where: { id: moduleId }, data: { views: { increment: 1 } } })
      .catch(() => {});

    let userProgress = null;
    if (requestingUserId) {
      const prog = await prisma.userEducationalProgress.findUnique({
        where: { userId_moduleId: { userId: requestingUserId, moduleId } },
      });
      if (prog) {
        userProgress = {
          status: prog.status,
          progress: prog.progress,
          score: prog.score,
          startedAt: prog.startedAt.toISOString(),
          completedAt: prog.completedAt?.toISOString() ?? null,
        };
      }
    }

    return {
      ...mapModule(module),
      assessment: module.assessments[0] ?? null,
      userProgress,
    };
  }

  // ── Start module ────────────────────────────────────────────────────────────

  async startModule(userId: string, moduleId: string): Promise<ProgressDto> {
    const module = await prisma.educationalModule.findUnique({
      where: { id: moduleId },
      select: { id: true, verified: true },
    });
    if (!module) throw ApiError.notFound('Module not found');
    if (!module.verified) throw ApiError.notFound('Module not found');

    const progress = await prisma.userEducationalProgress.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      create: { userId, moduleId, status: 'IN_PROGRESS', progress: 0 },
      update: {}, // idempotent — don't reset if already started/completed
    });

    return {
      id: progress.id,
      userId: progress.userId,
      moduleId: progress.moduleId,
      status: progress.status,
      progress: progress.progress,
      score: progress.score,
      startedAt: progress.startedAt.toISOString(),
      completedAt: progress.completedAt?.toISOString() ?? null,
    };
  }

  // ── Complete module + award IP ──────────────────────────────────────────────

  async completeModule(
    userId: string,
    moduleId: string,
    dto: CompleteModuleDto = {}
  ): Promise<ProgressDto> {
    const module = await prisma.educationalModule.findUnique({
      where: { id: moduleId },
      select: { id: true, verified: true, completionIP: true },
    });
    if (!module) throw ApiError.notFound('Module not found');

    const existing = await prisma.userEducationalProgress.findUnique({
      where: { userId_moduleId: { userId, moduleId } },
    });
    if (!existing)
      throw ApiError.badRequest('Module not started — call start first');
    if (existing.status === 'COMPLETED') {
      return {
        id: existing.id,
        userId: existing.userId,
        moduleId: existing.moduleId,
        status: existing.status,
        progress: existing.progress,
        score: existing.score,
        startedAt: existing.startedAt.toISOString(),
        completedAt: existing.completedAt?.toISOString() ?? null,
      };
    }

    const updated = await prisma.userEducationalProgress.update({
      where: { userId_moduleId: { userId, moduleId } },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        score: dto.score ?? null,
      },
    });

    // Award IP for completing the module
    const ipAmount = module.completionIP;
    if (ipAmount > 0) {
      await ipService.award(
        userId,
        ipAmount,
        ImpactPointReason.EDUCATION_MODULE_COMPLETED,
        {
          moduleId,
        }
      );
    }

    // Award PR for completing an educational module
    await participationRightsService
      .award(userId, 5, ParticipationRightsReason.EDUCATION_MODULE_COMPLETED, {
        moduleId,
      })
      .catch(() => {});

    return {
      id: updated.id,
      userId: updated.userId,
      moduleId: updated.moduleId,
      status: updated.status,
      progress: updated.progress,
      score: updated.score,
      startedAt: updated.startedAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
      ipAwarded: ipAmount > 0 ? ipAmount : undefined,
    };
  }

  // ── My progress ────────────────────────────────────────────────────────────

  async getMyProgress(userId: string): Promise<{
    inProgress: EducationModuleDto[];
    completed: EducationModuleDto[];
  }> {
    const records = await prisma.userEducationalProgress.findMany({
      where: { userId },
      include: {
        module: {
          include: {
            creator: { select: { id: true, name: true } },
            _count: { select: { progress: true, reviews: true } },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const inProgress: EducationModuleDto[] = [];
    const completed: EducationModuleDto[] = [];

    for (const r of records) {
      if (!r.module.verified) continue;
      const dto = mapModule(r.module);
      if (r.status === 'COMPLETED') completed.push(dto);
      else inProgress.push(dto);
    }

    return { inProgress, completed };
  }

  // ── Submit review ───────────────────────────────────────────────────────────

  async submitReview(
    userId: string,
    moduleId: string,
    dto: SubmitReviewDto
  ): Promise<ReviewDto> {
    const module = await prisma.educationalModule.findUnique({
      where: { id: moduleId },
      select: { id: true },
    });
    if (!module) throw ApiError.notFound('Module not found');

    // Must have completed the module to review it
    const progress = await prisma.userEducationalProgress.findUnique({
      where: { userId_moduleId: { userId, moduleId } },
      select: { status: true },
    });
    if (!progress || progress.status !== 'COMPLETED') {
      throw ApiError.badRequest('Complete the module before reviewing');
    }

    const review = await prisma.educationalReview.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      create: {
        userId,
        moduleId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
      update: { rating: dto.rating, comment: dto.comment ?? null },
    });

    // Recalculate average rating
    const agg = await prisma.educationalReview.aggregate({
      where: { moduleId },
      _avg: { rating: true },
    });
    await prisma.educationalModule.update({
      where: { id: moduleId },
      data: { averageRating: agg._avg.rating ?? 0 },
    });

    return {
      id: review.id,
      moduleId: review.moduleId,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment,
      helpful: review.helpful,
      createdAt: review.createdAt.toISOString(),
    };
  }
}

export const educationService = new EducationService();

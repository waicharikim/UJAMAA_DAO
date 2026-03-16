/**
 * @file src/modules/education/controllers/education.controller.ts
 * @description Education Controller — HTTP handlers.
 * Version: 1.0 — March 2026
 */

import type { Response } from 'express';
import { educationService } from '../services/education.service.js';
import { sendSuccess, sendCreated } from '../../../core/utils/response.js';
import type { AuthRequest } from '../../../core/types/Ujamaadao.types.js';

export class EducationController {
  static async listModules(req: AuthRequest, res: Response) {
    const { category, difficulty, limit, offset } = req.query as any;
    const result = await educationService.listModules({
      category,
      difficulty,
      limit,
      offset,
    });
    return sendSuccess(res, result, 'Modules retrieved');
  }

  static async getModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user?.userId;
    const result = await educationService.getModule(moduleId, userId);
    return sendSuccess(res, result, 'Module retrieved');
  }

  static async startModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.startModule(userId, moduleId);
    return sendCreated(res, result, 'Module started');
  }

  static async completeModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.completeModule(
      userId,
      moduleId,
      req.body
    );
    return sendSuccess(res, result, 'Module completed');
  }

  static async submitReview(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.submitReview(
      userId,
      moduleId,
      req.body
    );
    return sendCreated(res, result, 'Review submitted');
  }
}

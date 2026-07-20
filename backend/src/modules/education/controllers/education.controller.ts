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
    sendSuccess(res, result, 'Modules retrieved');
  }

  static async getModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user?.userId;
    const result = await educationService.getModule(moduleId, userId);
    sendSuccess(res, result, 'Module retrieved');
  }

  static async startModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.startModule(userId, moduleId);
    sendCreated(res, result, 'Module started');
  }

  static async completeModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.completeModule(
      userId,
      moduleId,
      req.body
    );
    sendSuccess(res, result, 'Module completed');
  }

  static async getMyProgress(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await educationService.getMyProgress(userId);
    sendSuccess(res, result, 'Progress retrieved');
  }

  static async submitReview(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.submitReview(
      userId,
      moduleId,
      req.body
    );
    sendCreated(res, result, 'Review submitted');
  }

  static async createModule(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await educationService.createModule(userId, req.body);
    sendCreated(res, result, 'Module draft created');
  }

  static async updateModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.updateModule(
      userId,
      moduleId,
      req.body
    );
    sendSuccess(res, result, 'Module updated');
  }

  static async submitModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    const result = await educationService.submitModule(userId, moduleId);
    sendSuccess(res, result, 'Module submitted for review');
  }

  static async deleteModule(req: AuthRequest, res: Response) {
    const { moduleId } = req.params;
    const userId = req.user!.userId;
    await educationService.deleteModule(userId, moduleId);
    sendSuccess(res, null, 'Module deleted');
  }

  static async getMyModules(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await educationService.getMyModules(userId);
    sendSuccess(res, result, 'My modules retrieved');
  }

  static async getAuthorshipEligibility(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await educationService.getAuthorshipEligibility(userId);
    sendSuccess(res, result, 'Eligibility retrieved');
  }
}

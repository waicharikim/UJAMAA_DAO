/**
 * @file src/modules/projects/controllers/project.controller.ts
 * @description
 * Project Controller
 * Version: 2.0 — December 2025
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { projectService } from '../services/project.service.js';

export class ProjectController {
  static async createFromProposal(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const project = await projectService.createFromProposal(userId, dto);
    sendSuccess(res, project, 'Project created');
  }

  static async startMilestone(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const result = await projectService.startMilestone(userId, dto);
    sendSuccess(res, result, 'Milestone started');
  }

  static async submitMilestone(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const result = await projectService.submitMilestone(userId, dto);
    sendSuccess(res, result, 'Milestone submitted');
  }

  static async verifyMilestone(req: AuthRequest, res: Response) {
    const verifierId = req.user!.userId;
    const dto = req.body;
    const result = await projectService.verifyMilestone(verifierId, dto);
    sendSuccess(res, result, 'Milestone verified');
  }
}

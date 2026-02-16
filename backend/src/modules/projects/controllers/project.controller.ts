/**
 * @file src/modules/projects/controllers/project.controller.ts
 * @description
 * Project Controller
 * Version: 2.0 — December 2025
 */

import { Request, Response } from "express";
import { sendSuccess } from "../../../core/utils/response.js";
import { projectService } from "../services/project.service.js";

export class ProjectController {
  static async createFromProposal(req: Request, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const project = await projectService.createFromProposal(userId, dto);
    sendSuccess(res, project, "Project created");
  }

  static async startMilestone(req: Request, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const result = await projectService.startMilestone(userId, dto);
    sendSuccess(res, result, "Milestone started");
  }

  static async submitMilestone(req: Request, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const result = await projectService.submitMilestone(userId, dto);
    sendSuccess(res, result, "Milestone submitted");
  }

  static async verifyMilestone(req: Request, res: Response) {
    const verifierId = req.user!.userId;
    const dto = req.body;
    const result = await projectService.verifyMilestone(verifierId, dto);
    sendSuccess(res, result, "Milestone verified");
  }
}
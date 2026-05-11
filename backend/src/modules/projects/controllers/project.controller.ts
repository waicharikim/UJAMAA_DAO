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
  static async listProjects(req: AuthRequest, res: Response) {
    const { ownerGroupId, ownerUserId, status, limit, offset } =
      req.query as Record<string, string | undefined>;
    const result = await projectService.listProjects({
      ownerGroupId,
      ownerUserId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    sendSuccess(res, result);
  }

  static async getProject(req: AuthRequest, res: Response) {
    const { projectId } = req.params;
    const result = await projectService.getProject(projectId);
    sendSuccess(res, result);
  }

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

  static async logWork(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await projectService.logWork(userId, req.body);
    sendSuccess(res, result, 'Work logged successfully', 201);
  }

  static async verifyWork(req: AuthRequest, res: Response) {
    const verifierId = req.user!.userId;
    const result = await projectService.verifyWork(verifierId, req.body);
    sendSuccess(res, result, 'Work verified');
  }

  static async listWorkLogs(req: AuthRequest, res: Response) {
    const { milestoneId } = req.params;
    const result = await projectService.listWorkLogs(milestoneId);
    sendSuccess(res, result, 'Work logs retrieved');
  }

  static async joinProject(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { projectId } = req.params;
    const result = await projectService.joinProject(userId, projectId);
    sendSuccess(res, result, 'Joined project', 201);
  }

  static async contribute(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { projectId } = req.params;
    const result = await projectService.contributeToProject(
      userId,
      projectId,
      req.body
    );
    sendSuccess(res, result, 'Contribution recorded', 201);
  }

  static async claimTask(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { taskId } = req.params;
    const result = await projectService.claimTask(userId, taskId);
    sendSuccess(res, result, 'Task claimed');
  }

  static async completeTask(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { taskId } = req.params;
    const result = await projectService.completeTask(userId, taskId);
    sendSuccess(res, result, 'Task completed');
  }

  // ── QR Work Sessions ──────────────────────────────────────────────────────

  static async createWorkSession(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await projectService.createWorkSession(userId, req.body);
    sendSuccess(res, result, 'Work session created', 201);
  }

  static async scanQr(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { qrSecret } = req.body;
    const result = await projectService.scanQr(userId, qrSecret);
    sendSuccess(res, result, 'Checked in successfully');
  }

  static async attestPresence(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { sessionId } = req.params;
    const { targetUserId } = req.body;
    const result = await projectService.attestPresence(
      userId,
      sessionId,
      targetUserId
    );
    sendSuccess(res, result, 'Presence attested', 201);
  }

  static async closeWorkSession(req: AuthRequest, res: Response) {
    const { sessionId } = req.params;
    const result = await projectService.closeWorkSession(sessionId);
    sendSuccess(res, result, 'Work session closed');
  }

  static async getWorkSession(req: AuthRequest, res: Response) {
    const { sessionId } = req.params;
    const result = await projectService.getWorkSession(sessionId);
    sendSuccess(res, result);
  }
}

/**
 * @file src/modules/emergency/controllers/emergency.controller.ts
 * @description
 * Emergency Controller
 * Version: 2.0 — December 2025
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { emergencyService } from '../services/emergency.service.js';

export class EmergencyController {
  static async reportEmergency(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const alert = await emergencyService.reportEmergency(userId, req.body);
    sendSuccess(
      res,
      alert,
      'Emergency reported — help is being coordinated',
      201
    );
  }

  static async respondToEmergency(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { alertId } = req.params;
    const response = await emergencyService.respondToEmergency(
      userId,
      alertId,
      req.body
    );
    sendSuccess(res, response, 'Response recorded');
  }

  static async listAlerts(req: AuthRequest, res: Response) {
    const result = await emergencyService.listAlerts(req.query as any);
    sendSuccess(res, result, 'Emergency alerts retrieved');
  }

  static async getAlert(req: AuthRequest, res: Response) {
    const { alertId } = req.params;
    const alert = await emergencyService.getAlert(alertId);
    sendSuccess(res, alert, 'Emergency alert details');
  }

  static async updateAlertStatus(req: AuthRequest, res: Response) {
    const actorId = req.user!.userId;
    const { alertId } = req.params;
    const { status, statusNote } = req.body as {
      status: 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_ALARM';
      statusNote?: string;
    };
    const alert = await emergencyService.updateAlertStatus(
      actorId,
      alertId,
      status,
      statusNote
    );
    sendSuccess(res, alert, 'Alert status updated');
  }
}

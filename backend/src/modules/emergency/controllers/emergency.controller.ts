/**
 * @file src/modules/emergency/controllers/emergency.controller.ts
 * @description
 * Emergency Controller
 * Version: 2.0 — December 2025
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { emergencyService } from "../services/emergency.service.js";

export class EmergencyController {
  static async reportEmergency(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const alert = await emergencyService.reportEmergency(userId, dto);
    sendSuccess(res, alert, "Emergency reported — help is being coordinated");
  }

  static async respondToEmergency(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { alertId } = req.params;
    const { message } = req.body;
    const response = await emergencyService.respondToEmergency(userId, alertId, message);
    sendSuccess(res, response, "Response recorded");
  }
}
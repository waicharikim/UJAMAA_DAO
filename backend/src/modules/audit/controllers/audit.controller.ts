/**
 * @file src/modules/audit/controllers/audit.controller.ts
 * @description
 * Audit Controller
 * Version: 2.0 — December 2025
 */

import { Request, Response } from "express";
import { sendSuccess } from "../../../core/utils/response.js";
import { auditService } from "../services/audit.service.js";

export class AuditController {
  static async searchLogs(req: Request, res: Response) {
    const adminId = req.user!.userId;
    const dto = req.query as any;
    const result = await auditService.searchLogs(adminId, dto);
    sendSuccess(res, result, "Audit logs retrieved");
  }
}
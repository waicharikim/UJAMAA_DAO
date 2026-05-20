/**
 * @file src/modules/audit/controllers/audit.controller.ts
 * @description
 * Audit Controller
 * Version: 2.0 — December 2025
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { auditService } from '../services/audit.service.js';

export class AuditController {
  static async searchLogs(req: AuthRequest, res: Response) {
    const adminId = req.user!.userId;
    const callerRoles = req.user!.roles ?? [];
    const primaryWardId = req.user!.primaryWardId;
    const dto = req.query as any;
    const result = await auditService.searchLogs(
      adminId,
      dto,
      callerRoles,
      primaryWardId
    );
    sendSuccess(res, result, 'Audit logs retrieved');
  }
}

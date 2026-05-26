/**
 * @file src/modules/admin/handlers/admin.handlers.ts
 * @description
 * Admin Handlers — HTTP layer for administrative actions
 *
 * All handlers assume:
 * - Input is already validated by Zod (via validateRequest middleware)
 * - User is authenticated & authorized (via authenticate + authorize middleware)
 * - req.user is available
 *
 * Version: 1.0 — February 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { adminService } from '../services/admin.service.js';
import { sendSuccess } from '../../../core/utils/response.js';

// ============================================================================
// COMMUNITY VERIFICATION ADMIN HANDLERS
// ============================================================================

/**
 * PATCH /admin/verification/community/approve
 * Approve, reject or request more info on community verification
 */
export async function reviewCommunityVerification(
  req: AuthRequest,
  res: Response
) {
  const adminId = req.user!.userId;
  const dto = req.body;

  const result = await adminService.reviewCommunityVerification(
    adminId,
    dto.requestId,
    dto.approved,
    dto.reason
  );

  sendSuccess(res, result, 'Community verification reviewed successfully', 200);
}

/**
 * GET /admin/verification/community/pending
 * List pending community verification requests
 */
export async function getPendingVerifications(req: AuthRequest, res: Response) {
  const { page = 1, pageSize = 20, status, wardId } = req.query;

  const result = await adminService.getPendingVerifications(
    Number(page),
    Number(pageSize),
    status as string | undefined,
    wardId as string | undefined
  );

  sendSuccess(res, result, 'Pending verifications retrieved', 200);
}

// ============================================================================
// RESIDENCE CHANGE ADMIN HANDLERS
// ============================================================================

/**
 * POST /admin/residence/approve
 * Approve or reject residence change request
 */
export async function reviewResidenceChange(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const dto = req.body;

  const result = await adminService.reviewResidenceChange(
    adminId,
    dto.requestId,
    dto.approved,
    dto.reason
  );

  sendSuccess(res, result, 'Residence change request reviewed', 200);
}

/**
 * GET /admin/residence/pending
 * List pending residence change requests
 */
export async function getPendingResidenceChanges(
  req: AuthRequest,
  res: Response
) {
  const { page = 1, pageSize = 20 } = req.query;

  const result = await adminService.getPendingResidenceChanges(
    Number(page),
    Number(pageSize)
  );

  sendSuccess(res, result, 'Pending residence changes retrieved', 200);
}

// ============================================================================
// PARTICIPATION RIGHTS (PR) ADJUSTMENT
// ============================================================================

/**
 * POST /admin/pr/adjust
 * Manually adjust user's Participation Rights
 */
export async function adjustParticipationRights(
  req: AuthRequest,
  res: Response
) {
  const adminId = req.user!.userId;
  const dto = req.body;

  const result = await adminService.adjustParticipationRights(
    adminId,
    dto.userId,
    dto.amount,
    dto.type,
    dto.reason
  );

  sendSuccess(res, result, 'Participation Rights adjusted successfully', 200);
}

// ============================================================================
// USER SUSPENSION / BAN
// ============================================================================

/**
 * POST /admin/users/:userId/ban
 * Ban or suspend a user
 */
export async function suspendUser(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const { userId } = req.params;
  const { banned, reason, durationDays } = req.body;

  const result = await adminService.suspendUser(
    adminId,
    userId,
    banned,
    reason,
    durationDays
  );

  sendSuccess(
    res,
    result,
    `User ${banned ? 'suspended' : 'unsuspended'} successfully`,
    200
  );
}

// ============================================================================
// SECURITY EVENT RESOLUTION
// ============================================================================

/**
 * PATCH /admin/security-events/:eventId/resolve
 * Resolve a security event
 */
export async function resolveSecurityEvent(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const { eventId } = req.params;
  const dto = req.body;

  const result = await adminService.resolveSecurityEvent(
    adminId,
    eventId,
    dto.resolved,
    dto.resolutionNotes,
    dto.actionTaken
  );

  sendSuccess(res, result, 'Security event resolved', 200);
}

/**
 * GET /admin/users/:userId/security-events
 * Admin view of a user's security events
 */
export async function getUserSecurityEventsAdmin(
  req: AuthRequest,
  res: Response
) {
  const adminId = req.user!.userId;
  const { userId } = req.params;

  // Optional: add pagination later
  const events = await adminService.getUserSecurityEvents(userId);

  sendSuccess(res, events, 'User security events retrieved (admin view)', 200);
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

/**
 * POST /admin/config/update
 * Update system configuration
 */
export async function updateSystemConfig(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const { key, value } = req.body;

  const result = await adminService.updateSystemConfig(adminId, key, value);

  sendSuccess(res, result, 'System configuration updated', 200);
}

export async function getStats(req: AuthRequest, res: Response) {
  const stats = await adminService.getStats();
  sendSuccess(res, stats, 'Stats retrieved');
}

export async function listUsers(req: AuthRequest, res: Response) {
  const { search, status, verificationLevel } = req.query as Record<
    string,
    string
  >;
  const limit = Math.min(
    parseInt((req.query.limit as string) || '20', 10),
    100
  );
  const offset = parseInt((req.query.offset as string) || '0', 10);
  const result = await adminService.listUsers({
    search,
    status,
    verificationLevel,
    limit,
    offset,
  });
  sendSuccess(res, result, 'Users retrieved');
}

export async function getSystemConfig(req: AuthRequest, res: Response) {
  const configs = await adminService.getConfig();
  sendSuccess(res, configs, 'Config retrieved');
}

// ============================================================================
// ROLE ASSIGNMENT
// ============================================================================

export async function assignRole(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const { userId } = req.params;
  const { role, scope } = req.body;
  await adminService.assignRole(adminId, userId, role, scope);
  sendSuccess(res, null, 'Role assigned successfully', 200);
}

export async function revokeRole(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const { userId, role } = req.params;
  await adminService.revokeRole(adminId, userId, decodeURIComponent(role));
  sendSuccess(res, null, 'Role revoked successfully', 200);
}

export async function listUserRoles(req: AuthRequest, res: Response) {
  const { userId } = req.params;
  const roles = await adminService.getUserRoles(userId);
  sendSuccess(res, roles, 'User roles retrieved');
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

export async function generateReport(req: AuthRequest, res: Response) {
  const { type } = req.params as { type: 'users' | 'governance' | 'economy' };
  const { fromDate, toDate, format } = req.query as {
    fromDate?: string;
    toDate?: string;
    format?: string;
  };

  const report = await adminService.generateReport(type, {
    fromDate: fromDate ? new Date(fromDate) : undefined,
    toDate: toDate ? new Date(toDate) : undefined,
  });

  if (format === 'csv') {
    const { columns, rows } = report;
    const csv = [
      columns.join(','),
      ...rows.map((row: Record<string, unknown>) =>
        columns.map((col: string) => JSON.stringify(row[col] ?? '')).join(',')
      ),
    ].join('\n');

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-${type}-${date}.csv"`
    );
    res.status(200).send(csv);
    return;
  }

  sendSuccess(res, report, `${type} report generated`);
}

// ============================================================================
// EDUCATION MODULE REVIEW HANDLERS
// ============================================================================

export async function listPendingModules(req: AuthRequest, res: Response) {
  const { limit, offset } = req.query as any;
  const result = await adminService.listPendingModules({
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  sendSuccess(res, result, 'Pending modules retrieved');
}

export async function adminCreateModule(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const result = await adminService.adminCreateModule(adminId, req.body);
  sendSuccess(res, result, 'Module created');
}

export async function approveModule(req: AuthRequest, res: Response) {
  const { moduleId } = req.params as { moduleId: string };
  const result = await adminService.approveModule(moduleId);
  sendSuccess(res, result, 'Module approved');
}

export async function rejectModule(req: AuthRequest, res: Response) {
  const { moduleId } = req.params as { moduleId: string };
  const { reason } = req.body as { reason: string };
  const result = await adminService.rejectModule(moduleId, reason);
  sendSuccess(res, result, 'Module rejected');
}

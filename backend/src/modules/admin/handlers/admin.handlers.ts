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

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { adminService } from "../services/admin.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { logger } from "../../../core/logger/logger.js";
import {
  communityVerificationReviewSchema,
  residenceChangeReviewSchema,
  prAdjustSchema,
  banUserSchema,
  resolveSecurityEventAdminSchema,
} from "../validators/admin.validators.js";

// ============================================================================
// COMMUNITY VERIFICATION ADMIN HANDLERS
// ============================================================================

/**
 * PATCH /admin/verification/community/approve
 * Approve, reject or request more info on community verification
 */
export async function reviewCommunityVerification(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const dto = req.body;

  const result = await adminService.reviewCommunityVerification(
    adminId,
    dto.requestId,
    dto.approved,
    dto.reason,
    dto.requestMoreInfo,
    dto.requestedFields
  );

  sendSuccess(res, result, "Community verification reviewed successfully", 200);
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

  sendSuccess(res, result, "Pending verifications retrieved", 200);
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

  sendSuccess(res, result, "Residence change request reviewed", 200);
}

/**
 * GET /admin/residence/pending
 * List pending residence change requests
 */
export async function getPendingResidenceChanges(req: AuthRequest, res: Response) {
  const { page = 1, pageSize = 20 } = req.query;

  const result = await adminService.getPendingResidenceChanges(
    Number(page),
    Number(pageSize)
  );

  sendSuccess(res, result, "Pending residence changes retrieved", 200);
}

// ============================================================================
// PARTICIPATION RIGHTS (PR) ADJUSTMENT
// ============================================================================

/**
 * POST /admin/pr/adjust
 * Manually adjust user's Participation Rights
 */
export async function adjustParticipationRights(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const dto = req.body;

  const result = await adminService.adjustParticipationRights(
    adminId,
    dto.userId,
    dto.amount,
    dto.type,
    dto.reason
  );

  sendSuccess(res, result, "Participation Rights adjusted successfully", 200);
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

  sendSuccess(res, result, `User ${banned ? "suspended" : "unsuspended"} successfully`, 200);
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

  sendSuccess(res, result, "Security event resolved", 200);
}

/**
 * GET /admin/users/:userId/security-events
 * Admin view of a user's security events
 */
export async function getUserSecurityEventsAdmin(req: AuthRequest, res: Response) {
  const adminId = req.user!.userId;
  const { userId } = req.params;

  // Optional: add pagination later
  const events = await adminService.getUserSecurityEvents(userId);

  sendSuccess(res, events, "User security events retrieved (admin view)", 200);
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

  sendSuccess(res, result, "System configuration updated", 200);
}
/**
 * @file src/modules/admin/services/admin.service.ts
 * @description
 * Admin Service — Core administrative actions
 *
 * Handles:
 * - Residence change approval/rejection
 * - Community verification review (approve/reject/more info)
 * - Manual Participation Rights (PR) adjustment
 * - User suspension/ban
 * - Pending request queries (verifications & residence changes)
 * - System configuration updates
 * - Milestone verification override
 *
 * Version: 2.1 — February 2026
 * Updated: Added full set of admin actions, transactions, granular logging
 */

import { prisma } from "../../../core/database/client.js";
import { participationRightsService } from "../../economy/services/participationRights.service.js";
import { groupMembershipService } from "../../community/services/groupMembership.service.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { userService } from "../../user/services/user.service.js";

class AdminService {
  // ============================================================================
  // RESIDENCE CHANGE MANAGEMENT
  // ============================================================================

  /**
   * Approve or reject a residence change request
   */
  async reviewResidenceChange(
    adminId: string,
    requestId: string,
    approved: boolean,
    reason?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.residenceChangeRequest.findUnique({
        where: { id: requestId },
        include: { user: true },
      });

      if (!request) throw ApiError.notFound("Residence change request");
      if (request.status !== "PENDING") throw ApiError.badRequest("Request already processed");

      const newStatus = approved ? "APPROVED" : "REJECTED";

      await tx.residenceChangeRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          reviewedById: adminId,
          reviewedAt: new Date(),
          reviewReason: reason,
        },
      });

      if (approved) {
        // Update user's primary residence
        await tx.user.update({
          where: { id: request.userId },
          data: {
            primaryWardId: request.newPrimaryWardId,
            lastResidenceChangeAt: new Date(),
          },
        });

        // Sync group memberships
        await groupMembershipService.updatePrimaryResidence(
          request.userId,
          request.newPrimaryWardId,
          request.oldWardId || undefined
        );
      }

      logger.info(
        { operationType: "ADMIN_RESIDENCE", adminId, requestId, approved, reason },
        `Residence change request ${newStatus.toLowerCase()}`
      );

      return { status: newStatus };
    });
  }

  // ============================================================================
  // COMMUNITY VERIFICATION REVIEW
  // ============================================================================

  /**
   * Review community verification request (approve, reject, or request more info)
   */
  async reviewCommunityVerification(
    adminId: string,
    requestId: string,
    approved: boolean,
    reason?: string,
    requestMoreInfo: boolean = false,
    requestedFields?: string[]
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.verificationRequest.findUnique({
        where: { id: requestId },
        include: { user: true },
      });

      if (!request) throw ApiError.notFound("Verification request");

      if (!["PENDING", "VOUCHING_COMPLETED", "PAYMENT_PENDING", "ADMIN_REVIEW"].includes(request.status)) {
        throw ApiError.badRequest("Request not in reviewable state");
      }

      const newStatus = approved
        ? "APPROVED"
        : requestMoreInfo
        ? "MORE_INFO_NEEDED"
        : "REJECTED";

      await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: approved ? null : reason,
          requestedMoreInfo: requestMoreInfo,
          requestedFields: requestedFields || null,
        },
      });

      if (approved) {
        await userService.completeCommunityVerification(request.userId);
      }

      logger.info(
        {
          operationType: "ADMIN_VERIFICATION",
          adminId,
          requestId,
          status: newStatus,
          reason,
          requestMoreInfo,
        },
        `Community verification request ${newStatus.toLowerCase()}`
      );

      return { status: newStatus };
    });
  }

  // ============================================================================
  // PARTICIPATION RIGHTS MANUAL ADJUSTMENT
  // ============================================================================

  /**
   * Manually adjust a user's Participation Rights (add or deduct)
   */
  async adjustParticipationRights(
    adminId: string,
    userId: string,
    amount: number,
    type: "ADD" | "DEDUCT",
    reason: string
  ) {
    if (amount <= 0) throw ApiError.badRequest("Amount must be positive");

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw ApiError.notFound("User");

      const adjustment = type === "ADD" ? amount : -amount;
      const newPR = Math.max(0, user.participationRights + adjustment);

      await tx.user.update({
        where: { id: userId },
        data: { participationRights: newPR },
      });

      await tx.participationRightsLog.create({
        data: {
          userId,
          amount: adjustment,
          balance: newPR,
          reason: `ADMIN_ADJUST_${type}`,
          metadata: { adminId, reason, originalBalance: user.participationRights },
        },
      });

      logger.info(
        {
          operationType: "ADMIN_PR_ADJUST",
          adminId,
          userId,
          amount,
          type,
          reason,
          newBalance: newPR,
        },
        `Participation Rights ${type === "ADD" ? "increased" : "decreased"}`
      );

      return { previous: user.participationRights, new: newPR };
    });
  }

  // ============================================================================
  // USER SUSPENSION / BAN
  // ============================================================================

  /**
   * Suspend or ban a user
   */
  async suspendUser(
    adminId: string,
    userId: string,
    suspend: boolean,
    reason: string,
    durationDays?: number
  ) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw ApiError.notFound("User");

      const suspendedUntil = durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      await tx.user.update({
        where: { id: userId },
        data: {
          isSuspended: suspend,
          suspendedUntil,
          suspensionReason: reason,
          suspendedById: adminId,
          suspendedAt: suspend ? new Date() : null,
        },
      });

      if (suspend) {
        // Force logout all active sessions
        await tx.session.updateMany({
          where: { userId, revoked: false },
          data: {
            revoked: true,
            revokedAt: new Date(),
            revokedBy: "ADMIN_SUSPEND",
          },
        });
      }

      logger.info(
        {
          operationType: "ADMIN_USER_SUSPEND",
          adminId,
          userId,
          suspended: suspend,
          durationDays,
          reason,
        },
        `User ${suspend ? "suspended" : "unsuspended"}`
      );

      return { suspended: suspend, suspendedUntil };
    });
  }

  // ============================================================================
  // PENDING REQUEST QUERIES
  // ============================================================================

  /**
   * Get paginated list of pending community verification requests
   */
  async getPendingVerifications(
    page: number = 1,
    pageSize: number = 20,
    status?: string,
    wardId?: string
  ) {
    const skip = (page - 1) * pageSize;

    const where = {
      status: status || { in: ["PENDING", "VOUCHING_COMPLETED", "PAYMENT_PENDING", "ADMIN_REVIEW"] },
      ...(wardId && { wardId }),
    };

    const [requests, total] = await Promise.all([
      prisma.verificationRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              primaryWardId: true,
            },
          },
        },
      }),
      prisma.verificationRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get paginated list of pending residence change requests
   */
  async getPendingResidenceChanges(page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [requests, total] = await Promise.all([
      prisma.residenceChangeRequest.findMany({
        where: { status: "PENDING" },
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              primaryWardId: true,
              phoneNumber: true,
            },
          },
        },
      }),
      prisma.residenceChangeRequest.count({ where: { status: "PENDING" } }),
    ]);

    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ============================================================================
  // SYSTEM CONFIGURATION
  // ============================================================================

  /**
   * Update system-wide configuration
   */
  async updateSystemConfig(adminId: string, key: string, value: string) {
    const config = await prisma.systemConfiguration.upsert({
      where: { configKey: key },
      update: { configValue: value, updatedById: adminId },
      create: { configKey: key, configValue: value, updatedById: adminId },
    });

    logger.info(
      { operationType: "ADMIN_CONFIG", adminId, key, value },
      "System configuration updated"
    );

    return config;
  }
}

export const adminService = new AdminService();
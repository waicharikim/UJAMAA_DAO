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

import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import { groupMembershipService } from '../../community/services/groupMembership.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { userService } from '../../user/services/user.service.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import { isValidSystemRole } from '../../../core/rbac/roles.js';
import { notificationService } from '../../notifications/services/notification.service.js';
import { NotificationType } from '../../notifications/types.js';

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
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.residenceChangeRequest.findUnique({
        where: { id: requestId },
        include: { user: true },
      });

      if (!request) throw ApiError.notFound('Residence change request');
      if (request.status !== 'PENDING')
        throw ApiError.badRequest('Request already processed');

      const newStatus = approved ? 'APPROVED' : 'REJECTED';

      await tx.residenceChangeRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: approved ? null : reason,
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
        await groupMembershipService.updateResidenceGroups(
          request.userId,
          request.newPrimaryWardId
        );
      }

      logger.info(
        {
          operationType: 'ADMIN_RESIDENCE',
          adminId,
          requestId,
          approved,
          reason,
        },
        `Residence change request ${newStatus.toLowerCase()}`
      );

      if (approved) {
        await auditService.log(
          adminId,
          AuditAction.RESIDENCE_CHANGE_APPROVED,
          'ResidenceChangeRequest',
          requestId,
          { userId: request.userId }
        );
      }

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
    reason?: string
  ) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.verificationRequest.findUnique({
        where: { id: requestId },
        include: { user: true },
      });

      if (!request) throw ApiError.notFound('Verification request');

      if (
        ![
          'PENDING',
          'VOUCHING_COMPLETED',
          'PAYMENT_PENDING',
          'ADMIN_REVIEW',
        ].includes(request.status)
      ) {
        throw ApiError.badRequest('Request not in reviewable state');
      }

      const newStatus = approved ? 'APPROVED' : 'REJECTED';

      await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: approved ? null : reason,
        },
      });

      if (approved) {
        await userService.completeCommunityVerification(request.userId);
      }

      logger.info(
        {
          operationType: 'ADMIN_VERIFICATION',
          adminId,
          requestId,
          status: newStatus,
          reason,
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
    type: 'ADD' | 'DEDUCT',
    reason: string
  ) {
    if (amount <= 0) throw ApiError.badRequest('Amount must be positive');

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw ApiError.notFound('User');

      const adjustment = type === 'ADD' ? amount : -amount;
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
          metadata: {
            adminId,
            reason,
            originalBalance: user.participationRights,
          },
        },
      });

      logger.info(
        {
          operationType: 'ADMIN_PR_ADJUST',
          adminId,
          userId,
          amount,
          type,
          reason,
          newBalance: newPR,
        },
        `Participation Rights ${type === 'ADD' ? 'increased' : 'decreased'}`
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
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw ApiError.notFound('User');

      const suspendedUntil = durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      await tx.user.update({
        where: { id: userId },
        data: {
          status: suspend ? 'SUSPENDED' : 'ACTIVE',
        },
      });

      if (suspend) {
        // Force logout all active sessions
        await tx.session.updateMany({
          where: { userId, revoked: false },
          data: { revoked: true },
        });
      }

      logger.info(
        {
          operationType: 'ADMIN_USER_SUSPEND',
          adminId,
          userId,
          suspended: suspend,
          durationDays,
          reason,
        },
        `User ${suspend ? 'suspended' : 'unsuspended'}`
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
      status: status || {
        in: [
          'PENDING',
          'VOUCHING_COMPLETED',
          'PAYMENT_PENDING',
          'ADMIN_REVIEW',
        ],
      },
      ...(wardId && { wardId }),
    };

    const [requests, total] = await Promise.all([
      prisma.verificationRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
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
        where: { status: 'PENDING' },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
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
      prisma.residenceChangeRequest.count({ where: { status: 'PENDING' } }),
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
      where: { key },
      update: { value, updatedBy: adminId },
      create: {
        key,
        value,
        updatedBy: adminId,
        category: 'general',
        dataType: 'string',
      },
    });

    logger.info(
      { operationType: 'ADMIN_CONFIG', adminId, key, value },
      'System configuration updated'
    );

    return config;
  }

  // ============================================================================
  // SECURITY EVENTS (ADMIN VIEW)
  // ============================================================================

  async resolveSecurityEvent(
    adminId: string,
    eventId: string,
    resolved: boolean,
    resolutionNotes?: string,
    _actionTaken?: string
  ) {
    const event = await prisma.securityEvent.update({
      where: { id: eventId },
      data: {
        resolved,
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? adminId : null,
        resolutionNotes: resolutionNotes || null,
      },
    });

    logger.info(
      { operationType: 'ADMIN_SECURITY', adminId, eventId, resolved },
      'Security event resolved'
    );

    return event;
  }

  async getUserSecurityEvents(userId: string) {
    return prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================================================
  // PLATFORM STATS
  // ============================================================================

  async getStats() {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      byVerification,
      activeProposals,
      pendingVerifications,
      pendingResidenceChanges,
      prAggregate,
      utAggregate,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.groupBy({ by: ['verificationLevel'], _count: { id: true } }),
      prisma.proposal.count({ where: { status: 'VOTING' } }),
      prisma.verificationRequest.count({
        where: {
          status: {
            in: [
              'PENDING',
              'ADMIN_REVIEW',
              'VOUCHING_COMPLETED',
              'PAYMENT_PENDING',
            ],
          },
        },
      }),
      prisma.residenceChangeRequest.count({ where: { status: 'PENDING' } }),
      prisma.user.aggregate({ _sum: { participationRights: true } }),
      prisma.user.aggregate({
        _sum: { fiatBackedUtBalance: true, earnedUtBalance: true },
      }),
    ]);

    const verificationBreakdown: Record<string, number> = {};
    for (const v of byVerification) {
      verificationBreakdown[v.verificationLevel] = v._count.id;
    }

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        byVerification: verificationBreakdown,
      },
      governance: { activeProposals },
      pendingActions: {
        verifications: pendingVerifications,
        residenceChanges: pendingResidenceChanges,
        total: pendingVerifications + pendingResidenceChanges,
      },
      economy: {
        totalParticipationRights: prAggregate._sum.participationRights ?? 0,
        totalUtilityTokens:
          (utAggregate._sum.fiatBackedUtBalance ?? 0) +
          (utAggregate._sum.earnedUtBalance ?? 0),
      },
    };
  }

  // ============================================================================
  // USER LIST (ADMIN)
  // ============================================================================

  async listUsers(params: {
    search?: string;
    status?: string;
    verificationLevel?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      search,
      status,
      verificationLevel,
      limit = 20,
      offset = 0,
    } = params;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (verificationLevel) where.verificationLevel = verificationLevel;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          primaryWard: {
            select: {
              name: true,
              constituency: {
                select: {
                  name: true,
                  county: { select: { name: true } },
                },
              },
            },
          },
          userRoles: {
            where: { active: true },
            include: { role: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        verificationLevel: u.verificationLevel,
        roles: u.userRoles.map((ur) => ur.role.name),
        county: u.primaryWard?.constituency?.county?.name ?? null,
        constituency: u.primaryWard?.constituency?.name ?? null,
        participationRights: u.participationRights,
        globalImpactPoints: u.globalImpactPoints,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      total,
      limit,
      offset,
    };
  }

  // ============================================================================
  // SYSTEM CONFIG READ
  // ============================================================================

  async getConfig() {
    return prisma.systemConfiguration.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  // ============================================================================
  // ROLE ASSIGNMENT (SUPER_ADMIN only)
  // ============================================================================

  async assignRole(
    adminId: string,
    userId: string,
    role: string,
    scope?: string
  ): Promise<void> {
    if (!isValidSystemRole(role)) {
      throw ApiError.badRequest(`Unknown role: ${role}`);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User');

    const roleRecord = await prisma.role.upsert({
      where: { name: role },
      create: { name: role, description: role },
      update: {},
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: roleRecord.id } },
      create: {
        userId,
        roleId: roleRecord.id,
        active: true,
        grantedBy: adminId,
      },
      update: { active: true },
    });

    await auditService.log(adminId, AuditAction.ROLE_ASSIGNED, 'User', userId, {
      role,
      scope,
    });

    await notificationService
      .send({
        userId,
        type: NotificationType.GENERAL_ANNOUNCEMENT,
        title: 'Role assigned',
        message: `You have been assigned the role: ${role}`,
        data: { role, scope },
      })
      .catch(() => {
        /* non-critical */
      });

    logger.info(
      { operationType: 'ADMIN_ROLE_ASSIGN', adminId, userId, role, scope },
      'Role assigned'
    );
  }

  async revokeRole(
    adminId: string,
    userId: string,
    role: string
  ): Promise<void> {
    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRecord) throw ApiError.notFound('Role');

    const userRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: roleRecord.id } },
    });
    if (!userRole || !userRole.active) {
      throw ApiError.badRequest('User does not have this role');
    }

    await prisma.userRole.update({
      where: { userId_roleId: { userId, roleId: roleRecord.id } },
      data: { active: false },
    });

    await auditService.log(adminId, AuditAction.ROLE_REVOKED, 'User', userId, {
      role,
    });

    await notificationService
      .send({
        userId,
        type: NotificationType.GENERAL_ANNOUNCEMENT,
        title: 'Role removed',
        message: `The role "${role}" has been removed from your account`,
        data: { role },
      })
      .catch(() => {
        /* non-critical */
      });

    logger.info(
      { operationType: 'ADMIN_ROLE_REVOKE', adminId, userId, role },
      'Role revoked'
    );
  }

  async getUserRoles(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User');

    const userRoles = await prisma.userRole.findMany({
      where: { userId, active: true },
      include: { role: { select: { name: true, description: true } } },
    });

    return userRoles.map((ur) => ({
      role: ur.role.name,
      description: ur.role.description,
      grantedBy: ur.grantedBy,
    }));
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  async generateReport(
    type: 'users' | 'governance' | 'economy',
    params: { fromDate?: Date; toDate?: Date }
  ) {
    const { fromDate, toDate } = params;
    const dateFilter =
      fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {};

    if (type === 'users') {
      const [byVerification, registrationsRaw, suspendedCount] =
        await Promise.all([
          prisma.user.groupBy({
            by: ['verificationLevel'],
            _count: { id: true },
            where: dateFilter,
          }),
          prisma.user.findMany({
            where: dateFilter,
            select: { createdAt: true },
          }),
          prisma.user.count({ where: { status: 'SUSPENDED', ...dateFilter } }),
        ]);

      // Group registrations by ISO week
      const weekMap: Record<string, number> = {};
      for (const u of registrationsRaw) {
        const d = u.createdAt;
        const yearWeek = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + new Date(d.getFullYear(), 0, 1).getDay()) / 7)).padStart(2, '0')}`;
        weekMap[yearWeek] = (weekMap[yearWeek] || 0) + 1;
      }

      const columns = ['verificationLevel', 'count'];
      const rows = byVerification.map((r) => ({
        verificationLevel: r.verificationLevel,
        count: r._count.id,
      }));

      return {
        title: 'User Activity Report',
        generatedAt: new Date().toISOString(),
        columns,
        rows,
        summary: {
          registrationsPerWeek: weekMap,
          suspendedCount,
          totalRegistrations: registrationsRaw.length,
        },
      };
    }

    if (type === 'governance') {
      const [byStatus, totalVotes] = await Promise.all([
        prisma.proposal.groupBy({
          by: ['status'],
          _count: { id: true },
          where: dateFilter,
        }),
        prisma.groupMemberVote.count({ where: dateFilter }),
      ]);

      const statusMap: Record<string, number> = {};
      for (const r of byStatus) statusMap[r.status] = r._count.id;

      const approved = statusMap['APPROVED'] || 0;
      const rejected = statusMap['REJECTED'] || 0;
      const total = approved + rejected;
      const passRate =
        total > 0 ? ((approved / total) * 100).toFixed(1) + '%' : 'N/A';

      const columns = ['status', 'count'];
      const rows = byStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
      }));

      return {
        title: 'Governance Report',
        generatedAt: new Date().toISOString(),
        columns,
        rows,
        summary: {
          totalVotesCast: totalVotes,
          passRate,
          approvedProposals: approved,
          rejectedProposals: rejected,
        },
      };
    }

    // economy
    const [prAwarded, prSpent, duesPaid, activeCommitments] = await Promise.all(
      [
        prisma.participationRightsLog.aggregate({
          _sum: { amount: true },
          where: { amount: { gt: 0 }, ...dateFilter },
        }),
        prisma.participationRightsLog.aggregate({
          _sum: { amount: true },
          where: { amount: { lt: 0 }, ...dateFilter },
        }),
        prisma.duesPayment.count({ where: dateFilter }),
        prisma.commitment.count({ where: { type: 'DUES', status: 'ACTIVE' } }),
      ]
    );

    const columns = ['metric', 'value'];
    const rows = [
      { metric: 'PR Awarded (total)', value: prAwarded._sum.amount ?? 0 },
      { metric: 'PR Spent (total)', value: Math.abs(prSpent._sum.amount ?? 0) },
      { metric: 'Dues Payments', value: duesPaid },
      { metric: 'Active Commitments', value: activeCommitments },
    ];

    return {
      title: 'Economy Report',
      generatedAt: new Date().toISOString(),
      columns,
      rows,
    };
  }
  // ============================================================================
  // PLATFORM CONFIG
  // ============================================================================

  async getAllPlatformConfig() {
    return prisma.platformConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async upsertPlatformConfig(key: string, value: string, adminId: string) {
    const existing = await prisma.platformConfig.findUnique({ where: { key } });
    if (!existing) {
      throw new ApiError(`Config key "${key}" not found`, 404);
    }
    return prisma.platformConfig.update({
      where: { key },
      data: { value, updatedById: adminId },
    });
  }

  // ============================================================================
  // EDUCATION MODULE REVIEW
  // ============================================================================

  async listPendingModules(opts: { limit?: number; offset?: number }) {
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    const where = {
      verified: false,
      submittedAt: { not: null },
      rejectionReason: null,
    };
    const [modules, total] = await Promise.all([
      prisma.educationalModule.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          _count: { select: { progress: true, reviews: true } },
        },
        orderBy: { submittedAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.educationalModule.count({ where }),
    ]);
    return { modules, total, limit, offset };
  }

  async adminCreateModule(
    adminId: string,
    dto: {
      title: string;
      description: string;
      content: string;
      mediaUrls?: string[];
      duration: number;
      difficulty: string;
      category: string;
      completionIP?: number;
    }
  ) {
    return prisma.educationalModule.create({
      data: {
        title: dto.title,
        description: dto.description,
        content: dto.content,
        mediaUrls: dto.mediaUrls ?? [],
        duration: dto.duration,
        difficulty: dto.difficulty as any,
        category: dto.category,
        completionIP: dto.completionIP ?? 0,
        creatorId: adminId,
        verified: true,
        expertApproved: true,
        submittedAt: new Date(),
      },
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { progress: true, reviews: true } },
      },
    });
  }

  async approveModule(moduleId: string) {
    const module = await prisma.educationalModule.findUnique({
      where: { id: moduleId },
      select: { id: true, verified: true, submittedAt: true },
    });
    if (!module) throw new ApiError('Module not found', 404);
    if (module.verified) throw new ApiError('Module already approved', 400);
    if (!module.submittedAt)
      throw new ApiError('Module has not been submitted for review', 400);

    return prisma.educationalModule.update({
      where: { id: moduleId },
      data: { verified: true, expertApproved: true, rejectionReason: null },
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { progress: true, reviews: true } },
      },
    });
  }

  async rejectModule(moduleId: string, reason: string) {
    const module = await prisma.educationalModule.findUnique({
      where: { id: moduleId },
      select: { id: true, verified: true, submittedAt: true },
    });
    if (!module) throw new ApiError('Module not found', 404);
    if (module.verified) throw new ApiError('Module already approved', 400);
    if (!module.submittedAt)
      throw new ApiError('Module has not been submitted for review', 400);

    return prisma.educationalModule.update({
      where: { id: moduleId },
      data: { rejectionReason: reason, submittedAt: null },
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { progress: true, reviews: true } },
      },
    });
  }
}

export const adminService = new AdminService();

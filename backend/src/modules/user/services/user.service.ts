/**
 * @file src/modules/user/services/user.service.ts
 * @description
 * User Service — Profile Management & Cleanup
 *
 * Handles:
 * - Profile retrieval and update
 * - Industry & goods/services selection
 * - Residence change requests (cooldown + expiry)
 * - Temporary location management
 * - Privacy & accessibility settings
 * - Community verification flow (vouching + payment fallback)
 * - Periodic cleanups (expired temp locations, vouch timeouts, residence requests)
 *
 * Version: 2.2 — February 2026
 * Updated: Added full cleanup methods for BullMQ worker
 */

import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { eventBus } from '../../../core/utils/eventBus.js';
import { VerificationLevel } from '../../../core/types/Ujamaadao.types.js';
import {
  UpdateProfileDto,
  SelectIndustriesDto,
  SelectGoodsServicesDto,
  RequestResidenceChangeDto,
  VouchRequestDto,
  PaymentVerificationDto,
  UserProfileResponse,
  UserIndustryResponse,
  UserGoodsServiceResponse,
  ResidenceChangeRequestResponse,
  TemporaryLocationResponse,
  VerificationStatusResponse,
  CountyResponse,
  ConstituencyResponse,
  WardResponse,
  IndustryResponse,
  GoodsServiceResponse,
  WardMemberResponse,
} from '../user.types.js';

const RESIDENCE_CHANGE_COOLDOWN_MONTHS = 6;
const TEMPORARY_LOCATION_MAX_MONTHS = 6;
const VOUCH_THRESHOLD = 3;
const VOUCH_WINDOW_DAYS = 7;
const PAYMENT_AMOUNT_KES = 100;

const VERIFICATION_LEVEL_ORDER: VerificationLevel[] = [
  'UNVERIFIED',
  'EMAIL_VERIFIED',
  'PHONE_VERIFIED',
  'COMMUNITY_VERIFIED',
  'FULL_VERIFIED',
];

class UserService {
  /**
   * Get rich user profile with full impact breakdown
   */
  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        primaryWard: {
          select: {
            id: true,
            name: true,
            constituency: {
              select: {
                id: true,
                name: true,
                county: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        secondaryWard: { select: { id: true, name: true } },
        currentWard: { select: { id: true, name: true } },
        privacySettings: true,
        userIndustries: {
          include: { industry: { select: { id: true, name: true } } },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) throw ApiError.notFound('User', userId);

    // Mock impact data (replace with real services when ready)
    const impactBreakdown = { breakdown: [], totals: {} };
    const globalIP = user.globalImpactPoints || 0;
    const primaryImpactPoints = user.primaryWardId
      ? { ward: { points: 0, tier: 'BRONZE' } }
      : null;

    const primaryHierarchy = user.primaryWard
      ? {
          ward: { id: user.primaryWard.id, name: user.primaryWard.name },
          constituency: {
            id: user.primaryWard.constituency.id,
            name: user.primaryWard.constituency.name,
          },
          county: {
            id: user.primaryWard.constituency.county.id,
            name: user.primaryWard.constituency.county.name,
          },
        }
      : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl || null,
      walletAddress: user.walletAddress,

      geographic: {
        primaryWard: primaryHierarchy?.ward ?? null,
        primaryConstituency: primaryHierarchy?.constituency ?? null,
        primaryCounty: primaryHierarchy?.county ?? null,
        secondaryWard: user.secondaryWard
          ? { id: user.secondaryWard.id, name: user.secondaryWard.name }
          : null,
        currentLocation: user.currentLocationId
          ? {
              wardId: user.currentLocationId,
              wardName: user.currentWard?.name ?? null,
              until: user.currentLocationUntil,
            }
          : null,
      },

      verification: {
        level: user.verificationLevel,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        communityVerified: user.communityVerified,
      },

      impact: {
        global: globalIP,
        primary: primaryImpactPoints,
        allLocations: impactBreakdown.breakdown,
        totals: impactBreakdown.totals,
      },

      economic: {
        utilityTokens: user.utilityTokens,
        participationRights: user.participationRights,
      },

      industries: user.userIndustries.map((ui) => ({
        id: ui.industry.id,
        name: ui.industry.name,
        isPrimary: ui.isPrimary,
      })),

      metadata: {
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },

      _privacySettings: user.privacySettings
        ? {
            profileVisibility: user.privacySettings.profileVisibility,
            showEmail: user.privacySettings.showEmail,
            showPhone: user.privacySettings.showPhone,
            showWallet: user.privacySettings.showWallet,
            showImpactPoints: user.privacySettings.showImpactPoints,
          }
        : null,
    };
  }

  /**
   * Apply privacy filters to a profile when viewed by another user.
   * Returns a redacted copy — never mutates the original.
   */
  applyPrivacyFilters(
    profile: UserProfileResponse,
    privacySettings: {
      profileVisibility: string;
      showEmail: boolean;
      showPhone: boolean;
      showWallet: boolean;
      showImpactPoints: boolean;
    } | null
  ): UserProfileResponse {
    const settings = privacySettings ?? {
      profileVisibility: 'PUBLIC',
      showEmail: false,
      showPhone: false,
      showWallet: false,
      showImpactPoints: true,
    };

    // PRIVATE (or FRIENDS — friends system not yet built, treat same as PRIVATE)
    if (
      settings.profileVisibility === 'PRIVATE' ||
      settings.profileVisibility === 'FRIENDS'
    ) {
      return {
        id: profile.id,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        email: null,
        phoneNumber: null,
        walletAddress: null,
        geographic: {
          primaryWard: profile.geographic.primaryWard,
          primaryConstituency: null,
          primaryCounty: null,
          secondaryWard: null,
          currentLocation: null,
        },
        verification: {
          level: profile.verification.level,
          emailVerified: false,
          phoneVerified: false,
          communityVerified: profile.verification.communityVerified,
        },
        impact: { global: 0, primary: null, allLocations: [], totals: {} },
        economic: { utilityTokens: 0, participationRights: 0 },
        industries: profile.industries,
        metadata: { createdAt: profile.metadata.createdAt, lastLoginAt: null },
      };
    }

    // PUBLIC — apply per-field flags
    const { _privacySettings: _ps, ...rest } = profile;
    return {
      ...rest,
      email: settings.showEmail ? profile.email : null,
      phoneNumber: settings.showPhone ? profile.phoneNumber : null,
      walletAddress: settings.showWallet ? profile.walletAddress : null,
      impact: settings.showImpactPoints
        ? profile.impact
        : { global: 0, primary: null, allLocations: [], totals: {} },
    };
  }

  /**
   * Update user profile (name, avatar, privacy, accessibility)
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: any = {};

    if (dto.name) data.name = dto.name;
    if (dto.avatarUrl) data.avatarUrl = dto.avatarUrl;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (dto.privacySettings) {
        await tx.userPrivacySettings.upsert({
          where: { userId },
          update: dto.privacySettings,
          create: { userId, ...dto.privacySettings },
        });
      }

      if (dto.accessibility) {
        await tx.userAccessibility.upsert({
          where: { userId },
          update: dto.accessibility,
          create: { userId, ...dto.accessibility },
        });
      }

      if (Object.keys(data).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data,
        });
      }
    });

    logger.info(
      { operationType: 'USER_UPDATE', userId, updates: Object.keys(dto) },
      'User profile updated'
    );

    eventBus.publish('user.profile.updated', {
      userId,
      updates: Object.keys(dto),
    });

    return { success: true };
  }

  /**
   * Get user's selected industries
   */
  async getUserIndustries(userId: string): Promise<UserIndustryResponse[]> {
    const userIndustries = await prisma.userIndustry.findMany({
      where: { userId },
      include: { industry: true },
      orderBy: { isPrimary: 'desc' },
    });

    return userIndustries.map((ui) => ({
      id: ui.industry.id,
      name: ui.industry.name,
      isPrimary: ui.isPrimary,
    }));
  }

  /**
   * Select industries (max 3)
   */
  async selectIndustries(userId: string, dto: SelectIndustriesDto) {
    if (dto.industryIds.length > 3) {
      throw ApiError.badRequest('Maximum 3 industries allowed');
    }

    const industries = await prisma.industry.findMany({
      where: { id: { in: dto.industryIds } },
    });

    if (industries.length !== dto.industryIds.length) {
      throw ApiError.validationError('One or more industries are invalid');
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.userIndustry.deleteMany({ where: { userId } });

      await tx.userIndustry.createMany({
        data: dto.industryIds.map((industryId, index) => ({
          userId,
          industryId,
          isPrimary:
            dto.primaryIndustryId === industryId ||
            (index === 0 && !dto.primaryIndustryId),
        })),
      });
    });

    logger.info(
      {
        operationType: 'USER_INDUSTRIES',
        userId,
        count: dto.industryIds.length,
      },
      'User industries updated'
    );

    eventBus.publish('user.industries.updated', {
      userId,
      industryIds: dto.industryIds,
    });

    return { success: true };
  }

  /**
   * Get user's selected goods/services
   */
  async getUserGoodsServices(
    userId: string
  ): Promise<UserGoodsServiceResponse[]> {
    const userGoodsServices = await prisma.userGoodsService.findMany({
      where: { userId },
      include: { goodsService: true },
    });

    return userGoodsServices.map((ugs) => ({
      id: ugs.goodsService.id,
      name: ugs.goodsService.name,
      category: ugs.goodsService.category,
      canProvide: ugs.canProvide,
      canRequest: ugs.canRequest,
    }));
  }

  /**
   * Select goods/services
   */
  async selectGoodsServices(userId: string, dto: SelectGoodsServicesDto) {
    if (
      dto.goodsServiceIds.length !== dto.canProvide.length ||
      dto.goodsServiceIds.length !== dto.canRequest.length
    ) {
      throw ApiError.badRequest('Arrays must have same length');
    }

    const goodsServices = await prisma.goodsService.findMany({
      where: { id: { in: dto.goodsServiceIds }, active: true },
    });

    if (goodsServices.length !== dto.goodsServiceIds.length) {
      throw ApiError.validationError(
        'One or more goods/services are invalid or inactive'
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.userGoodsService.deleteMany({ where: { userId } });

      await tx.userGoodsService.createMany({
        data: dto.goodsServiceIds.map((goodsServiceId, index) => ({
          userId,
          goodsServiceId,
          canProvide: dto.canProvide[index],
          canRequest: dto.canRequest[index],
        })),
      });
    });

    logger.info(
      {
        operationType: 'USER_GOODS',
        userId,
        count: dto.goodsServiceIds.length,
      },
      'User goods/services updated'
    );

    eventBus.publish('user.goods_services.updated', {
      userId,
      count: dto.goodsServiceIds.length,
    });

    return { success: true };
  }

  /**
   * Get user's residence change requests
   */
  async getUserResidenceChangeRequests(
    userId: string
  ): Promise<ResidenceChangeRequestResponse[]> {
    const requests = await prisma.residenceChangeRequest.findMany({
      where: { userId },
      include: {
        newWard: { select: { id: true, name: true } },
        oldWard: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      status: req.status,
      newWardId: req.newPrimaryWardId,
      newWardName: req.newWard.name,
      oldWardId: req.oldWardId,
      oldWardName: req.oldWard?.name || null,
      reason: req.reason,
      proofUrl: req.proofUrl,
      reviewedBy: req.reviewedBy,
      reviewedAt: req.reviewedAt,
      rejectionReason: req.rejectionReason,
      expiresAt: req.expiresAt,
      createdAt: req.createdAt,
    }));
  }

  /**
   * Request residence change (cooldown + expiry)
   */
  async requestResidenceChange(userId: string, dto: RequestResidenceChangeDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastResidenceChangeAt: true, primaryWardId: true },
    });

    if (!user) throw ApiError.notFound('User');

    if (user.lastResidenceChangeAt) {
      const monthsSince =
        (Date.now() - user.lastResidenceChangeAt.getTime()) /
        (30 * 24 * 60 * 60 * 1000);
      if (monthsSince < RESIDENCE_CHANGE_COOLDOWN_MONTHS) {
        const remaining = Math.ceil(
          RESIDENCE_CHANGE_COOLDOWN_MONTHS - monthsSince
        );
        throw ApiError.forbidden(
          `Residence change on cooldown. ${remaining} month(s) remaining.`
        );
      }
    }

    const pending = await prisma.residenceChangeRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });

    if (pending)
      throw ApiError.conflict('Residence change request already pending');

    const newWard = await prisma.ward.findUnique({
      where: { id: dto.newPrimaryWardId },
    });

    if (!newWard) throw ApiError.notFound('Ward', dto.newPrimaryWardId);

    const request = await prisma.residenceChangeRequest.create({
      data: {
        userId,
        oldWardId: user.primaryWardId,
        newPrimaryWardId: dto.newPrimaryWardId,
        reason: dto.reason,
        proofUrl: dto.proofUrl || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(
      {
        operationType: 'USER_RESIDENCE_REQUEST',
        userId,
        requestId: request.id,
      },
      'Residence change requested'
    );

    eventBus.publish('user.residence_change.requested', {
      userId,
      requestId: request.id,
      newWardId: dto.newPrimaryWardId,
    });

    return request;
  }

  /**
   * Set temporary location
   */
  async setTemporaryLocation(
    userId: string,
    wardId: string,
    until: Date
  ): Promise<TemporaryLocationResponse> {
    if (isNaN(until.getTime()) || until <= new Date()) {
      throw ApiError.validationError(
        'Invalid expiry date — must be in the future'
      );
    }

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + TEMPORARY_LOCATION_MAX_MONTHS);
    if (until > maxDate) {
      throw ApiError.validationError(
        `Temporary location cannot exceed ${TEMPORARY_LOCATION_MAX_MONTHS} months`
      );
    }

    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) throw ApiError.notFound('Ward');

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        currentLocationId: wardId,
        currentLocationUntil: until,
      },
    });

    logger.info(
      {
        operationType: 'USER_TEMP_LOCATION',
        userId,
        wardId,
        until: until.toISOString(),
      },
      'Temporary location set'
    );

    eventBus.publish('user.temporary_location.set', { userId, wardId, until });

    return {
      currentLocationId: user.currentLocationId,
      currentLocationUntil: user.currentLocationUntil,
      wardName: ward.name,
    };
  }

  /**
   * Clear temporary location
   */
  async clearTemporaryLocation(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentLocationId: null,
        currentLocationUntil: null,
      },
    });

    logger.info(
      { operationType: 'USER_TEMP_LOCATION_CLEAR', userId },
      'Temporary location cleared'
    );

    eventBus.publish('user.temporary_location.cleared', { userId });

    return { success: true };
  }

  /**
   * Get privacy settings (create default if missing)
   */
  async getPrivacySettings(userId: string) {
    let settings = await prisma.userPrivacySettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userPrivacySettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  /**
   * Get accessibility settings (create default if missing)
   */
  async getAccessibilitySettings(userId: string) {
    let settings = await prisma.userAccessibility.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userAccessibility.create({
        data: { userId },
      });
    }

    return settings;
  }

  // ─────────────────────────────────────────────
  // VERIFICATION FLOW
  // ─────────────────────────────────────────────

  async requestCommunityVerification(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { verificationLevel: true },
    });

    if (!user) throw ApiError.notFound('User');
    if (user.verificationLevel !== 'PHONE_VERIFIED') {
      throw ApiError.insufficientVerification(
        'Complete phone verification first'
      );
    }

    const existing = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId, type: 'COMMUNITY' } },
    });

    if (
      existing &&
      ['PENDING', 'VOUCHING', 'PAYMENT_PENDING'].includes(existing.status)
    ) {
      throw ApiError.conflict('Verification request already in progress');
    }

    const request = await prisma.verificationRequest.create({
      data: {
        userId,
        type: 'COMMUNITY',
        status: 'VOUCHING',
        expiresAt: new Date(
          Date.now() + VOUCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
        ),
      },
    });

    logger.info(
      { operationType: 'VERIFICATION_REQUEST', userId, requestId: request.id },
      'Community verification requested'
    );

    eventBus.publish('user.verification.requested', {
      userId,
      type: 'COMMUNITY',
      requestId: request.id,
    });

    return {
      requestId: request.id,
      status: request.status,
      expiresAt: request.expiresAt,
      vouchesNeeded: VOUCH_THRESHOLD,
    };
  }

  async vouchForUser(voucherId: string, dto: VouchRequestDto) {
    const { targetUserId, wardId } = dto;

    const voucher = await prisma.user.findUnique({
      where: { id: voucherId },
      select: { verificationLevel: true, primaryWardId: true },
    });

    if (!voucher) throw ApiError.notFound('Voucher user');
    const voucherLevelIndex = VERIFICATION_LEVEL_ORDER.indexOf(
      voucher.verificationLevel as VerificationLevel
    );
    const communityLevelIndex = VERIFICATION_LEVEL_ORDER.indexOf('COMMUNITY_VERIFIED');
    if (voucherLevelIndex < communityLevelIndex) {
      throw ApiError.insufficientVerification(
        'Only community-verified users can vouch'
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { primaryWardId: true },
    });

    if (!target) throw ApiError.notFound('Target user');

    if (voucher.primaryWardId !== wardId || target.primaryWardId !== wardId) {
      throw ApiError.geographicError('Vouch must be in same ward');
    }

    const request = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId: targetUserId, type: 'COMMUNITY' } },
    });

    if (!request || request.status !== 'VOUCHING') {
      throw ApiError.conflict('No active vouching request');
    }

    try {
      await prisma.communityVouch.create({
        data: {
          userId: targetUserId,
          voucherId,
          wardId,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw ApiError.conflict('Already vouched for this user');
      throw e;
    }

    logger.info({ voucherId, targetUserId, wardId }, 'Vouch added');

    eventBus.publish('user.verification.vouch', {
      targetUserId,
      voucherId,
      wardId,
    });

    const vouchCount = await prisma.communityVouch.count({
      where: { userId: targetUserId },
    });

    if (vouchCount >= VOUCH_THRESHOLD) {
      await this.completeCommunityVerification(targetUserId);
    }

    return { success: true, vouchCount, needed: VOUCH_THRESHOLD };
  }

  async processVerificationPayment(
    userId: string,
    dto: PaymentVerificationDto
  ) {
    const { transactionId } = dto;

    const request = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId, type: 'COMMUNITY' } },
    });

    if (!request || request.status !== 'PAYMENT_PENDING') {
      throw ApiError.conflict('No active payment request');
    }

    const payment = await this.verifyMPesaPayment(transactionId);

    if (!payment || payment.amount < PAYMENT_AMOUNT_KES) {
      throw ApiError.validationError('Invalid or insufficient payment');
    }

    await this.completeCommunityVerification(userId);

    logger.info({ userId, transactionId }, 'Payment verification completed');

    return { success: true };
  }

  private async verifyMPesaPayment(
    transactionId: string
  ): Promise<{ amount: number } | null> {
    // TODO: Real M-Pesa Daraja API integration
    return { amount: PAYMENT_AMOUNT_KES };
  }

  async completeCommunityVerification(userId: string) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          verificationLevel: 'COMMUNITY_VERIFIED',
          communityVerified: true,
        },
      });

      await tx.verificationRequest.update({
        where: { userId_type: { userId, type: 'COMMUNITY' } },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });
    });

    logger.info({ userId }, 'Community verification completed');

    eventBus.publish('user.verification.completed', {
      userId,
      level: 'COMMUNITY_VERIFIED',
    });

    // Check if all four flags are now met → promote to FULL_VERIFIED
    await this.checkFullVerification(userId);
  }

  /**
   * Promote user to FULL_VERIFIED if all four criteria are met:
   * emailVerified + phoneVerified + communityVerified + walletAddress
   *
   * Safe to call after any of the four flags is set.
   */
  async checkFullVerification(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerified: true,
        phoneVerified: true,
        communityVerified: true,
        walletAddress: true,
        verificationLevel: true,
      },
    });

    if (!user) return;
    if (user.verificationLevel === 'FULL_VERIFIED') return;

    const allMet =
      user.emailVerified &&
      user.phoneVerified &&
      user.communityVerified &&
      !!user.walletAddress;

    if (!allMet) return;

    await prisma.user.update({
      where: { id: userId },
      data: { verificationLevel: 'FULL_VERIFIED' },
    });

    logger.info({ userId }, 'User promoted to FULL_VERIFIED');

    eventBus.publish('user.verification.completed', {
      userId,
      level: 'FULL_VERIFIED',
    });
  }

  async getVerificationStatus(
    userId: string
  ): Promise<VerificationStatusResponse> {
    const request = await prisma.verificationRequest.findUnique({
      where: { userId_type: { userId, type: 'COMMUNITY' } },
    });

    if (!request) {
      return {
        status: 'PENDING',
        vouchesReceived: 0,
        vouchesNeeded: VOUCH_THRESHOLD,
      };
    }

    const vouchesReceived = await prisma.communityVouch.count({
      where: { userId },
    });

    return {
      status: request.status as VerificationStatusResponse['status'],
      vouchesReceived,
      vouchesNeeded: VOUCH_THRESHOLD,
      expiresAt: request.expiresAt,
      rejectionReason: request.rejectionReason,
    };
  }

  // ─────────────────────────────────────────────
  // REFERENCE DATA
  // ─────────────────────────────────────────────

  async getCounties(): Promise<CountyResponse[]> {
    const counties = await prisma.county.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return counties;
  }

  async getConstituencies(countyId?: string): Promise<ConstituencyResponse[]> {
    const constituencies = await prisma.constituency.findMany({
      where: countyId ? { countyId } : undefined,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, countyId: true },
    });
    return constituencies;
  }

  async getWards(
    constituencyId?: string,
    countyId?: string
  ): Promise<WardResponse[]> {
    const wards = await prisma.ward.findMany({
      where: {
        ...(constituencyId ? { constituencyId } : {}),
        ...(countyId ? { countyId } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, constituencyId: true, countyId: true },
    });
    return wards;
  }

  async getIndustries(): Promise<IndustryResponse[]> {
    const industries = await prisma.industry.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return industries;
  }

  async getGoodsServices(industryId?: string): Promise<GoodsServiceResponse[]> {
    const goods = await prisma.goodsService.findMany({
      where: {
        ...(industryId ? { industryId } : {}),
        active: true,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, industryId: true, category: true },
    });
    return goods;
  }

  /**
   * Browse COMMUNITY_VERIFIED users in a ward for the vouching flow.
   * Excludes the requesting user and already-deactivated accounts.
   */
  async getWardMembers(
    wardId: string,
    requesterId: string
  ): Promise<WardMemberResponse[]> {
    const members = await prisma.user.findMany({
      where: {
        primaryWardId: wardId,
        id: { not: requesterId },
        status: 'ACTIVE',
        verificationLevel: {
          in: ['COMMUNITY_VERIFIED', 'FULL_VERIFIED'],
        },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        verificationLevel: true,
        primaryWardId: true,
      },
      orderBy: { name: 'asc' },
    });
    return members;
  }

  // ─────────────────────────────────────────────
  // ACCOUNT MANAGEMENT
  // ─────────────────────────────────────────────

  /**
   * Soft-delete an account: clears PII, revokes sessions, marks DELETED.
   * The row is retained for audit integrity.
   */
  async deleteAccount(userId: string): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Clear PII
      await tx.user.update({
        where: { id: userId },
        data: {
          email: null,
          phoneNumber: null,
          name: null,
          avatarUrl: null,
          walletAddress: null,
          status: 'DELETED',
          verificationLevel: 'UNVERIFIED',
        },
      });

      // Revoke all sessions
      await tx.session.updateMany({
        where: { userId },
        data: { revoked: true },
      });
    });

    logger.info(
      { operationType: 'SECURITY', userId },
      'Account deleted — PII cleared, sessions revoked'
    );

    eventBus.publish('user.account.deleted', { userId });
  }

  // ─────────────────────────────────────────────
  // CLEANUP METHODS FOR BULLMQ JOB
  // ─────────────────────────────────────────────

  /**
   * Clean up all expired temporary locations
   * @returns Number of users updated
   */
  async cleanupExpiredTemporaryLocations(): Promise<number> {
    try {
      const result = await prisma.user.updateMany({
        where: {
          currentLocationUntil: { lt: new Date() },
          currentLocationId: { not: null },
        },
        data: {
          currentLocationId: null,
          currentLocationUntil: null,
        },
      });

      if (result.count > 0) {
        logger.info(
          { operationType: 'CLEANUP', count: result.count },
          'Expired temporary locations cleared'
        );
      }

      return result.count;
    } catch (err) {
      logger.error(
        {
          operationType: 'CLEANUP_ERROR',
          task: 'temp-locations',
          error: String(err),
        },
        'Failed to clean up expired temporary locations'
      );
      return 0;
    }
  }

  /**
   * Expire stale residence change requests (older than expiry date)
   * @returns Number of requests expired
   */
  async expireResidenceChangeRequests(): Promise<number> {
    try {
      const result = await prisma.residenceChangeRequest.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: { lt: new Date() },
        },
        data: {
          status: 'EXPIRED',
          reviewedAt: new Date(),
          rejectionReason: 'Expired due to inactivity',
        },
      });

      if (result.count > 0) {
        logger.info(
          { operationType: 'CLEANUP', count: result.count },
          'Stale residence change requests expired'
        );
      }

      return result.count;
    } catch (err) {
      logger.error(
        {
          operationType: 'CLEANUP_ERROR',
          task: 'residence-requests',
          error: String(err),
        },
        'Failed to expire stale residence change requests'
      );
      return 0;
    }
  }

  /**
   * Check and timeout incomplete vouching requests
   * @returns Number of requests timed out
   */
  async checkVouchingTimeouts(): Promise<number> {
    try {
      const result = await prisma.verificationRequest.updateMany({
        where: {
          type: 'COMMUNITY',
          status: 'VOUCHING',
          expiresAt: { lt: new Date() },
        },
        data: {
          status: 'PAYMENT_PENDING',
          reviewedAt: new Date(),
        },
      });

      if (result.count > 0) {
        logger.info(
          { operationType: 'CLEANUP', count: result.count },
          'Incomplete vouching requests timed out → payment pending'
        );
      }

      return result.count;
    } catch (err) {
      logger.error(
        {
          operationType: 'CLEANUP_ERROR',
          task: 'vouching-timeouts',
          error: String(err),
        },
        'Failed to check vouching timeouts'
      );
      return 0;
    }
  }
}

export const userService = new UserService();

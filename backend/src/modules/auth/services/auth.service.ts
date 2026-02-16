/**
 * @file src/modules/auth/services/auth.service.ts
 * @description
 * Auth Service — Magic Link Flow + User Creation
 * 
 * REFACTORED: Separated concerns - auth only handles authentication
 * - Emits events for other modules to react to
 * - Economy module listens and awards PR
 * - Community module listens and enrolls in groups
 * - OnboardingProgress tracking improved
 * 
 * Version: 3.1 — January 2026
 */

import { prisma } from "../../../core/database/client.js";
import { sendLoginEmail, sendVerificationEmail } from "../../../core/utils/email.service.js";
import { tokenService } from "./token.service.js";
import { sessionService } from "./session.service.js";
import { signJwtToken, JwtPayload, verifyJwtToken } from "../../../core/utils/jwt.service.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger, logSecurityEvent } from "../../../core/logger/logger.js";
import { eventBus } from "../../../core/utils/eventBus.js";
import { VerificationLevel, WalletAuthContext } from "../../../core/types/Ujamaadao.types.js";
import { 
  SendMagicLinkDto, 
  SendMagicLinkResponse,
  MagicLinkAuthResult,
  toUserResponse,
  toSessionResponse,
} from "../types.js";

type VerifyMagicLinkContext = WalletAuthContext;

// Brute force detection constants
const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

class AuthService {
  /**
   * Send magic link or verification email.
   * New users: Creates user + sends verification email
   * Existing users: Sends magic link login email
   */
  async sendMagicLink(params: SendMagicLinkDto): Promise<SendMagicLinkResponse> {
    const {
      email,
      name,
      phoneNumber,
      primaryWardId,
      secondaryWardId,
      industryIds,
      goodsServiceIds,
    } = params;

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // New user - validate all required fields present
      if (!name || !phoneNumber || !primaryWardId || !secondaryWardId || !industryIds || !goodsServiceIds) {
        throw ApiError.validationError(
          "New users must provide: name, phoneNumber, primaryWardId, secondaryWardId, industryIds, and goodsServiceIds",
          {
            required: ["name", "phoneNumber", "primaryWardId", "secondaryWardId", "industryIds", "goodsServiceIds"],
            provided: { name: !!name, phoneNumber: !!phoneNumber, primaryWardId: !!primaryWardId, secondaryWardId: !!secondaryWardId, industryIds: !!industryIds, goodsServiceIds: !!goodsServiceIds }
          }
        );
      }

      // Validate wards exist
      const [primaryWard, secondaryWard] = await Promise.all([
        prisma.ward.findUnique({
          where: { id: primaryWardId },
          select: { id: true, constituencyId: true, countyId: true, name: true },
        }),
        prisma.ward.findUnique({
          where: { id: secondaryWardId },
          select: { id: true, constituencyId: true, countyId: true, name: true },
        }),
      ]);

      if (!primaryWard || !secondaryWard) {
        throw ApiError.validationError("Invalid ward selection", { 
          primaryWardId: primaryWard ? "valid" : "invalid", 
          secondaryWardId: secondaryWard ? "valid" : "invalid" 
        });
      }

      // Validate industries and goods/services
      const [industries, goodsServices] = await Promise.all([
        prisma.industry.findMany({ where: { id: { in: industryIds } }, select: { id: true } }),
        prisma.goodsService.findMany({ where: { id: { in: goodsServiceIds }, active: true }, select: { id: true } }),
      ]);

      if (industries.length !== industryIds.length) {
        throw ApiError.validationError("One or more industries are invalid", {
          expected: industryIds.length,
          found: industries.length
        });
      }

      if (goodsServices.length !== goodsServiceIds.length) {
        throw ApiError.validationError("One or more goods/services are invalid or inactive", {
          expected: goodsServiceIds.length,
          found: goodsServices.length
        });
      }

      // Create user in transaction
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name,
            phoneNumber,
            primaryWardId,
            secondaryWardId,
            verificationLevel: "UNVERIFIED",
            emailVerified: false,
            phoneVerified: false,
            communityVerified: false,
            locationVerified: false,
          },
        });

        // Create industry associations (first one is primary by default)
        await Promise.all(
          industryIds.map((id, index) =>
            tx.userIndustry.create({ 
              data: { 
                userId: newUser.id, 
                industryId: id,
                isPrimary: index === 0, // First industry is primary
              } 
            })
          )
        );

        // Create goods/service associations (all start as can provide AND request)
        await Promise.all(
          goodsServiceIds.map(id =>
            tx.userGoodsService.create({ 
              data: { 
                userId: newUser.id, 
                goodsServiceId: id,
                canProvide: true,
                canRequest: true,
              } 
            })
          )
        );

        // Initialize onboarding progress
        await tx.onboardingProgress.create({
          data: {
            userId: newUser.id,
            industriesSelected: true,
            goodsServicesSelected: true,
            profileCompleted: true, // Name provided
            currentStep: "EMAIL_VERIFICATION",
          },
        });

        return newUser;
      });

      // Send verification email
      const verificationToken = await tokenService.createVerificationToken(user.id);
      const verificationLink = `${process.env.BASE_URL}/auth/verify-email?token=${verificationToken}`;

      await sendVerificationEmail(email, name, verificationLink);

      logger.info(
        { operationType: "AUTH", userId: user.id, metadata: { primaryWardId, secondaryWardId } },
        "New user created and verification email sent"
      );

      eventBus.publish("user.created", { 
        userId: user.id, 
        email,
        primaryWardId,
        secondaryWardId,
      });

      return { newUser: true, sentVerification: true };
    }

    // Existing user - send magic link
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email || undefined,
      type: "magic-link",
    };

    const magicLinkToken = await tokenService.createMagicLinkToken(payload);
    const loginLink = `${process.env.BASE_URL}/auth/login?token=${magicLinkToken}`;

    await sendLoginEmail(email, user.name || "User", loginLink);

    logger.info(
      { operationType: "AUTH", userId: user.id },
      "Magic link sent to existing user"
    );

    return { newUser: false, sentLogin: true };
  }

  /**
   * Complete email verification and create session.
   * 
   * REFACTORED: 
   * - Only awards PR for EMAIL_VERIFIED (not full onboarding)
   * - Updates OnboardingProgress correctly
   * - Enrolls in system groups (can be moved to event listener later)
   * - No premature onboardingCompletedAt
   */
  private async completeEmailVerificationAndCreateSession(
    userId: string,
    loginMethod: string,
    context?: VerifyMagicLinkContext
  ): Promise<MagicLinkAuthResult> {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        primaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
        secondaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
        currentWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
        userRoles: { where: { active: true }, include: { role: { select: { id: true, name: true } } } },
      },
    });

    if (!user) {
      await this.trackLoginEvent(null, loginMethod, false, "User not found", context);
      throw ApiError.authenticationError("Invalid link - user not found");
    }

    const isFirstTimeLogin = user.verificationLevel === "UNVERIFIED";

    // First-time email verification
    if (isFirstTimeLogin) {
      if (!user.primaryWardId || !user.secondaryWardId) {
        await this.trackLoginEvent(user.id, loginMethod, false, "Missing ward assignments", context);
        throw ApiError.validationError("Ward assignments required");
      }

      // Complete email verification in transaction
      user = await prisma.$transaction(async (tx) => {
        // 1. Update user verification status
        const updatedUser = await tx.user.update({
          where: { id: user!.id },
          data: {
            emailVerified: true,
            verificationLevel: "EMAIL_VERIFIED",
            // NOTE: onboardingCompletedAt NOT set here - too early!
          },
          include: {
            primaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
            secondaryWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
            currentWard: { select: { id: true, constituencyId: true, countyId: true, name: true } },
            userRoles: { where: { active: true }, include: { role: { select: { id: true, name: true } } } },
          },
        });

        // 2. Update onboarding progress
        await tx.onboardingProgress.update({
          where: { userId: updatedUser.id },
          data: {
            emailVerified: true,
            currentStep: "PLATFORM_INTRO", // Next: show platform tutorial
          },
        });

        return updatedUser;
      });

      logger.info({ operationType: "AUTH", userId: user.id }, "Email verified successfully");

      // Emit event - Other modules will handle their responsibilities
      // Economy module: Awards PR
      // Community module: Enrolls in system groups
      eventBus.publish("user.email.verified", { 
        userId: user.id,
        primaryWardId: user.primaryWardId,
        secondaryWardId: user.secondaryWardId,
      });
    }

    // Create session using sessionService
    const { session } = await sessionService.createSession(user.id, {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceInfo: context?.deviceInfo,
    });

    const roles = user.userRoles.map(ur => ur.role.name);

    // Build JWT access token with sessionId for validation
    const jwtPayload: JwtPayload = {
      sub: user.id,
      jti: session.id, // Use session ID as JWT ID for revocation
      email: user.email || undefined,
      phoneNumber: user.phoneNumber || undefined,
      walletAddress: user.walletAddress || undefined,
      primaryWardId: user.primaryWardId || undefined,
      secondaryWardId: user.secondaryWardId || undefined,
      currentLocationId: user.currentLocationId || undefined,
      currentLocationUntil: user.currentLocationUntil?.toISOString(),
      constituencyId: user.primaryWard?.constituencyId || undefined,
      countyId: user.primaryWard?.countyId || undefined,
      verificationLevel: user.verificationLevel as VerificationLevel,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      communityVerified: user.communityVerified,
      locationVerified: user.locationVerified,
      roles,
      globalImpactPoints: user.globalImpactPoints,
      utilityTokens: user.utilityTokens,
      participationRights: user.participationRights,
      type: "permanent",
      sessionId: session.id,
    };

    const accessToken = signJwtToken(jwtPayload, "7d");

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Track successful login event
    await this.trackLoginEvent(user.id, loginMethod, true, null, context);

    eventBus.publish("auth.login", {
      userId: user.id,
      method: loginMethod,
      sessionId: session.id,
      isFirstTimeLogin,
    });

    return {
      user: toUserResponse(user),
      sessionToken: accessToken,
      session: toSessionResponse(session, true),
      needsProfileCompletion: false,
    };
  }

  /**
   * Verify email verification token.
   */
  async verifyEmailToken(
    token: string,
    context?: VerifyMagicLinkContext
  ): Promise<MagicLinkAuthResult> {
    const loginMethod = "EMAIL_VERIFICATION";

    try {
      const user = await tokenService.validateVerificationToken(token);
      if (!user) {
        await this.trackLoginEvent(null, loginMethod, false, "Invalid or expired token", context);
        throw ApiError.tokenInvalid("Invalid or expired verification link");
      }

      return this.completeEmailVerificationAndCreateSession(user.id, loginMethod, context);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        logger.error({ operationType: "AUTH", error }, "Email verification failed");
        throw ApiError.tokenInvalid("Invalid or expired verification link");
      }
      throw error;
    }
  }

  /**
   * Verify magic link JWT and complete login.
   */
  async verifyMagicLink(
    token: string,
    context?: VerifyMagicLinkContext
  ): Promise<MagicLinkAuthResult> {
    const loginMethod = "MAGIC_LINK";
    let userId: string | undefined;

    try {
      const payload = verifyJwtToken<JwtPayload>(token);
      userId = payload.sub;

      if (!userId) {
        throw ApiError.authenticationError("Invalid token payload - missing user ID");
      }

      // Verify token type
      if (payload.type !== "magic-link") {
        throw ApiError.authenticationError("Invalid token type");
      }

      return this.completeEmailVerificationAndCreateSession(userId, loginMethod, context);
    } catch (error) {
      if (userId) {
        await this.trackLoginEvent(userId, loginMethod, false, "Invalid or expired token", context);
      }
      if (!(error instanceof ApiError)) {
        logger.error({ operationType: "AUTH", userId, error }, "Magic link verification failed");
        throw ApiError.tokenInvalid("Invalid or expired magic link");
      }
      throw error;
    }
  }

  /**
   * Detect brute force attempts based on recent failed logins
   */
  private async detectBruteForce(ipAddress: string): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - FAILED_ATTEMPT_WINDOW_MS);
      
      const failedAttempts = await prisma.loginEvent.count({
        where: {
          ipAddress,
          successful: false,
          createdAt: { gte: windowStart },
        },
      });

      return failedAttempts >= MAX_FAILED_ATTEMPTS;
    } catch (error) {
      logger.error({ operationType: "SECURITY", error }, "Failed to check brute force");
      return false;
    }
  }

  /**
   * Track login event (success or failure).
   * Includes security event logging and brute force detection.
   */
  private async trackLoginEvent(
    userId: string | null,
    method: string,
    successful: boolean,
    failureReason: string | null,
    context?: VerifyMagicLinkContext
  ) {
    try {
      const ipAddress = context?.ipAddress;
      const userAgent = context?.userAgent;

      // Track failed login attempts and detect brute force
      if (!successful && ipAddress) {
        const isBruteForce = await this.detectBruteForce(ipAddress);
        
        if (isBruteForce) {
          logSecurityEvent(
            "Brute force login attempt detected",
            "BRUTE_FORCE",
            "CRITICAL",
            `${MAX_FAILED_ATTEMPTS}+ failed attempts from ${ipAddress} in ${FAILED_ATTEMPT_WINDOW_MS/60000} minutes`,
            {
              userId: userId || undefined,
              ipAddress,
              metadata: {
                method,
                failureReason,
                userAgent,
              },
            }
          );
        } else {
          logSecurityEvent(
            "Login failed",
            "AUTH_FAILURE",
            "MEDIUM",
            failureReason || "Authentication failed",
            {
              userId: userId || undefined,
              ipAddress,
              metadata: {
                method,
                userAgent,
              },
            }
          );
        }
      }

      // Only create database record if we have a valid userId
      if (userId) {
        await prisma.loginEvent.create({
          data: {
            userId,
            method,
            successful,
            failureReason,
            ipAddress,
            userAgent,
          },
        });

        // Log successful login
        if (successful) {
          logger.info(
            { operationType: "AUTH", userId, metadata: { method, ipAddress } },
            "User logged in successfully"
          );
        }
      } else if (!successful) {
        // Failed login without user context
        logger.warn(
          { 
            operationType: "AUTH", 
            metadata: { method, failureReason, ipAddress, userAgent } 
          },
          "Login attempt failed without valid user context"
        );
      }
    } catch (error) {
      logger.error({ operationType: "AUTH", userId, error }, "Failed to track login event");
    }
  }
}

export const authService = new AuthService();
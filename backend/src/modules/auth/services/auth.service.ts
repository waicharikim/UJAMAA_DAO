import { createHash, timingSafeEqual } from 'crypto';
import { prisma } from '../../../core/database/client.js';
import { Prisma } from '@prisma/client';
import {
  sendLoginEmail,
  sendVerificationEmail,
} from '../../../core/utils/email.service.js';
import { tokenService } from './token.service.js';
import { sessionService } from './session.service.js';
import {
  signJwtToken,
  JwtPayload,
  verifyJwtToken,
} from '../../../core/utils/jwt.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger, logSecurityEvent } from '../../../core/logger/logger.js';
import { eventBus } from '../../../core/utils/eventBus.js';
import {
  VerificationLevel,
  WalletAuthContext,
} from '../../../core/types/Ujamaadao.types.js';
import { userService } from '../../user/services/user.service.js';
import {
  SendMagicLinkDto,
  SendMagicLinkResponse,
  MagicLinkAuthResult,
  toUserResponse,
  toSessionResponse,
  needsOnboarding,
} from '../types.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';

type VerifyMagicLinkContext = WalletAuthContext;

type TrackLoginParams = {
  userId: string | null;
  method: string;
  successful: boolean;
  failureReason?: string | null;
  context?: VerifyMagicLinkContext;
};

type FailedLoginContext = {
  ipAddress: string;
  userId: string | null;
  method: string;
  failureReason?: string | null;
  userAgent?: string;
};

type LoginRecord = {
  userId: string;
  method: string;
  successful: boolean;
  failureReason?: string | null;
  ipAddress?: string;
  userAgent?: string;
};

function isSignInWithNoAccount(params: SendMagicLinkDto): boolean {
  const {
    name,
    phoneNumber,
    primaryWardId,
    secondaryWardId,
    industryIds,
    goodsServiceIds,
  } = params;
  return (
    !name &&
    !phoneNumber &&
    !primaryWardId &&
    !secondaryWardId &&
    !industryIds &&
    !goodsServiceIds
  );
}

function hasMissingRegistrationFields(params: SendMagicLinkDto): boolean {
  // secondaryWardId (origin) is intentionally NOT required — it defaults to the
  // primary ward when the user doesn't pick a separate origin (see registerNewUser).
  const { name, phoneNumber, primaryWardId, industryIds, goodsServiceIds } =
    params;
  return (
    !name || !phoneNumber || !primaryWardId || !industryIds || !goodsServiceIds
  );
}

const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Constant-time string comparison (hash both to a fixed length so neither the
 * length nor the content of the secret leaks via timing).
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

class AuthService {
  async sendMagicLink(
    params: SendMagicLinkDto
  ): Promise<SendMagicLinkResponse> {
    const user = await prisma.user.findUnique({
      where: { email: params.email },
    });
    if (!user) return this.registerNewUser(params);
    return this.sendLoginMagicLink(user, params.email);
  }

  private assertRegistrationComplete(params: SendMagicLinkDto): void {
    if (isSignInWithNoAccount(params)) {
      throw ApiError.notFound(
        'No account found with that email. Please register first.'
      );
    }
    if (hasMissingRegistrationFields(params)) {
      const { name, phoneNumber, primaryWardId, industryIds, goodsServiceIds } =
        params;
      throw ApiError.validationError(
        'New users must provide: name, phoneNumber, primaryWardId, industryIds, and goodsServiceIds',
        {
          required: [
            'name',
            'phoneNumber',
            'primaryWardId',
            'industryIds',
            'goodsServiceIds',
          ],
          provided: {
            name: !!name,
            phoneNumber: !!phoneNumber,
            primaryWardId: !!primaryWardId,
            industryIds: !!industryIds,
            goodsServiceIds: !!goodsServiceIds,
          },
        }
      );
    }
  }

  private async validateWards(primaryWardId: string, secondaryWardId: string) {
    const wardSelect = {
      id: true,
      constituencyId: true,
      countyId: true,
      name: true,
    };
    const [primaryWard, secondaryWard] = await Promise.all([
      prisma.ward.findUnique({
        where: { id: primaryWardId },
        select: wardSelect,
      }),
      prisma.ward.findUnique({
        where: { id: secondaryWardId },
        select: wardSelect,
      }),
    ]);
    if (!primaryWard || !secondaryWard) {
      throw ApiError.validationError('Invalid ward selection', {
        primaryWardId: primaryWard ? 'valid' : 'invalid',
        secondaryWardId: secondaryWard ? 'valid' : 'invalid',
      });
    }
    return [primaryWard, secondaryWard] as const;
  }

  private async validateIndustriesAndGoods(
    industryIds: string[],
    goodsServiceIds: string[]
  ): Promise<void> {
    const [industries, goodsServices] = await Promise.all([
      prisma.industry.findMany({
        where: { id: { in: industryIds } },
        select: { id: true },
      }),
      prisma.goodsService.findMany({
        where: { id: { in: goodsServiceIds }, active: true },
        select: { id: true },
      }),
    ]);
    if (industries.length !== industryIds.length) {
      throw ApiError.validationError('One or more industries are invalid', {
        expected: industryIds.length,
        found: industries.length,
      });
    }
    if (goodsServices.length !== goodsServiceIds.length) {
      throw ApiError.validationError(
        'One or more goods/services are invalid or inactive',
        {
          expected: goodsServiceIds.length,
          found: goodsServices.length,
        }
      );
    }
  }

  private async createUserInTransaction(
    email: string,
    name: string,
    phoneNumber: string,
    primaryWardId: string,
    secondaryWardId: string,
    industryIds: string[],
    goodsServiceIds: string[],
    messagingPlatforms: SendMagicLinkDto['messagingPlatforms']
  ) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          phoneNumber,
          primaryWardId,
          secondaryWardId,
          verificationLevel: 'UNVERIFIED',
          emailVerified: false,
          phoneVerified: false,
          communityVerified: false,
          locationVerified: false,
        },
      });

      await Promise.all(
        industryIds.map((id, index) =>
          tx.userIndustry.create({
            data: {
              userId: newUser.id,
              industryId: id,
              isPrimary: index === 0,
            },
          })
        )
      );

      await Promise.all(
        goodsServiceIds.map((id) =>
          tx.userGoodsService.create({
            data: {
              userId: newUser.id,
              goodsServiceId: id,
              canProvide: true,
              canRequest: true,
            },
          })
        )
      );

      await tx.onboardingProgress.create({
        data: {
          userId: newUser.id,
          industriesSelected: true,
          goodsServicesSelected: true,
          profileCompleted: true,
          currentStep: 'EMAIL_VERIFICATION',
        },
      });

      if (messagingPlatforms?.length) {
        await Promise.all(
          messagingPlatforms.map((pref) =>
            tx.userMessagingProfile.create({
              data: {
                userId: newUser.id,
                platform: pref.platform as any,
                handle: pref.handle ?? null,
                isVerified: false,
              },
            })
          )
        );
      }

      return newUser;
    });
  }

  private async registerNewUser(
    params: SendMagicLinkDto
  ): Promise<SendMagicLinkResponse> {
    const {
      email,
      name,
      phoneNumber,
      primaryWardId,
      secondaryWardId,
      industryIds,
      goodsServiceIds,
      messagingPlatforms,
    } = params;
    this.assertRegistrationComplete(params);

    // Everyone belongs to two communities: residence (primary) + origin (secondary).
    // Origin is only "optional" in that it defaults to the residence ward when the
    // user lives where they're from — it is never null.
    const resolvedSecondaryWardId = secondaryWardId ?? primaryWardId!;

    await this.validateWards(primaryWardId!, resolvedSecondaryWardId);
    await this.validateIndustriesAndGoods(industryIds!, goodsServiceIds!);

    const user = await this.createUserInTransaction(
      email,
      name!,
      phoneNumber!,
      primaryWardId!,
      resolvedSecondaryWardId,
      industryIds!,
      goodsServiceIds!,
      messagingPlatforms
    );

    const verificationToken = await tokenService.createVerificationToken(
      user.id
    );
    const verificationLink = `${process.env.FRONTEND_URL}/auth/callback?token=${verificationToken}`;
    await sendVerificationEmail(email, name!, verificationLink);

    logger.info(
      {
        operationType: 'AUTH',
        userId: user.id,
        metadata: { primaryWardId, secondaryWardId: resolvedSecondaryWardId },
      },
      'New user created and verification email sent'
    );
    eventBus.publish('user.created', {
      userId: user.id,
      email,
      primaryWardId,
      secondaryWardId: resolvedSecondaryWardId,
    });
    await auditService.log(user.id, AuditAction.USER_CREATED, 'user', user.id, {
      primaryWardId,
      secondaryWardId: resolvedSecondaryWardId,
      registrationMethod: 'email',
    });

    return { newUser: true, sentVerification: true };
  }

  private async sendLoginMagicLink(
    user: { id: string; email: string | null; name: string | null },
    email: string
  ): Promise<SendMagicLinkResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email || undefined,
      type: 'magic-link',
    };
    const magicLinkToken = await tokenService.createMagicLinkToken(payload);
    const loginLink = `${process.env.FRONTEND_URL}/auth/callback?token=${magicLinkToken}`;
    await sendLoginEmail(email, user.name || 'User', loginLink);
    logger.info(
      { operationType: 'AUTH', userId: user.id },
      'Magic link sent to existing user'
    );
    return { newUser: false, sentLogin: true };
  }

  private async handleFirstTimeEmailVerification(
    user: any,
    loginMethod: string,
    context?: VerifyMagicLinkContext
  ) {
    if (!user.primaryWardId || !user.secondaryWardId) {
      await this.trackLoginEvent({
        userId: user.id,
        method: loginMethod,
        successful: false,
        failureReason: 'Missing ward assignments',
        context,
      });
      throw ApiError.validationError('Ward assignments required');
    }

    const wardSelect = {
      id: true,
      constituencyId: true,
      countyId: true,
      name: true,
    };
    const updatedUser = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const u = await tx.user.update({
          where: { id: user.id },
          data: { emailVerified: true, verificationLevel: 'EMAIL_VERIFIED' },
          include: {
            primaryWard: { select: wardSelect },
            secondaryWard: { select: wardSelect },
            currentWard: { select: wardSelect },
            userRoles: {
              where: { active: true },
              include: { role: { select: { id: true, name: true } } },
            },
          },
        });
        await tx.onboardingProgress.update({
          where: { userId: u.id },
          data: { emailVerified: true, currentStep: 'PLATFORM_INTRO' },
        });
        return u;
      }
    );

    logger.info(
      { operationType: 'AUTH', userId: updatedUser.id },
      'Email verified successfully'
    );

    await eventBus.emit('user.email.verified', {
      userId: updatedUser.id,
      primaryWardId: updatedUser.primaryWardId,
      secondaryWardId: updatedUser.secondaryWardId,
    });

    await auditService.log(
      updatedUser.id,
      AuditAction.EMAIL_VERIFIED,
      'user',
      updatedUser.id,
      { verificationLevel: 'EMAIL_VERIFIED', loginMethod }
    );
    await userService.checkFullVerification(updatedUser.id);

    return updatedUser;
  }

  private buildJwtPayload(
    user: any,
    session: { id: string },
    roles: string[]
  ): JwtPayload {
    return {
      sub: user.id,
      jti: session.id,
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
      roles,
      globalImpactPoints: user.globalImpactPoints,
      utilityTokens:
        (user.fiatBackedUtBalance ?? 0) + (user.earnedUtBalance ?? 0),
      participationRights: user.participationRights,
      type: 'permanent',
      sessionId: session.id,
    };
  }

  private async buildAuthResult(
    user: any,
    loginMethod: string,
    context: VerifyMagicLinkContext | undefined,
    isFirstTimeLogin: boolean
  ): Promise<MagicLinkAuthResult> {
    const { session } = await sessionService.createSession(user.id, {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceInfo: context?.deviceInfo,
    });

    const roles = user.userRoles.map((ur: any) => ur.role.name);
    const accessToken = signJwtToken(
      this.buildJwtPayload(user, session, roles),
      '7d'
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.trackLoginEvent({
      userId: user.id,
      method: loginMethod,
      successful: true,
      context,
    });
    eventBus.publish('auth.login', {
      userId: user.id,
      method: loginMethod,
      sessionId: session.id,
      isFirstTimeLogin,
    });

    return {
      user: toUserResponse(user),
      sessionToken: accessToken,
      session: toSessionResponse(session, true),
      needsProfileCompletion: needsOnboarding(user),
    };
  }

  private async completeEmailVerificationAndCreateSession(
    userId: string,
    loginMethod: string,
    context?: VerifyMagicLinkContext
  ): Promise<MagicLinkAuthResult> {
    const wardSelect = {
      id: true,
      constituencyId: true,
      countyId: true,
      name: true,
    };
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        primaryWard: { select: wardSelect },
        secondaryWard: { select: wardSelect },
        currentWard: { select: wardSelect },
        userRoles: {
          where: { active: true },
          include: { role: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) {
      await this.trackLoginEvent({
        userId: null,
        method: loginMethod,
        successful: false,
        failureReason: 'User not found',
        context,
      });
      throw ApiError.authenticationError('Invalid link - user not found');
    }

    const isFirstTimeLogin = user.verificationLevel === 'UNVERIFIED';
    if (isFirstTimeLogin) {
      user = await this.handleFirstTimeEmailVerification(
        user,
        loginMethod,
        context
      );
    }

    return this.buildAuthResult(user, loginMethod, context, isFirstTimeLogin);
  }

  async verifyEmailToken(
    token: string,
    context?: VerifyMagicLinkContext
  ): Promise<MagicLinkAuthResult> {
    const loginMethod = 'EMAIL_VERIFICATION';
    try {
      const user = await tokenService.validateVerificationToken(token);
      if (!user) {
        await this.trackLoginEvent({
          userId: null,
          method: loginMethod,
          successful: false,
          failureReason: 'Invalid or expired token',
          context,
        });
        throw ApiError.tokenInvalid('Invalid or expired verification link');
      }
      return this.completeEmailVerificationAndCreateSession(
        user.id,
        loginMethod,
        context
      );
    } catch (error) {
      if (!(error instanceof ApiError)) {
        logger.error(
          { operationType: 'AUTH', error },
          'Email verification failed'
        );
        throw ApiError.tokenInvalid('Invalid or expired verification link');
      }
      throw error;
    }
  }

  async verifyMagicLink(
    token: string,
    context?: VerifyMagicLinkContext
  ): Promise<MagicLinkAuthResult> {
    const loginMethod = 'MAGIC_LINK';
    let userId: string | undefined;
    try {
      const payload = verifyJwtToken<JwtPayload>(token);
      userId = payload.sub;
      if (!userId)
        throw ApiError.authenticationError(
          'Invalid token payload - missing user ID'
        );
      if (payload.type !== 'magic-link')
        throw ApiError.authenticationError('Invalid token type');
      return this.completeEmailVerificationAndCreateSession(
        userId,
        loginMethod,
        context
      );
    } catch (error) {
      if (userId) {
        await this.trackLoginEvent({
          userId,
          method: loginMethod,
          successful: false,
          failureReason: 'Invalid or expired token',
          context,
        });
      }
      if (!(error instanceof ApiError)) {
        logger.error(
          { operationType: 'AUTH', userId, error },
          'Magic link verification failed'
        );
        throw ApiError.tokenInvalid('Invalid or expired magic link');
      }
      throw error;
    }
  }

  /**
   * Shared-passcode demo login for hackathon judges. A single access code
   * (`DEMO_ACCESS_CODE`) unlocks a session for a pre-seeded, non-admin demo
   * account (`DEMO_JUDGE_EMAIL`, default `demo@ujamaadao.org`) so judges can
   * explore the live AI layer with NO signup and NO magic-link inbox. The
   * account is sandboxed to a demo community and cannot move real money
   * (real money is M-Pesa-only regardless). Disabled unless the env code is set.
   */
  async loginDemoUser(
    code: string,
    context?: VerifyMagicLinkContext
  ): Promise<MagicLinkAuthResult> {
    const expected = process.env.DEMO_ACCESS_CODE;
    // Refuse trivially-guessable / unset codes so the door is only open when
    // an operator has deliberately configured a real passcode.
    if (!expected || expected.length < 8) {
      throw ApiError.notFound('Demo access is not enabled');
    }
    if (!timingSafeEqualStr(code, expected)) {
      logSecurityEvent(
        'Invalid demo access code',
        'SUSPICIOUS_ACTIVITY',
        'LOW',
        `Bad demo code from ${context?.ipAddress ?? 'unknown'}`,
        { ipAddress: context?.ipAddress }
      );
      throw ApiError.authenticationError('Invalid access code');
    }
    const email = (
      process.env.DEMO_JUDGE_EMAIL || 'demo@ujamaadao.org'
    ).toLowerCase();
    const demo = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!demo) {
      throw ApiError.notFound(
        'Demo account is not provisioned — run the demo seed first'
      );
    }
    return this.completeEmailVerificationAndCreateSession(
      demo.id,
      'DEMO',
      context
    );
  }

  /**
   * The demo account's most recent proposal — the "flagship" deliberation the
   * judges' demo lands on. Null if the demo seed hasn't run yet.
   */
  async getDemoFlagshipProposalId(userId: string): Promise<string | null> {
    const proposal = await prisma.proposal.findFirst({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return proposal?.id ?? null;
  }

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
      logger.error(
        { operationType: 'SECURITY', error },
        'Failed to check brute force'
      );
      return false;
    }
  }

  private async logFailedLoginSecurity(ctx: FailedLoginContext): Promise<void> {
    const isBruteForce = await this.detectBruteForce(ctx.ipAddress);
    if (isBruteForce) {
      logSecurityEvent(
        'Brute force login attempt detected',
        'BRUTE_FORCE',
        'CRITICAL',
        `${MAX_FAILED_ATTEMPTS}+ failed attempts from ${ctx.ipAddress} in ${FAILED_ATTEMPT_WINDOW_MS / 60000} minutes`,
        {
          userId: ctx.userId || undefined,
          ipAddress: ctx.ipAddress,
          metadata: {
            method: ctx.method,
            failureReason: ctx.failureReason,
            userAgent: ctx.userAgent,
          },
        }
      );
    } else {
      logSecurityEvent(
        'Login failed',
        'AUTH_FAILURE',
        'MEDIUM',
        ctx.failureReason || 'Authentication failed',
        {
          userId: ctx.userId || undefined,
          ipAddress: ctx.ipAddress,
          metadata: { method: ctx.method, userAgent: ctx.userAgent },
        }
      );
    }
  }

  private async recordDbLoginEvent(record: LoginRecord): Promise<void> {
    await prisma.loginEvent.create({ data: record });
    if (record.successful) {
      logger.info(
        {
          operationType: 'AUTH',
          userId: record.userId,
          metadata: { method: record.method, ipAddress: record.ipAddress },
        },
        'User logged in successfully'
      );
    }
  }

  private async trackLoginEvent(params: TrackLoginParams) {
    try {
      const { userId, method, successful, failureReason, context } = params;
      const ipAddress = context?.ipAddress;
      const userAgent = context?.userAgent;

      if (!successful && ipAddress) {
        await this.logFailedLoginSecurity({
          ipAddress,
          userId,
          method,
          failureReason,
          userAgent,
        });
      }

      if (userId) {
        await this.recordDbLoginEvent({
          userId,
          method,
          successful,
          failureReason,
          ipAddress,
          userAgent,
        });
      } else if (!successful) {
        logger.warn(
          {
            operationType: 'AUTH',
            metadata: { method, failureReason, ipAddress, userAgent },
          },
          'Login attempt failed without valid user context'
        );
      }
    } catch (error) {
      logger.error(
        { operationType: 'AUTH', userId: params.userId, error },
        'Failed to track login event'
      );
    }
  }
}

export const authService = new AuthService();

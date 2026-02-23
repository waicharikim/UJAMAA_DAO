/**
 * @file src/modules/auth/services/refresh-token.service.ts
 * @description
 * Refresh Token Service - Handle token refresh and rotation
 *
 * Features:
 * - Refresh token rotation (old token invalidated on use)
 * - Device tracking
 * - Suspicious activity detection
 *
 * Version: 1.0 — January 2026
 */

import { prisma } from '../../../core/database/client.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyJwtToken,
  JwtPayload,
} from '../../../core/utils/jwt.service.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { tokenBlacklistService } from '../../../core/services/token-blacklist.service.js';
import { logger } from '../../../core/logger/logger.js';

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshContext {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

class RefreshTokenService {
  /**
   * Refresh access token using refresh token
   * Implements token rotation - old refresh token is invalidated
   */
  async refresh(
    refreshToken: string,
    context: RefreshContext = {}
  ): Promise<RefreshTokenResult> {
    try {
      // 1. Verify refresh token
      const payload = verifyJwtToken<JwtPayload>(refreshToken);

      // 2. Verify it's actually a refresh token
      if (payload.type !== 'refresh') {
        logger.warn(
          {
            operationType: 'SECURITY',
            userId: payload.sub,
            metadata: { tokenType: payload.type, ipAddress: context.ipAddress },
          },
          'Non-refresh token used in refresh endpoint'
        );

        throw ApiError.tokenInvalid('Invalid token type');
      }

      // 3. Check if token is blacklisted
      if (payload.jti) {
        const isRevoked = await tokenBlacklistService.isRevoked(payload.jti);
        if (isRevoked) {
          logger.warn(
            {
              operationType: 'SECURITY',
              userId: payload.sub,
              metadata: {
                jti: payload.jti.slice(0, 8) + '...',
                ipAddress: context.ipAddress,
              },
            },
            'Attempted reuse of revoked refresh token'
          );

          throw ApiError.tokenInvalid('Token has been revoked');
        }
      }

      // 4. Get fresh user data from database
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          primaryWard: true,
          secondaryWard: true,
        },
      });

      if (!user) {
        throw ApiError.notFound('User', undefined);
      }

      // 5. Check if user is still active
      if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
        logger.warn(
          {
            operationType: 'SECURITY',
            userId: user.id,
            metadata: { status: user.status },
          },
          'Suspended/banned user attempted token refresh'
        );

        throw ApiError.authenticationError('Account is not active');
      }

      // 6. Validate that the session is still active in the DB
      if (payload.sessionId) {
        const sessionValid = await prisma.session.findUnique({
          where: { id: payload.sessionId },
          select: { revoked: true },
        });
        if (!sessionValid || sessionValid.revoked) {
          throw ApiError.tokenInvalid('Session has been revoked');
        }
      }

      // 6b. Detect suspicious activity (IP/device change)
      if (payload.sessionId) {
        await this.checkSuspiciousActivity(payload.sessionId, context);
      }

      // 7. Invalidate old refresh token (rotation)
      if (payload.jti && payload.exp) {
        await tokenBlacklistService.revoke(
          payload.jti,
          new Date(payload.exp * 1000)
        );
      }

      // 8. Build new payload with fresh data
      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email || undefined,
        phoneNumber: user.phoneNumber || undefined,
        walletAddress: user.walletAddress || undefined,
        primaryWardId: user.primaryWardId || undefined,
        secondaryWardId: user.secondaryWardId || undefined,
        constituencyId: user.primaryWard?.constituencyId || undefined,
        countyId: user.primaryWard?.countyId || undefined,
        verificationLevel:
          user.verificationLevel as import('../../../core/types/Ujamaadao.types.js').VerificationLevel,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        communityVerified: user.communityVerified,
        roles: user.roles || [],
        globalImpactPoints: user.globalImpactPoints,
        utilityTokens: user.utilityTokens,
        participationRights: user.participationRights,
        sessionId: payload.sessionId,
      };

      // 9. Generate new token pair
      const newAccessToken = signAccessToken(newPayload);
      const newRefreshToken = signRefreshToken(newPayload);

      // 10. Update session if exists
      if (payload.sessionId) {
        await prisma.session
          .update({
            where: { id: payload.sessionId },
            data: {
              lastActive: new Date(),
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            },
          })
          .catch(() => {
            // Session might have been deleted - not critical
            logger.debug(
              {
                operationType: 'GENERAL',
                userId: user.id,
              },
              'Could not update session on refresh'
            );
          });
      }

      logger.info(
        {
          operationType: 'AUTH',
          userId: user.id,
          metadata: { ipAddress: context.ipAddress },
        },
        'Token refreshed successfully'
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600, // 1 hour in seconds
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        {
          operationType: 'GENERAL',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Token refresh failed'
      );

      throw ApiError.tokenInvalid('Invalid refresh token');
    }
  }

  /**
   * Check for suspicious activity (IP/device change)
   */
  private async checkSuspiciousActivity(
    sessionId: string,
    context: RefreshContext
  ): Promise<void> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          ipAddress: true,
          userAgent: true,
          userId: true,
        },
      });

      if (!session) return;

      // Check for IP change
      if (
        session.ipAddress &&
        context.ipAddress &&
        session.ipAddress !== context.ipAddress
      ) {
        logger.warn(
          {
            operationType: 'SECURITY',
            userId: session.userId,
            metadata: {
              oldIp: session.ipAddress,
              newIp: context.ipAddress,
              sessionId,
            },
          },
          'IP address changed during session - possible session hijacking'
        );

        // TODO: Send security alert email
        // TODO: Consider requiring re-authentication
      }

      // Check for user agent change
      if (
        session.userAgent &&
        context.userAgent &&
        session.userAgent !== context.userAgent
      ) {
        logger.warn(
          {
            operationType: 'SECURITY',
            userId: session.userId,
            metadata: {
              oldUserAgent: session.userAgent,
              newUserAgent: context.userAgent,
              sessionId,
            },
          },
          'User agent changed during session - possible session hijacking'
        );
      }
    } catch (error) {
      // Non-critical - don't fail the refresh
      logger.debug(
        {
          operationType: 'GENERAL',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Could not check suspicious activity'
      );
    }
  }

  /**
   * Revoke all refresh tokens for a user (logout all devices)
   */
  async revokeAllForUser(userId: string): Promise<void> {
    try {
      // Get all active sessions
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          revoked: false,
        },
        select: { id: true },
      });

      // Revoke all sessions
      await prisma.session.updateMany({
        where: { userId },
        data: { revoked: true },
      });

      logger.info(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { sessionCount: sessions.length },
        },
        'All refresh tokens revoked for user'
      );
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Failed to revoke all refresh tokens'
      );
      throw ApiError.systemError('Failed to revoke tokens');
    }
  }
}

export const refreshTokenService = new RefreshTokenService();
export default refreshTokenService;

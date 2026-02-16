/**
 * @file src/modules/auth/services/session-device.service.ts
 * @description
 * Session and Device Management Service
 * 
 * Features:
 * - List active sessions
 * - Rename sessions (friendly names)
 * - Trust / untrust devices
 * - Revoke specific or all other sessions
 * - Detect suspicious sessions (unusual IP, concurrent logins)
 * - Periodic cleanup of expired/revoked sessions
 * 
 * Version: 1.1 — February 2026
 * Updated: Added cleanupExpiredSessions() for BullMQ worker
 */

import { prisma } from "../../../core/database/client.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { tokenBlacklistService } from "../../../core/services/token-blacklist.service.js";

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
  isTrusted: boolean;
  createdAt: Date;
  lastActive: Date;
  expiresAt: Date;
}

class SessionDeviceService {
  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActive: 'desc' },
      });

      return sessions.map(session => ({
        id: session.id,
        deviceName: session.deviceName,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isCurrent: session.id === currentSessionId,
        isTrusted: session.isTrusted || false,
        createdAt: session.createdAt,
        lastActive: session.lastActive || session.createdAt,
        expiresAt: session.expiresAt,
      }));
    } catch (error) {
      logger.error({
        operationType: 'SESSION_FETCH_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to get user sessions');
      throw ApiError.systemError('Failed to retrieve sessions');
    }
  }

  /**
   * Rename a session (give it a friendly name)
   */
  async renameSession(
    userId: string,
    sessionId: string,
    deviceName: string
  ): Promise<void> {
    if (!deviceName || deviceName.trim().length === 0) {
      throw ApiError.badRequest('Device name cannot be empty');
    }

    if (deviceName.length > 100) {
      throw ApiError.badRequest('Device name too long (max 100 characters)');
    }

    try {
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
          revoked: false,
        },
      });

      if (!session) {
        throw ApiError.notFound('Session');
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { deviceName: deviceName.trim() },
      });

      logger.info({
        operationType: 'SESSION_RENAME',
        userId,
        metadata: { sessionId, deviceName },
      }, 'Session renamed');
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({
        operationType: 'SESSION_RENAME_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to rename session');
      throw ApiError.systemError('Failed to rename session');
    }
  }

  /**
   * Trust a device (skip additional security checks)
   */
  async trustDevice(userId: string, sessionId: string): Promise<void> {
    try {
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
          revoked: false,
        },
      });

      if (!session) {
        throw ApiError.notFound('Session');
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { isTrusted: true },
      });

      logger.info({
        operationType: 'SECURITY',
        userId,
        metadata: { sessionId },
      }, 'Device marked as trusted');
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({
        operationType: 'TRUST_DEVICE_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to trust device');
      throw ApiError.systemError('Failed to trust device');
    }
  }

  /**
   * Untrust a device
   */
  async untrustDevice(userId: string, sessionId: string): Promise<void> {
    try {
      await prisma.session.update({
        where: { 
          id: sessionId,
          userId,
        },
        data: { isTrusted: false },
      });

      logger.info({
        operationType: 'SECURITY',
        userId,
        metadata: { sessionId },
      }, 'Device untrusted');
    } catch (error) {
      logger.error({
        operationType: 'UNTRUST_DEVICE_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to untrust device');
      throw ApiError.systemError('Failed to untrust device');
    }
  }

  /**
   * Revoke a specific session (logout from one device)
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    reason: string = 'User logout'
  ): Promise<void> {
    try {
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });

      if (!session) {
        throw ApiError.notFound('Session');
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { 
          revoked: true,
          revokedAt: new Date(),
        },
      });

      logger.info({
        operationType: 'AUTH',
        userId,
        metadata: { sessionId, reason },
      }, 'Session revoked');
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({
        operationType: 'REVOKE_SESSION_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to revoke session');
      throw ApiError.systemError('Failed to revoke session');
    }
  }

  /**
   * Revoke all other sessions except the current one
   */
  async revokeOtherSessions(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    try {
      const result = await prisma.session.updateMany({
        where: {
          userId,
          id: { not: currentSessionId },
          revoked: false,
        },
        data: {
          revoked: true,
          revokedAt: new Date(),
        },
      });

      logger.info({
        operationType: 'AUTH',
        userId,
        metadata: { revokedCount: result.count, currentSessionId },
      }, 'Other sessions revoked');

      return result.count;
    } catch (error) {
      logger.error({
        operationType: 'REVOKE_OTHER_SESSIONS_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to revoke other sessions');
      throw ApiError.systemError('Failed to revoke sessions');
    }
  }

  /**
   * Detect suspicious sessions (unusual IPs, concurrent logins)
   */
  async detectSuspiciousSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const sessions = await this.getUserSessions(userId);

      const recentSessions = await prisma.session.findMany({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { ipAddress: true },
      });

      const typicalIps = new Set(recentSessions.map(s => s.ipAddress).filter(Boolean));

      const suspicious = sessions.filter(session => {
        const unusualIp = session.ipAddress && !typicalIps.has(session.ipAddress);

        const multipleConcurrent = sessions.filter(s => 
          s.ipAddress && s.ipAddress !== session.ipAddress &&
          Math.abs(s.lastActive.getTime() - session.lastActive.getTime()) < 5 * 60 * 1000
        ).length > 0;

        return unusualIp || multipleConcurrent;
      });

      if (suspicious.length > 0) {
        logger.warn({
          operationType: 'SECURITY',
          userId,
          metadata: { suspiciousCount: suspicious.length },
        }, 'Suspicious sessions detected');
      }

      return suspicious;
    } catch (error) {
      logger.error({
        operationType: 'SUSPICIOUS_SESSION_DETECTION_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to detect suspicious sessions');
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // CLEANUP METHOD FOR BULLMQ JOB
  // ─────────────────────────────────────────────

  /**
   * Clean up expired or revoked sessions
   * Deletes sessions that are:
   * - Already revoked
   * - Expired (expiresAt < now)
   * Also deletes very old revoked sessions (>90 days) to prevent table bloat
   * 
   * @returns Number of sessions deleted
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();

      // Delete expired or revoked sessions
      const expiredResult = await prisma.session.deleteMany({
        where: {
          OR: [
            { revoked: true },
            { expiresAt: { lt: now } },
          ],
        },
      });

      // Optional: also delete very old revoked sessions (safety net)
      const oldRevokedCutoff = new Date();
      oldRevokedCutoff.setDate(oldRevokedCutoff.getDate() - 90);

      const oldRevokedResult = await prisma.session.deleteMany({
        where: {
          revoked: true,
          revokedAt: { lt: oldRevokedCutoff },
        },
      });

      const totalDeleted = expiredResult.count + oldRevokedResult.count;

      if (totalDeleted > 0) {
        logger.info(
          {
            operationType: 'CLEANUP',
            metadata: {
              expiredOrRevoked: expiredResult.count,
              oldRevoked: oldRevokedResult.count,
              totalDeleted,
            },
          },
          'Expired / revoked sessions cleaned up'
        );
      }

      return totalDeleted;
    } catch (error) {
      logger.error(
        {
          operationType: 'CLEANUP_ERROR',
          task: 'expired-sessions',
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to clean up expired sessions'
      );
      return 0;
    }
  }
}

export const sessionDeviceService = new SessionDeviceService();
export default sessionDeviceService;
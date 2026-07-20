/**
 * @file src/modules/auth/services/session.service.ts
 * @description
 * Session Management Service for UjamaaDAO
 *
 * RESPONSIBILITY:
 * Manages the complete lifecycle of user sessions - creation, validation,
 * revocation, and cleanup. Sessions are stored in the database and tracked
 * with unique tokens for security and auditability.
 *
 * WHY SESSIONS EXIST:
 * - JWTs are stateless and can't be revoked until expiry
 * - Sessions allow instant logout/revocation across all devices
 * - Track active devices and security events
 * - Enforce max concurrent sessions per user
 * - Provide audit trail of login activity
 *
 * SESSION LIFECYCLE:
 * 1. User authenticates (magic link, wallet, phone) → createSession()
 * 2. Every API request → validateSession() updates lastActive
 * 3. User logs out → revokeSession() marks session as revoked
 * 4. User logs out everywhere → revokeAllUserSessions()
 * 5. Periodic cleanup → cleanupExpiredSessions() removes old data
 *
 * SECURITY FEATURES:
 * - Device fingerprinting (IP, user agent, device info)
 * - Automatic session expiry (180 days default)
 * - Revocation support (instant logout)
 * - Max sessions per user (prevent account sharing)
 * - Activity tracking (detect inactive sessions)
 * - Audit logging for all session operations
 *
 * INTEGRATION:
 * - Used by: auth.service.ts, wallet.service.ts, phone.service.ts
 * - Depends on: Prisma client, logger, event bus
 * - Called from: auth.middleware.ts (session validation on every request)
 *
 * DATABASE SCHEMA:
 * Session {
 *   id: string (UUID)
 *   userId: string (foreign key to User)
 *   token: string (96-char hex, unique, indexed)
 *   deviceInfo?: string (device fingerprint)
 *   ipAddress?: string (IP at login)
 *   userAgent?: string (browser/app info)
 *   expiresAt: DateTime (auto-cleanup after this)
 *   revoked: boolean (manual logout)
 *   lastActive: DateTime (updated on every request)
 *   createdAt: DateTime
 *   updatedAt: DateTime
 * }
 *
 * PERFORMANCE NOTES:
 * - Session lookup is by indexed token (O(1) database query)
 * - Session validation runs on EVERY authenticated request
 * - Keep this service fast - no N+1 queries, no heavy operations
 * - Consider Redis caching for ultra-high traffic (future enhancement)
 *
 * Version: 2.1 — January 2026
 * Security Hardened: January 2026
 */

import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { eventBus } from '../../../core/utils/eventBus.js';
import { generateRandomHex } from '../../../core/utils/crypto.js';
import { env } from '../../../core/utils/env.js';

/**
 * Context information captured when creating a session.
 * Used for security monitoring and device tracking.
 */
export interface SessionContext {
  ipAddress?: string; // User's IP address at login
  userAgent?: string; // Browser/app user agent string
  deviceInfo?: string; // Optional device fingerprint/identifier
}

/**
 * Session data returned to clients (safe subset of DB fields).
 * Never expose the session token to clients - it's used internally only.
 */
export interface SessionInfo {
  id: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActive: Date;
  expiresAt: Date;
  revoked: boolean;
}

/**
 * Configuration for session behavior.
 * Override via environment variables for different environments.
 */
const SESSION_CONFIG = {
  // How long sessions last before expiring (milliseconds)
  expiryMs: 180 * 24 * 60 * 60 * 1000, // 180 days (matches JWT expiry)

  // Maximum concurrent sessions per user (0 = unlimited)
  maxSessionsPerUser: env.MAX_ACTIVE_SESSIONS_PER_USER,

  // How old revoked sessions must be before deletion (days)
  revokedSessionRetentionDays: 30,

  // Length of session token (bytes, will be 2x in hex)
  tokenLength: 48, // 96 characters hex
};

class SessionService {
  /**
   * Create a new session for a user after successful authentication.
   *
   * WHEN TO CALL:
   * - After magic link verification (auth.service.ts)
   * - After wallet signature verification (wallet.service.ts)
   * - After phone code verification (phone.service.ts)
   *
   * WHAT IT DOES:
   * 1. Generates cryptographically secure session token
   * 2. Enforces max sessions limit (revokes oldest if exceeded)
   * 3. Stores session in database with device context
   * 4. Returns both DB record and token (for JWT embedding)
   * 5. Logs session creation for audit trail
   * 6. Publishes event for analytics/monitoring
   *
   * SECURITY:
   * - Token is 96-char hex (384 bits of entropy)
   * - Token is unique (DB constraint prevents duplicates)
   * - Old sessions auto-revoked if limit exceeded
   * - All session data logged for forensics
   *
   * @param userId - ID of user who just authenticated
   * @param context - Device/network information for tracking
   * @param correlationId - Request correlation ID for logging
   * @returns Session record and token (token must be embedded in JWT)
   *
   * @throws ApiError.systemError - If session creation fails
   *
   * @example
   * const { session, token } = await sessionService.createSession(
   *   user.id,
   *   { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
   * );
   * // Embed session.id in JWT payload
   * const jwt = signJwtToken({ ...payload, sessionId: session.id });
   */
  async createSession(
    userId: string,
    context: SessionContext = {},
    correlationId?: string
  ): Promise<{ session: SessionInfo; token: string }> {
    try {
      // Generate cryptographically secure token
      const token = generateRandomHex(SESSION_CONFIG.tokenLength);
      const expiresAt = new Date(Date.now() + SESSION_CONFIG.expiryMs);

      // Enforce max sessions limit
      if (SESSION_CONFIG.maxSessionsPerUser > 0) {
        await this.enforceSessionLimit(userId);
      }

      // Create session in database
      const session = await prisma.session.create({
        data: {
          userId,
          token,
          deviceInfo: context.deviceInfo,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          expiresAt,
          lastActive: new Date(),
          revoked: false,
        },
      });

      logger.info(
        {
          operationType: 'AUTH',
          userId,
          metadata: {
            sessionId: session.id,
            deviceInfo: context.deviceInfo,
            ipAddress: context.ipAddress,
            correlationId,
          },
        },
        'Session created successfully'
      );

      eventBus.publish('session.created', {
        userId,
        sessionId: session.id,
        deviceInfo: context.deviceInfo,
      });

      return {
        session: this.toSessionInfo(session),
        token,
      };
    } catch (error) {
      logger.error(
        {
          operationType: 'AUTH',
          userId,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            correlationId,
          },
        },
        'Failed to create session'
      );

      throw ApiError.systemError(
        'Failed to create session',
        { reason: 'session_creation_failed' },
        correlationId
      );
    }
  }

  /**
   * Validate a session by its ID.
   *
   * WHEN TO CALL:
   * - On EVERY authenticated API request (via auth.middleware.ts)
   * - Before performing sensitive operations
   *
   * WHAT IT DOES:
   * 1. Looks up session by ID
   * 2. Checks if session exists, not revoked, not expired
   * 3. Updates lastActive timestamp (tracks session activity)
   * 4. Returns validation result
   *
   * PERFORMANCE:
   * - Runs on every request - must be fast!
   * - Uses indexed lookup (session.id is primary key)
   * - Single database query
   * - Consider Redis caching if this becomes bottleneck
   *
   * @param sessionId - Session ID from JWT payload
   * @returns true if session is valid and active, false otherwise
   *
   * @example
   * // In auth.middleware.ts after JWT verification
   * const isValid = await sessionService.validateSession(payload.sessionId);
   * if (!isValid) {
   *   throw ApiError.authenticationError("Session has been revoked");
   * }
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      // Session not found, revoked, or expired
      if (!session || session.revoked || session.expiresAt < new Date()) {
        return false;
      }

      // Update last active timestamp (asynchronously, don't block request)
      this.updateLastActive(sessionId).catch((error) => {
        logger.warn(
          {
            operationType: 'AUTH',
            metadata: { sessionId, error: error.message },
          },
          'Failed to update session lastActive'
        );
      });

      return true;
    } catch (error) {
      logger.error(
        {
          operationType: 'AUTH',
          metadata: {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Session validation failed'
      );
      return false; // Fail closed - deny access on error
    }
  }

  /**
   * Revoke a specific session (logout from one device).
   *
   * WHEN TO CALL:
   * - User clicks "Logout" button
   * - User wants to remove a specific device
   * - Security event detected (suspicious activity)
   *
   * WHAT IT DOES:
   * 1. Marks session as revoked in database
   * 2. Updates updatedAt timestamp
   * 3. Logs revocation event
   * 4. Publishes logout event
   *
   * SECURITY:
   * - Verifies session belongs to user (prevents session hijacking)
   * - Logs all revocations for audit trail
   * - Instant - JWT becomes invalid on next validation
   *
   * @param sessionId - ID of session to revoke
   * @param userId - ID of user (ensures user owns this session)
   * @param correlationId - Request correlation ID
   *
   * @throws ApiError.notFound - If session doesn't exist or doesn't belong to user
   *
   * @example
   * await sessionService.revokeSession(sessionId, req.user.userId);
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    correlationId?: string
  ): Promise<void> {
    // Verify session exists and belongs to user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw ApiError.notFound('Session', sessionId, correlationId);
    }

    // Mark as revoked
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        revoked: true,
        updatedAt: new Date(),
      },
    });

    logger.info(
      {
        operationType: 'AUTH',
        userId,
        metadata: { sessionId, correlationId },
      },
      'Session revoked successfully'
    );

    eventBus.publish('auth.logout', { userId, sessionId });
  }

  /**
   * Revoke all sessions for a user (logout from all devices).
   *
   * WHEN TO CALL:
   * - User clicks "Logout from all devices"
   * - Password/security settings changed
   * - Account compromised (security response)
   * - User wants fresh start
   *
   * WHAT IT DOES:
   * 1. Finds all active sessions for user
   * 2. Marks them all as revoked (except optionally one current session)
   * 3. Logs mass revocation event
   * 4. Publishes event for monitoring
   *
   * SECURITY:
   * - Immediate effect - all JWTs invalid on next request
   * - Optional "except current" to keep one device logged in
   * - Logged for audit (detect if malicious actor uses this)
   *
   * @param userId - ID of user whose sessions to revoke
   * @param exceptSessionId - Optional session ID to keep active (current device)
   * @param correlationId - Request correlation ID
   * @returns Number of sessions revoked
   *
   * @example
   * // Logout from all devices
   * const count = await sessionService.revokeAllUserSessions(user.id);
   *
   * // Logout from all OTHER devices (keep current)
   * const count = await sessionService.revokeAllUserSessions(
   *   user.id,
   *   currentSessionId
   * );
   */
  async revokeAllUserSessions(
    userId: string,
    exceptSessionId?: string,
    correlationId?: string
  ): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        id: exceptSessionId ? { not: exceptSessionId } : undefined,
        revoked: false, // Only revoke active sessions
      },
      data: {
        revoked: true,
        updatedAt: new Date(),
      },
    });

    logger.info(
      {
        operationType: 'AUTH',
        userId,
        metadata: {
          revokedCount: result.count,
          exceptSessionId,
          correlationId,
        },
      },
      'All user sessions revoked'
    );

    eventBus.publish('auth.logout.all', {
      userId,
      exceptSessionId,
      revokedCount: result.count,
    });

    return result.count;
  }

  /**
   * Get all active sessions for a user (for security dashboard).
   *
   * WHEN TO CALL:
   * - User views "Active Sessions" page
   * - Security audit/review
   *
   * WHAT IT RETURNS:
   * List of sessions with device info, last activity, location (safe fields only).
   * NEVER returns session tokens - those are secrets.
   *
   * @param userId - ID of user
   * @returns Array of active session info (sorted by most recent activity)
   *
   * @example
   * const sessions = await sessionService.getUserSessions(user.id);
   * // Returns: [{ id, deviceInfo, ipAddress, lastActive, ... }]
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActive: 'desc' },
    });

    return sessions.map((s) => this.toSessionInfo(s));
  }

  /**
   * Cleanup expired and old revoked sessions (cron job).
   *
   * WHEN TO CALL:
   * - Daily cron job
   * - Server startup (optional housekeeping)
   *
   * WHAT IT DOES:
   * 1. Deletes expired sessions (expiresAt < now)
   * 2. Deletes old revoked sessions (revoked + older than retention period)
   *
   * WHY DELETE:
   * - Keep database clean
   * - Improve query performance
   * - Comply with data retention policies
   * - Reduce storage costs
   *
   * WHY KEEP REVOKED SESSIONS TEMPORARILY:
   * - Audit trail (security investigations)
   * - Analytics (session duration, device usage)
   *
   * @returns Number of sessions deleted
   *
   * @example
   * // In cron job or startup script
   * const deleted = await sessionService.cleanupExpiredSessions();
   * logger.info(`Cleaned up ${deleted} expired sessions`);
   */
  async cleanupExpiredSessions(): Promise<number> {
    const retentionDate = new Date(
      Date.now() -
        SESSION_CONFIG.revokedSessionRetentionDays * 24 * 60 * 60 * 1000
    );

    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          // Delete expired sessions
          { expiresAt: { lt: new Date() } },
          // Delete old revoked sessions (past retention period)
          {
            revoked: true,
            updatedAt: { lt: retentionDate },
          },
        ],
      },
    });

    logger.info(
      {
        operationType: 'AUTH',
        metadata: { deletedCount: result.count },
      },
      'Expired sessions cleaned up'
    );

    return result.count;
  }

  /**
   * PRIVATE: Enforce maximum sessions per user.
   * Revokes oldest sessions if limit exceeded.
   * Called internally by createSession().
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await prisma.session.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActive: 'asc' }, // Oldest first
    });

    const excessCount =
      activeSessions.length - (SESSION_CONFIG.maxSessionsPerUser - 1);

    if (excessCount > 0) {
      const sessionsToRevoke = activeSessions.slice(0, excessCount);
      const idsToRevoke = sessionsToRevoke.map((s) => s.id);

      await prisma.session.updateMany({
        where: { id: { in: idsToRevoke } },
        data: { revoked: true, updatedAt: new Date() },
      });

      logger.info(
        {
          operationType: 'AUTH',
          userId,
          metadata: { revokedCount: excessCount },
        },
        'Excess sessions revoked due to limit'
      );
    }
  }

  /**
   * PRIVATE: Update session's lastActive timestamp.
   * Called asynchronously by validateSession() to avoid blocking requests.
   */
  private async updateLastActive(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastActive: new Date() },
    });
  }

  /**
   * PRIVATE: Convert Prisma Session to safe SessionInfo (no token).
   */
  private toSessionInfo(session: any): SessionInfo {
    return {
      id: session.id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastActive: session.lastActive,
      expiresAt: session.expiresAt,
      revoked: session.revoked,
    };
  }
}

// Export singleton instance
export const sessionService = new SessionService();

/**
 * CRON JOB SETUP:
 * Schedule this cleanup to run daily:
 *
 * // In your main server file or cron setup
 * import { sessionService } from './modules/auth/services/session.service.js';
 *
 * // Run daily at 3 AM
 * cron.schedule('0 3 * * *', async () => {
 *   await sessionService.cleanupExpiredSessions();
 * });
 */

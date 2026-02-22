/**
 * @file src/modules/auth/services/security-events.service.ts
 * @description
 * Security Events Service - Log and track suspicious activity
 * 
 * Features:
 * - Log security events (failed logins, 2FA changes, password resets)
 * - Detect anomalies (unusual IPs, concurrent logins, brute force)
 * - Alert users of suspicious activity
 * - Provide security dashboard data
 * 
 * Version: 1.0 — January 2026
 */

import { prisma } from "../../../core/database/client.js";
import { logger } from "../../../core/logger/logger.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { eventBus } from "../../../core/utils/eventBus.js";

export type SecurityEventType =
  | "login_failed"
  | "login_success"
  | "password_reset_requested"
  | "password_reset_completed"
  | "2fa_enabled"
  | "2fa_disabled"
  | "2fa_failed"
  | "wallet_linked"
  | "wallet_disconnected"
  | "session_revoked"
  | "suspicious_login"
  | "brute_force_detected"
  | "account_locked";

export type SecurityEventSeverity = "low" | "medium" | "high" | "critical";

export interface SecurityEventData {
  userId?: string;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  details?: Record<string, any>;
}

class SecurityEventsService {
  /**
   * Log a security event
   */
  async logEvent(data: SecurityEventData): Promise<void> {
    try {
      const event = await prisma.securityEvent.create({
        data: {
          userId: data.userId || null,
          eventType: data.eventType,
          severity: data.severity,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          location: data.location,
          metadata: data.details || {},
          resolved: false,
        },
      });

      // Log high/critical events
      if (data.severity === "high" || data.severity === "critical") {
        logger.warn(
          {
            operationType: "SECURITY",
            userId: data.userId,
            metadata: {
              eventId: event.id,
              eventType: data.eventType,
              severity: data.severity,
              ipAddress: data.ipAddress,
            },
          },
          `Security event: ${data.eventType}`
        );

        // Publish event for real-time alerts
        eventBus.publish("security.event", {
          eventId: event.id,
          userId: data.userId,
          eventType: data.eventType,
          severity: data.severity,
        });

        // TODO: Send email/SMS alert for critical events
        if (data.severity === "critical" && data.userId) {
          await this.sendSecurityAlert(data.userId, data.eventType);
        }
      }
    } catch (error) {
      logger.error(
        {
          operationType: "DATABASE",
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        "Failed to log security event"
      );
    }
  }

  /**
   * Get security events for a user
   */
  async getUserEvents(
    userId: string,
    limit = 50
  ): Promise<any[]> {
    try {
      const events = await prisma.securityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return events;
    } catch (error) {
      logger.error(
        {
          operationType: "DATABASE",
          userId,
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        "Failed to get user security events"
      );
      throw ApiError.systemError("Failed to retrieve security events");
    }
  }

  /**
   * Detect brute force attempts
   */
  async detectBruteForce(
    identifier: string, // email, phone, or wallet
    ipAddress: string
  ): Promise<boolean> {
    try {
      // Count failed login attempts in last 15 minutes
      const recentFailures = await prisma.securityEvent.count({
        where: {
          eventType: "login_failed",
          ipAddress,
          createdAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000),
          },
        },
      });

      // 5+ failed attempts = brute force
      if (recentFailures >= 5) {
        await this.logEvent({
          eventType: "brute_force_detected",
          severity: "critical",
          ipAddress,
          details: {
            identifier,
            failedAttempts: recentFailures,
          },
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        {
          operationType: "DATABASE",
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        "Failed to detect brute force"
      );
      return false;
    }
  }

  /**
   * Detect suspicious login (new location, new device, etc.)
   */
  async detectSuspiciousLogin(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    try {
      // Get user's login history
      const recentLogins = await prisma.securityEvent.findMany({
        where: {
          userId,
          eventType: "login_success",
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        select: {
          ipAddress: true,
          userAgent: true,
        },
      });

      // Check if IP or user agent is new
      const knownIPs = new Set(recentLogins.map((l) => l.ipAddress).filter(Boolean));
      const knownUserAgents = new Set(recentLogins.map((l) => l.userAgent).filter(Boolean));

      const isNewIP = ipAddress && !knownIPs.has(ipAddress);
      const isNewDevice = userAgent && !knownUserAgents.has(userAgent);

      // New IP + new device = suspicious
      if (isNewIP && isNewDevice && recentLogins.length > 0) {
        await this.logEvent({
          userId,
          eventType: "suspicious_login",
          severity: "high",
          ipAddress,
          userAgent,
          details: {
            reason: "New IP and device",
            knownIPCount: knownIPs.size,
            knownDeviceCount: knownUserAgents.size,
          },
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        {
          operationType: "DATABASE",
          userId,
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        "Failed to detect suspicious login"
      );
      return false;
    }
  }

  /**
   * Mark event as resolved
   */
  async resolveEvent(eventId: string, resolvedBy: string): Promise<void> {
    try {
      await prisma.securityEvent.update({
        where: { id: eventId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy,
        },
      });

      logger.info(
        {
          operationType: "SECURITY",
          metadata: { eventId, resolvedBy },
        },
        "Security event resolved"
      );
    } catch (error) {
      logger.error(
        {
          operationType: "DATABASE",
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        "Failed to resolve security event"
      );
      throw ApiError.systemError("Failed to resolve event");
    }
  }

  /**
   * Get unresolved events (for admin dashboard)
   */
  async getUnresolvedEvents(limit = 100): Promise<any[]> {
    try {
      const events = await prisma.securityEvent.findMany({
        where: { resolved: false },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      return events;
    } catch (error) {
      logger.error(
        {
          operationType: "DATABASE",
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        "Failed to get unresolved events"
      );
      throw ApiError.systemError("Failed to retrieve events");
    }
  }

  /**
   * Send security alert to user
   */
  private async sendSecurityAlert(
    userId: string,
    eventType: SecurityEventType
  ): Promise<void> {
    // TODO: Implement email/SMS alerts
    logger.info(
      {
        operationType: "SECURITY",
        userId,
        metadata: { eventType },
      },
      "Security alert triggered (email/SMS not yet implemented)"
    );

    // Publish event for real-time notifications
    eventBus.publish("security.alert", {
      userId,
      eventType,
      timestamp: new Date(),
    });
  }

  /**
   * Clean up old resolved events (cron job)
   */
  async cleanupOldEvents(): Promise<number> {
    try {
      // Delete resolved events older than 90 days
      const result = await prisma.securityEvent.deleteMany({
        where: {
          resolved: true,
          resolvedAt: {
            lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (result.count > 0) {
        logger.info(
          {
            operationType: "GENERAL",
            metadata: { deletedCount: result.count },
          },
          "Old security events cleaned up"
        );
      }

      return result.count;
    } catch (error) {
      logger.error(
        {
          operationType: "DATABASE",
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        "Failed to cleanup old events"
      );
      return 0;
    }
  }
}

export const securityEventsService = new SecurityEventsService();
export default securityEventsService;
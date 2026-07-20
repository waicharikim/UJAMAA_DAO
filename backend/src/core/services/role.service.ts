/**
 * @file src/core/services/role.service.ts
 * @description
 * Scoped Role Checks — Distributed RBAC with caching
 *
 * Security Features:
 * - Input validation
 * - Query timeouts
 * - Error handling
 * - Result caching
 * - Logging
 *
 * Version: 2.1 — January 2026
 * Security Hardened: January 2026
 */

import { prisma } from '../database/client.js';
import { logger } from '../logger/logger.js';

// Simple in-memory cache (use Redis in production for multi-server)
interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

class RoleService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly QUERY_TIMEOUT = 5000; // 5 seconds

  /**
   * Validate UUID format (prevent injection)
   */
  private isValidUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    );
  }

  /**
   * Validate role name (prevent injection)
   */
  private isValidRole(role: string): boolean {
    return /^[A-Z_]{2,50}$/i.test(role);
  }

  /**
   * Get cached result or execute query
   */
  private async getCached<T>(
    key: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    try {
      const result = await Promise.race([
        queryFn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Query timeout')),
            this.QUERY_TIMEOUT
          )
        ),
      ]);

      // Cache boolean results only
      if (typeof result === 'boolean') {
        this.cache.set(key, {
          value: result,
          expiresAt: Date.now() + this.CACHE_TTL,
        });
      }

      return result;
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          metadata: {
            cacheKey: key,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Role check query failed'
      );
      throw error;
    }
  }

  /**
   * Clear cache entry
   */
  private clearCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries for a user (call on role changes)
   */
  clearUserCache(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`user:${userId}:`)) {
        this.cache.delete(key);
      }
    }

    logger.debug(
      {
        operationType: 'GENERAL',
        userId,
      },
      'Cleared role cache for user'
    );
  }

  /**
   * Check if user has role in specific group
   * @param userId - The ID of the user
   * @param groupId - The ID of the group
   * @param role - The role to check for
   * @returns Promise resolving to true if the user has the role
   */
  async hasGroupRole(
    userId: string,
    groupId: string,
    role: string
  ): Promise<boolean> {
    if (!this.isValidUuid(userId) || !this.isValidUuid(groupId)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { groupId, role, reason: 'Invalid UUID format' },
        },
        'Role check rejected - invalid UUID'
      );
      return false;
    }

    if (!this.isValidRole(role)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { groupId, role, reason: 'Invalid role format' },
        },
        'Role check rejected - invalid role'
      );
      return false;
    }

    const cacheKey = `user:${userId}:group:${groupId}:role:${role}`;

    return this.getCached(cacheKey, async () => {
      try {
        const membership = await prisma.groupMember.findUnique({
          where: { userId_groupId: { userId, groupId } },
          select: { role: true },
        });

        const hasRole = membership?.role === role;

        logger.debug(
          {
            operationType: 'AUTHORIZATION',
            userId,
            metadata: { groupId, role, hasRole },
          },
          'Group role checked'
        );

        return hasRole;
      } catch (error) {
        logger.error(
          {
            operationType: 'DATABASE',
            userId,
            metadata: {
              groupId,
              role,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'Failed to check group role'
        );
        return false;
      }
    });
  }

  /**
   * Check if user has location role (ward_admin, etc.)
   * @param userId - The ID of the user
   * @param wardId - The ID of the ward
   * @param role - The role to check for
   * @returns Promise resolving to true if the user has the role
   */
  async hasLocationRole(
    userId: string,
    wardId: string,
    role: string
  ): Promise<boolean> {
    if (!this.isValidUuid(userId) || !this.isValidUuid(wardId)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { wardId, role, reason: 'Invalid UUID format' },
        },
        'Location role check rejected - invalid UUID'
      );
      return false;
    }

    if (!this.isValidRole(role)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { wardId, role, reason: 'Invalid role format' },
        },
        'Location role check rejected - invalid role'
      );
      return false;
    }

    const cacheKey = `user:${userId}:ward:${wardId}:role:${role}`;

    return this.getCached(cacheKey, async () => {
      try {
        const group = await prisma.group.findFirst({
          where: { locationScope: 'WARD', wardId },
          select: { id: true },
        });

        if (!group) {
          logger.debug(
            {
              operationType: 'GEOGRAPHIC',
              userId,
              metadata: { wardId, reason: 'No group for ward' },
            },
            'Location role check - no group found'
          );
          return false;
        }

        return this.hasGroupRole(userId, group.id, role);
      } catch (error) {
        logger.error(
          {
            operationType: 'DATABASE',
            userId,
            metadata: {
              wardId,
              role,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'Failed to check location role'
        );
        return false;
      }
    });
  }

  /**
   * Check if user is project leader
   * @param userId - The ID of the user
   * @param projectId - The ID of the project
   * @returns Promise resolving to true if the user is the project leader
   */
  async isProjectLeader(userId: string, projectId: string): Promise<boolean> {
    if (!this.isValidUuid(userId) || !this.isValidUuid(projectId)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { projectId, reason: 'Invalid UUID format' },
        },
        'Project leader check rejected - invalid UUID'
      );
      return false;
    }

    const cacheKey = `user:${userId}:project:${projectId}:leader`;

    return this.getCached(cacheKey, async () => {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { ownerUserId: true },
        });

        const isLeader = project?.ownerUserId === userId;

        logger.debug(
          {
            operationType: 'AUTHORIZATION',
            userId,
            metadata: { projectId, isLeader },
          },
          'Project leader checked'
        );

        return isLeader;
      } catch (error) {
        logger.error(
          {
            operationType: 'DATABASE',
            userId,
            metadata: {
              projectId,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'Failed to check project leader'
        );
        return false;
      }
    });
  }

  /**
   * Check if user is verifier (global or location-specific)
   * @param userId - The ID of the user
   * @param wardId - Optional ward ID for location-specific check
   * @returns Promise resolving to true if the user is a verifier
   */
  async isVerifier(userId: string, wardId?: string): Promise<boolean> {
    if (!this.isValidUuid(userId)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { wardId, reason: 'Invalid UUID format' },
        },
        'Verifier check rejected - invalid UUID'
      );
      return false;
    }

    if (wardId && !this.isValidUuid(wardId)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          userId,
          metadata: { wardId, reason: 'Invalid ward UUID format' },
        },
        'Verifier check rejected - invalid ward UUID'
      );
      return false;
    }

    const cacheKey = wardId
      ? `user:${userId}:ward:${wardId}:verifier`
      : `user:${userId}:verifier:global`;

    return this.getCached(cacheKey, async () => {
      try {
        const where: any = { userId, role: 'VERIFIER' };

        if (wardId) {
          where.group = { locationScope: 'WARD', wardId };
        }

        const membership = await prisma.groupMember.findFirst({
          where,
          select: { id: true },
        });

        const isVerifier = !!membership;

        logger.debug(
          {
            operationType: 'AUTHORIZATION',
            userId,
            metadata: { wardId: wardId || 'global', isVerifier },
          },
          'Verifier status checked'
        );

        return isVerifier;
      } catch (error) {
        logger.error(
          {
            operationType: 'DATABASE',
            userId,
            metadata: {
              wardId,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          'Failed to check verifier status'
        );
        return false;
      }
    });
  }

  /**
   * Get all roles for a user in a group
   * @param userId - The ID of the user
   * @param groupId - The ID of the group
   * @returns Promise resolving to array of roles
   */
  async getUserGroupRoles(userId: string, groupId: string): Promise<string[]> {
    if (!this.isValidUuid(userId) || !this.isValidUuid(groupId)) {
      return [];
    }

    try {
      const membership = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId } },
        select: { role: true },
      });

      return membership?.role ? [membership.role] : [];
    } catch (error) {
      logger.error(
        {
          operationType: 'DATABASE',
          userId,
          metadata: {
            groupId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        'Failed to get user group roles'
      );
      return [];
    }
  }

  /**
   * Periodic cache cleanup (call from cron job)
   */
  cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(
        {
          operationType: 'GENERAL',
          metadata: { cleaned, remaining: this.cache.size },
        },
        'Role cache cleanup completed'
      );
    }
  }
}

export const roleService = new RoleService();

// Cleanup cache every 5 minutes
setInterval(() => roleService.cleanupCache(), 5 * 60 * 1000);

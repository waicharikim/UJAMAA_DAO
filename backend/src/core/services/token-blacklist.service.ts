/**
 * @file src/core/services/token-blacklist.service.ts
 * @description
 * JWT Token Revocation Service with Redis backing and in-memory fallback
 * 
 * Enables instant logout by blacklisting JWT tokens before their natural expiry.
 * Uses Redis for distributed deployments, falls back to in-memory Set for dev/testing.
 * 
 * Version: 2.1 — January 2026
 * Security Hardened: January 2026
 */

import { createClient, RedisClientType } from 'redis';
import { env } from '../utils/env.js';
import { logger } from '../logger/logger.js';

class TokenBlacklistService {
  private client: RedisClientType | null = null;
  private readonly KEY_PREFIX = 'token:blacklist:';
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour
  
  // In-memory fallback when Redis is unavailable
  private fallbackSet = new Set<string>();
  
  /**
   * Initialize Redis connection or set up in-memory fallback
   */
  async initialize(): Promise<void> {
    if (!env.REDIS_URL) {
      logger.warn(
        { operationType: 'GENERAL' },
        'Redis URL not configured - using in-memory token blacklist (NOT for multi-server production)'
      );
      this.startFallbackCleanup();
      return;
    }
    
    try {
      this.client = createClient({ url: env.REDIS_URL });
      
      // Handle connection errors gracefully
      this.client.on('error', (err) => {
        logger.error(
          { 
            operationType: 'SYSTEM_ANOMALY',
            metadata: { error: err.message } 
          },
          'Redis client error - falling back to in-memory storage'
        );
      });
      
      await this.client.connect();
      
      logger.info(
        { operationType: 'GENERAL' },
        'Token blacklist service connected to Redis'
      );
    } catch (error) {
      logger.error(
        {
          operationType: 'SYSTEM_ANOMALY',
          metadata: { 
            error: error instanceof Error ? error.message : String(error) 
          },
        },
        'Failed to connect to Redis - using in-memory fallback'
      );
      this.startFallbackCleanup();
    }
  }
  
  /**
   * Revoke a JWT token by its JTI (JWT ID) claim
   * 
   * @param jti - The unique identifier from the JWT's jti claim
   * @param expiresAt - When the token naturally expires (for TTL calculation)
   */
  async revoke(jti: string, expiresAt: Date): Promise<void> {
    if (!jti || typeof jti !== 'string') {
      throw new Error('Invalid JTI for token revocation');
    }
    
    // Validate jti format (32-char hex from crypto.randomBytes(16))
    if (!/^[0-9a-f]{32}$/i.test(jti)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          metadata: { jti, reason: 'Invalid JTI format' },
        },
        'Token revocation rejected - invalid JTI'
      );
      throw new Error('Invalid JTI format');
    }
    
    // Calculate time-to-live in seconds
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    
    // Don't store already-expired tokens
    if (ttl <= 0) {
      logger.debug(
        { 
          operationType: 'GENERAL',
          metadata: { jti, reason: 'Already expired' } 
        },
        'Token revocation skipped - already expired'
      );
      return;
    }
    
    const key = this.KEY_PREFIX + jti;
    
    try {
      if (this.client?.isOpen) {
        // Store in Redis with automatic expiration matching token expiry
        await this.client.set(key, '1', { EX: ttl });
        
        logger.info(
          {
            operationType: 'SECURITY',
            metadata: { jti: jti.slice(0, 8) + '...', ttlSeconds: ttl },
          },
          'Token revoked successfully'
        );
      } else {
        // Fallback: store in memory and schedule cleanup
        this.fallbackSet.add(jti);
        setTimeout(() => this.fallbackSet.delete(jti), ttl * 1000);
        
        logger.warn(
          {
            operationType: 'GENERAL',
            metadata: { jti: jti.slice(0, 8) + '...', usingFallback: true },
          },
          'Token revoked using in-memory fallback'
        );
      }
    } catch (error) {
      logger.error(
        {
          operationType: 'SYSTEM_ANOMALY',
          metadata: { 
            error: error instanceof Error ? error.message : String(error) 
          },
        },
        'Failed to revoke token in Redis'
      );
      
      // Fall back to in-memory storage on Redis failure
      this.fallbackSet.add(jti);
      setTimeout(() => this.fallbackSet.delete(jti), ttl * 1000);
    }
  }
  
  /**
   * Check if a token has been revoked
   * 
   * @param jti - The JWT ID to check
   * @returns true if token is blacklisted, false otherwise
   */
  async isRevoked(jti: string): Promise<boolean> {
    if (!jti || typeof jti !== 'string') {
      return false; // Invalid JTI = not explicitly revoked
    }
    
    // Validate jti format
    if (!/^[0-9a-f]{32}$/i.test(jti)) {
      logger.warn(
        {
          operationType: 'SECURITY',
          metadata: { jti, reason: 'Invalid JTI format in check' },
        },
        'Revocation check skipped - invalid JTI format'
      );
      return false;
    }
    
    const key = this.KEY_PREFIX + jti;
    
    try {
      if (this.client?.isOpen) {
        const exists = await this.client.exists(key);
        return exists === 1;
      } else {
        // Check in-memory fallback
        return this.fallbackSet.has(jti);
      }
    } catch (error) {
      // CRITICAL: On Redis failure, we fail open (allow token) to avoid blocking valid users
      // BUT we log this as a security event for immediate investigation
      logger.error(
        {
          operationType: 'SYSTEM_ANOMALY',
          metadata: { 
            error: error instanceof Error ? error.message : String(error) 
          },
        },
        'Failed to check token revocation'
      );
      
      logger.warn(
        {
          operationType: 'SECURITY',
          metadata: { jti: jti.slice(0, 8) + '...' },
        },
        'Revocation check failed - ALLOWING token (investigate Redis immediately)'
      );
      
      return false;
    }
  }
  
  /**
   * Revoke all tokens for a user (logout from all devices)
   * 
   * @param userId - The user ID (for logging only)
   * @param tokens - Array of {jti, expiresAt} pairs to revoke
   */
  async revokeAllForUser(userId: string, tokens: Array<{ jti: string; expiresAt: Date }>): Promise<void> {
    logger.info(
      {
        operationType: 'SECURITY',
        userId,
        metadata: { tokenCount: tokens.length },
      },
      'Revoking all tokens for user (logout all devices)'
    );
    
    await Promise.all(
      tokens.map(({ jti, expiresAt }) => this.revoke(jti, expiresAt))
    );
  }
  
  /**
   * Periodic cleanup for in-memory fallback (just for monitoring)
   */
  private startFallbackCleanup(): void {
    setInterval(() => {
      logger.debug(
        {
          operationType: 'GENERAL',
          metadata: { entries: this.fallbackSet.size },
        },
        'In-memory token blacklist status'
      );
    }, this.CLEANUP_INTERVAL);
  }
  
  /**
   * Graceful shutdown - close Redis connection
   */
  async shutdown(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      logger.info({ operationType: 'GENERAL' }, 'Token blacklist service disconnected from Redis');
    }
  }
}

// Export singleton instance
export const tokenBlacklistService = new TokenBlacklistService();

// Initialize on module load
tokenBlacklistService.initialize().catch((error) => {
  logger.error(
    {
      operationType: 'SYSTEM_ANOMALY',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    },
    'Failed to initialize token blacklist service'
  );
});

export default tokenBlacklistService;
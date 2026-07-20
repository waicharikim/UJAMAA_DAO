/**
 * @file src/core/database/redis.client.ts
 * @description
 * Redis Client for UjamaaDAO
 *
 * Used for:
 * - Session caching (fast validation)
 * - Nonce storage (wallet auth)
 * - Rate limiting (distributed)
 * - Token blacklist (revocation)
 *
 * Gracefully falls back to in-memory storage if Redis unavailable.
 *
 * Version: 2.1 — January 2026
 */

import { createClient, RedisClientType } from 'redis';
import { env } from '../utils/env.js';
import { logger } from '../logger/logger.js';

let redisClient: RedisClientType | null = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
async function initializeRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    logger.warn(
      { operationType: 'GENERAL' },
      'REDIS_URL not configured - using in-memory fallbacks'
    );
    return;
  }

  try {
    redisClient = createClient({
      url: env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error(
              { operationType: 'GENERAL', metadata: { retries } },
              'Redis reconnection attempts exhausted'
            );
            return new Error('Redis reconnection failed');
          }
          // Exponential backoff: 100ms, 200ms, 400ms, ...
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error(
        { operationType: 'GENERAL', metadata: { error: err.message } },
        'Redis client error'
      );
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info({ operationType: 'GENERAL' }, 'Redis connecting...');
    });

    redisClient.on('ready', () => {
      logger.info({ operationType: 'GENERAL' }, 'Redis connection ready');
      isConnected = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn({ operationType: 'GENERAL' }, 'Redis reconnecting...');
      isConnected = false;
    });

    redisClient.on('end', () => {
      logger.info({ operationType: 'GENERAL' }, 'Redis connection closed');
      isConnected = false;
    });

    await redisClient.connect();
  } catch (error) {
    logger.error(
      {
        operationType: 'GENERAL',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
      'Failed to initialize Redis - falling back to in-memory storage'
    );
    redisClient = null;
    isConnected = false;
  }
}

/**
 * Get Redis client (or null if unavailable)
 */
export function getRedisClient(): RedisClientType | null {
  return isConnected ? redisClient : null;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info(
        { operationType: 'GENERAL' },
        'Redis connection closed gracefully'
      );
    } catch (error) {
      logger.error(
        { operationType: 'GENERAL', metadata: { error } },
        'Error closing Redis connection'
      );
    }
  }
}

// Initialize on module load
initializeRedis();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  await closeRedis();
});

process.on('SIGINT', async () => {
  await closeRedis();
});

export default {
  getRedisClient,
  isRedisAvailable,
  closeRedis,
};

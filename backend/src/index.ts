/**
 * @file src/index.ts
 * @description
 * UJAMAADAO Server Entry Point - 2026 ETERNAL
 * Starts the REST API server and coordinates async initialization
 *
 * IMPORTANT: All scheduled/background jobs now run in a separate worker process.
 * This file only starts the HTTP server.
 *
 * Version: 2.3 — February 2026
 * Updated: Docker compatibility improvements
 * Security Hardened: February 2026
 */

import './tracer.js';
import app, { servicesReady } from './app.js';
import { logger } from './core/logger/logger.js';
import { prisma } from './core/database/client.js';
import { verifyEmailConfig } from './core/utils/email.service.js';

// Environment & config
const PORT = Number(process.env.PORT) || 4000; // ← Changed from 8000 to match Docker
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Connect to database with retry logic
 * Helpful in Docker environments where Postgres might take a moment
 */
async function connectDatabase(maxRetries = 5, delay = 2000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      logger.info(
        { operationType: 'STARTUP' },
        'Database connected successfully'
      );
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        // Last attempt failed
        throw error;
      }
      logger.warn(
        {
          operationType: 'STARTUP',
          attempt: i + 1,
          maxRetries,
          retryInMs: delay,
        },
        `Database connection failed, retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Fail-fast environment checks. Throws in production when required vars are missing/insecure. */
function assertStartupRequirements(): void {
  if (!process.env.ENCRYPTION_KEY) {
    if (NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production');
    }
    logger.warn(
      { operationType: 'STARTUP' },
      'ENCRYPTION_KEY not set — crypto features will fail (acceptable in dev only)'
    );
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  if (NODE_ENV === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (
    NODE_ENV === 'production' &&
    jwtSecret ===
      '6e603cfa9affb7677020ad6a930bd3f076867ff38d100586dc5d985bed845ad0'
  ) {
    throw new Error(
      'JWT_SECRET is set to the insecure development default — set a unique secret in production'
    );
  }
}

function checkEmailConfig(): void {
  verifyEmailConfig()
    .then((isConfigured) => {
      if (isConfigured) {
        logger.info({ operationType: 'STARTUP' }, 'Email service configured');
      } else {
        logger.warn(
          { operationType: 'STARTUP' },
          'Email service NOT configured — magic links will not work'
        );
      }
    })
    .catch((err) => {
      logger.warn(
        { operationType: 'STARTUP', error: err.message },
        'Email config check failed (non-critical)'
      );
    });
}

async function closeRedisConnections(): Promise<void> {
  const { shutdownRateLimiter } = await import(
    './core/middleware/rateLimiter.js'
  );
  await shutdownRateLimiter();

  const { tokenBlacklistService } = await import(
    './core/services/token-blacklist.service.js'
  );
  await tokenBlacklistService.shutdown();

  const { redisConnection } = await import('./core/queue/index.js');
  await redisConnection.quit();

  logger.info({ operationType: 'SHUTDOWN' }, 'Redis connections closed');
}

async function gracefulShutdown(
  signal: string,
  server: ReturnType<typeof app.listen>
): Promise<void> {
  logger.info(
    { operationType: 'SHUTDOWN', signal },
    `${signal} received — initiating graceful shutdown`
  );

  const forceExitTimeout = setTimeout(() => {
    logger.error(
      { operationType: 'SHUTDOWN' },
      'Shutdown timeout — forcing exit'
    );
    process.exit(1);
  }, 15000).unref();

  server.close(() => {
    logger.info({ operationType: 'SHUTDOWN' }, 'HTTP server closed');
  });

  try {
    await closeRedisConnections();
  } catch (err) {
    logger.warn(
      { operationType: 'SHUTDOWN', error: String(err) },
      'Error closing Redis (may not be configured)'
    );
  }

  try {
    await prisma.$disconnect();
    logger.info({ operationType: 'SHUTDOWN' }, 'Database disconnected');
  } catch (err) {
    logger.error(
      { operationType: 'SHUTDOWN', error: String(err) },
      'Error disconnecting Prisma'
    );
  }

  clearTimeout(forceExitTimeout);
  logger.info({ operationType: 'SHUTDOWN' }, 'Graceful shutdown complete');
  process.exit(0);
}

async function startServer() {
  try {
    assertStartupRequirements();

    logger.info({ operationType: 'STARTUP' }, 'Waiting for async services...');
    await servicesReady;
    logger.info({ operationType: 'STARTUP' }, 'All async services ready');

    logger.info({ operationType: 'STARTUP' }, 'Connecting to database...');
    await connectDatabase();

    checkEmailConfig();

    const server = app.listen(PORT, () => {
      logger.info(
        {
          operationType: 'SERVER',
          metadata: {
            port: PORT,
            environment: NODE_ENV,
            nodeVersion: process.version,
            pid: process.pid,
          },
        },
        `🚀 UjamaaDAO REST API running on http://localhost:${PORT}`
      );
      logger.info(
        { operationType: 'SERVER' },
        `📚 API Documentation: http://localhost:${PORT}/api/v1/docs`
      );
      if (process.send) process.send('ready');
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
  } catch (error) {
    logger.error(
      {
        operationType: 'STARTUP_FAILURE',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Fatal startup error — exiting'
    );
    process.exit(1);
  }
}

// Start everything
startServer();

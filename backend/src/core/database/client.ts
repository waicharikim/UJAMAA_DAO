// src/core/database/client.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../utils/env.js';
import { logger } from '../logger/logger.js';

declare global {
  var prisma: PrismaClient | undefined;
  var dbPool: Pool | undefined;
}

// Vitest clears the module cache between test files but Node.js globals persist.
// Caching both pool and prisma in globals ensures we reuse the same connection pool
// across re-evaluations — preventing orphaned pool connections that accumulate and
// cause Postgres deadlocks when the TRUNCATE in testSetup.ts runs.
const isFirstInit = !global.dbPool;

// Create connection pool (or reuse cached one)
const pool = global.dbPool ?? new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

// Create adapter
const adapter = new PrismaPg(pool);

// Instantiate PrismaClient with adapter
export const prisma = global.prisma ?? new PrismaClient({ adapter });

// Cache pool and prisma for re-evaluations (hot reload in dev, Vitest between files)
if (env.NODE_ENV !== 'production') {
  global.dbPool = pool;
  global.prisma = prisma;
}

// Optional: Query logging in development
if (env.NODE_ENV === 'development' && process.env['LOG_QUERIES'] === 'true') {
  prisma.$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        const start = Date.now();
        const result = await query(args);
        const duration = Date.now() - start;
        logger.debug(
          {
            operationType: 'DB_QUERY',
            operation,
            duration: `${duration}ms`,
          },
          'Prisma query'
        );
        return result;
      },
    },
  });
}

// Note: prisma.$on('error') is not available with the PrismaPg adapter
// Error handling is done via pool error events and Prisma's built-in error handling

// Connect on startup
async function connectDB() {
  try {
    // The adapter handles connection via the pool
    await pool.query('SELECT 1');
    logger.info(
      { operationType: 'DATABASE' },
      'Connected to PostgreSQL via Prisma adapter'
    );
  } catch (err) {
    logger.error(
      { operationType: 'DATABASE' },
      'Failed to connect to database',
      err
    );
    process.exit(1);
  }
}

// Only connect on first initialization — skip on Vitest module re-evaluations
// where the pool is already live and accepting connections.
if (isFirstInit) {
  connectDB();
}

// Health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error(
      { operationType: 'HEALTH_CHECK' },
      'Database health check failed',
      error
    );
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info(
    { operationType: 'SHUTDOWN' },
    'SIGTERM received — shutting down...'
  );
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info(
    { operationType: 'SHUTDOWN' },
    'SIGINT received — shutting down...'
  );
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});

export default prisma;

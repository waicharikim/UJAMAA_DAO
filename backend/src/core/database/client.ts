// src/core/database/client.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../utils/env.js';
import { logger } from '../logger/logger.js';

declare global {
  var prisma: PrismaClient | undefined;
}

// Create connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// Create adapter
const adapter = new PrismaPg(pool);

// Instantiate PrismaClient with adapter
export const prisma = global.prisma || new PrismaClient({ adapter });

// Hot reload in dev
if (env.NODE_ENV !== 'production') {
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

connectDB();

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

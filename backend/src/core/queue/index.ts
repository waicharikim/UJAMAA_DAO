/**
 * @file src/core/queue/index.ts
 * @description
 * Central BullMQ queue setup, connection, and exports
 *
 * All queues are created and configured here.
 * Import queues from this file to add jobs or listen to events.
 *
 * Version: 1.2 — February 2026
 * Features: shared Redis connection, default job options, logging, dead-letter queue
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../logger/logger.js';

// ─────────────────────────────────────────────
// Shared Redis connection (used by all queues & workers)
// ─────────────────────────────────────────────

export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: null, // Recommended for BullMQ
  enableOfflineQueue: false, // Fail fast if Redis is down
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Log Redis connection issues
redisConnection.on('error', (err) => {
  logger.error(
    { operationType: 'REDIS', error: err.message },
    'Redis connection error'
  );
});

redisConnection.on('connect', () => {
  logger.info({ operationType: 'REDIS' }, 'Redis connected successfully');
});

// ─────────────────────────────────────────────
// Helper to create queues with consistent defaults
// ─────────────────────────────────────────────

export function createQueue<T = any>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: redisConnection,
    prefix: 'bull', // default prefix, can be changed if needed
    defaultJobOptions: {
      attempts: 5, // retry up to 5 times
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600 * 24 * 7 }, // 1 week
      removeOnFail: { count: 1000 }, // keep last 1000 failed jobs
    },
  });
}

// ─────────────────────────────────────────────
// Helper to create workers with logging
// ─────────────────────────────────────────────

export function createWorker<T = any>(
  queueName: string,
  processor: (job: any) => Promise<any>,
  options: any = {}
): Worker<T> {
  const worker = new Worker(queueName, processor, {
    connection: redisConnection,
    concurrency: options.concurrency || 5,
    autorun: true,
    ...options,
  });

  worker.on('completed', (job) => {
    logger.info(
      {
        operationType: 'BULLMQ_COMPLETED',
        queue: queueName,
        jobId: job.id,
        jobName: job.name,
        duration: job.processedOn ? Date.now() - job.processedOn : undefined,
      },
      'Job completed successfully'
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        operationType: 'BULLMQ_FAILED',
        queue: queueName,
        jobId: job?.id,
        jobName: job?.name,
        attempts: job?.attemptsMade,
        error: err.message,
        stack: err.stack,
      },
      'Job failed'
    );
  });

  worker.on('progress', (job, progress) => {
    logger.debug(
      {
        operationType: 'BULLMQ_PROGRESS',
        queue: queueName,
        jobId: job.id,
        progress,
      },
      'Job progress update'
    );
  });

  return worker;
}

// ─────────────────────────────────────────────
// All queues used in the system
// ─────────────────────────────────────────────

export const economyQueue = createQueue('economy');
export const userCleanupQueue = createQueue('user-cleanup');
export const integrationQueue = createQueue('integration');

// Dead-letter queue for permanently failed jobs (after max retries)
export const deadLetterQueue = createQueue('dead-letter');

// ─────────────────────────────────────────────
// Queue events (for monitoring or real-time alerts)
// ─────────────────────────────────────────────

export const economyQueueEvents = new QueueEvents('economy', {
  connection: redisConnection,
});

export const userCleanupQueueEvents = new QueueEvents('user-cleanup', {
  connection: redisConnection,
});

export const deadLetterQueueEvents = new QueueEvents('dead-letter', {
  connection: redisConnection,
});

// ─────────────────────────────────────────────
// Optional: global event listeners (example)
// ─────────────────────────────────────────────

economyQueueEvents.on(
  'failed' as any,
  ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    logger.warn(
      { operationType: 'QUEUE_EVENT', queue: 'economy', jobId, failedReason },
      'Job moved to failed state'
    );
  }
);

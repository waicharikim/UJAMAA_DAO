/**
 * @file logger.ts
 *
 * @description
 * Logger configuration using Pino.
 * - Structured and leveled logging.
 * - Pretty-printing in non-production environments.
 */

import pino from 'pino';

const logger = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
  level: process.env.LOG_LEVEL || 'info',
});

export default logger;
import pino from 'pino';

const logger = pino({
  prettyPrint: process.env.NODE_ENV !== 'production',
  level: process.env.LOG_LEVEL || 'info',
});

export default logger;
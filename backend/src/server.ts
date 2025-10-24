// src/server.ts (new or replace existing bottom of app.ts)
import app, { initRoles } from './app.js';
import prisma from './prismaClient.js';
import logger from './utils/logger.js';
import { startRoleSubscriberIfConfigured } from './utils/roleSubscriber.js'; // optional, see note below

const PORT = parseInt(process.env.PORT || '4000', 10);
const ROLE_LOAD_STRICT = (process.env.ROLE_LOAD_STRICT ?? 'true') === 'true';

async function start() {
  try {
    // Ensure DB connection (optional but helpful for clearer errors)
    await prisma.$connect();

    // Load dynamic roles and mount /metrics + /admin/roles routes
    try {
      await initRoles(prisma, app);
      logger.info('Dynamic roles loaded successfully');
    } catch (err) {
      logger.error('Failed to load dynamic roles at startup', { error: err });
      if (ROLE_LOAD_STRICT) {
        logger.error('ROLE_LOAD_STRICT=true — aborting startup');
        await prisma.$disconnect();
        process.exit(1);
      } else {
        logger.warn('Continuing startup without dynamic roles (ROLE_LOAD_STRICT=false)');
      }
    }

    // Optionally start a role subscriber (Redis or Postgres) for cross-instance reloads
    // Implement startRoleSubscriberIfConfigured to subscribe and call loadDynamicRoles on events.
    if ((process.env.ROLE_SUBSCRIBER_ENABLED ?? 'false') === 'true') {
      startRoleSubscriberIfConfigured(prisma).catch((e) => {
        logger.error('Role subscriber failed to start', { error: e });
      });
    }

    // Start HTTP server after roles (or controlled failure)
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server listening on http://0.0.0.0:${PORT}`);
    });

    // graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received - shutting down');
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    });

  } catch (err) {
    logger.error('Startup error', { error: err });
    try { await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  }
}

start();
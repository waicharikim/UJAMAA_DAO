/**
 * @file src/app.ts
 * @description
 * UJAMAADAO Express Application - Production Ready
 * 
 * Main Express app setup with strict middleware order.
 * Exports the app instance and a servicesReady promise for index.ts to await.
 * 
 * Middleware order (CRITICAL):
 * 1. Trust proxy
 * 2. Security (helmet, CORS)
 * 3. Body parsing
 * 4. Context initialization
 * 5. Logging & correlation
 * 6. Global rate limiting
 * 7. Routes
 * 8. Cleanup
 * 9. 404 handler
 * 10. Error handler
 * 
 * Version: 2.5 — February 2026
 * Updated: Removed cron registrations (moved to separate worker + BullMQ)
 * Security Hardened: February 2026
 */

import express, { RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { logger } from "./core/logger/logger.js";

// Database & services
import { prisma } from "./core/database/client.js";
import { redisInitialized } from "./core/middleware/rateLimiter.js";

// Event listeners
import { registerAllListeners } from "./core/events/listener-registry.js";

// Middleware
import { 
  contextMiddleware, 
  requestCleanupMiddleware,
} from "./core/middleware/context.middleware.js";
import { errorHandler, notFoundHandler } from "./core/middleware/errorHandler.js";
import { attachLogger, requestLogger } from "./core/middleware/logging.middleware.js";
import { globalRateLimit } from "./core/middleware/rateLimiter.js";

// Routes
import authRoutes from "./modules/auth/routes/auth.routes.js";
import userRoutes from "./modules/user/routes/user.routes.js";
import adminRoutes from "./modules/admin/routes/admin.routes.js";
import economyRoutes from "./modules/economy/routes/economy.routes.js";

// Bull Board dashboard
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { economyQueue, userCleanupQueue, deadLetterQueue } from "@core/queue/index.js";

const app = express();

// ============================================================================
// ASYNC SERVICE INITIALIZATION (exported for index.ts to await)
// ============================================================================

/**
 * Initialize all async dependencies (Redis, event listeners, etc.)
 * Called once at startup — index.ts awaits this before listening
 */
async function initializeServices(): Promise<void> {
  logger.info({ operationType: 'STARTUP' }, 'Initializing async services...');

  try {
    // 1. Wait for Redis (used by rate limiting, sessions, queues)
    await redisInitialized;
    logger.debug({ operationType: 'STARTUP' }, 'Redis connected');

   
    logger.info({ operationType: 'STARTUP' }, '✅ All async services initialized');
  } catch (error) {
    logger.error(
      {
        operationType: 'STARTUP_FAILURE',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      },
      '❌ Failed to initialize services'
    );
    throw error;
  }
}

export const servicesReady = initializeServices();

// ============================================================================
// 1. TRUST PROXY & SECURITY
// ============================================================================

app.set("trust proxy", 1); // Required for correct IP behind reverse proxy/load balancer

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: process.env.NODE_ENV === "production",
    hsts: process.env.NODE_ENV === "production",
  })
);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) || [
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Allow non-browser (Postman, curl, etc.)
      
      const isAllowed = 
        allowedOrigins.includes("*") ||
        allowedOrigins.some(allowed => origin === allowed || origin.endsWith(`.${allowed}`));

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(
          { operationType: 'CORS_BLOCKED', origin },
          'CORS request blocked - origin not allowed'
        );
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
    exposedHeaders: ["X-Correlation-ID"],
    maxAge: 86400,
  })
);

// ============================================================================
// 2. BODY PARSING
// ============================================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.disable("x-powered-by"); // Security: hide Express version

// ============================================================================
// 3. CONTEXT & LOGGING
// ============================================================================

app.use(contextMiddleware as RequestHandler);
app.use(attachLogger);
app.use(requestLogger);

// ============================================================================
// 4. GLOBAL RATE LIMITING
// ============================================================================

app.use(globalRateLimit());

// ============================================================================
// 5. HEALTH & ROOT ENDPOINTS (public)
// ============================================================================

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "ujamaadao-backend",
    version: "2.5",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
  });
});

app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      status: "ready",
      checks: { database: "connected" },
    });
  } catch (error) {
    logger.error(
      { operationType: 'READINESS_CHECK_FAILED', error: String(error) },
      'Readiness check failed'
    );
    res.status(503).json({
      success: false,
      status: "not ready",
      checks: { database: "disconnected" },
    });
  }
});

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to UjamaaDAO API",
    version: "2.5",
    documentation: "/api/v1/docs",
    status: "operational",
  });
});

// Placeholder API docs (replace with OpenAPI/Swagger later)
app.get("/api/v1/docs", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "API Documentation",
    version: "2.5",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      admin: "/api/v1/admin",
      economy: "/api/v1/economy",
      health: "/health",
      ready: "/ready",
    },
  });
});

// ============================================================================
// 6. API ROUTES (v1 namespace)
// ============================================================================

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/economy", economyRoutes);


// ─────────────────────────────────────────────
// BULL BOARD DASHBOARD — Visual queue monitoring
// ─────────────────────────────────────────────

// Install required packages first:
// npm install @bull-board/api @bull-board/express bull-board



// Simple basic auth middleware (change password in production!)
const requireDashboardAuth = (req: any, res: any, next: any) => {
  const auth = { login: 'admin', password: process.env.DASHBOARD_PASSWORD || 'YourVeryStrongPassword123!' };
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login === auth.login && password === auth.password) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin Queues"');
  res.status(401).send('Authentication required');
};

// Mount the dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(economyQueue),
    new BullMQAdapter(userCleanupQueue),
    new BullMQAdapter(deadLetterQueue),
  ],
  serverAdapter,
});

// Protect with basic auth and mount the route
app.use('/admin/queues', requireDashboardAuth, serverAdapter.getRouter());

logger.info(
  { operationType: "DASHBOARD" },
  "Bull Board dashboard enabled at /admin/queues (basic auth required)"
);

// ============================================================================
// 7. CLEANUP & ERROR HANDLING (MUST BE LAST)
// ============================================================================

app.use(requestCleanupMiddleware as RequestHandler);
app.use(notFoundHandler as RequestHandler);
app.use(errorHandler as any);

// ============================================================================
// EXPORTS
// ============================================================================

export default app;
/**
 * @file app.ts
 *
 * @description
 * Main Express app setup for UjamaaDAO backend.
 * Configures security, middleware, routing, and error handling.
 */

import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import userRoutes from './routes/user.routes.js';
import authRoutes from './routes/auth.routes.js';
import groupRoutes from './routes/group.routes.js';
import impactRoutes from './routes/impactPoint.routes.js';
import tokenRoutes from './routes/token.routes.js';
import proposalRoutes from './routes/proposal.routes.js';
import voteRoutes from './routes/vote.routes.js';
import projectRoutes from './routes/project.routes.js';
import milestoneRoutes from './routes/milestone.routes.js';
import referenceDataRoutes from './routes/referenceData.routes.js';
import userPrivacyRoutes from './routes/userPrivacy.routes.js';
import userAuditRoutes from './routes/userAudit.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import userConsentRoutes from './routes/userConsent.routes.js';
import userActivityRoutes from './routes/userActivity.routes.js';
import WalletRoutes from './routes/wallet.routes.js';

import logger from './utils/logger.js';

// New imports for role bootstrapping, metrics and admin routes
// Note: we import routers/handlers only — we do NOT call DB from this module.
import { loadDynamicRoles, addExtraAllowedRoles } from './constants/roles.js';
import adminRolesRouter from './routes/adminRoles.js';
import { metricsHandler } from './utils/metrics.js';

dotenv.config();

const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Set security-related HTTP headers via Helmet
app.use(helmet());

// HTTP request logging in combined Apache-style log format
app.use(morgan('combined'));

// Parse JSON payloads in incoming requests
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Mount reference data-related routes under /api/reference
app.use('/api/reference', referenceDataRoutes);

// Mount user-related routes under /api/users
app.use('/api/users', userRoutes);

// Mount wallet-related routes under /api/wallet
app.use('/api/wallet', WalletRoutes);

// Mount notification-related routes under /api/notifications
app.use('/api/notifications', notificationRoutes);

// Mount user consent-related routes under /api/user-consent
app.use('/api/user-consent', userConsentRoutes);

// Mount user activity-related routes under /api/user-activity
app.use('/api/user-activity', userActivityRoutes);

// Mount group-related routes under /api/groups
app.use('/api/groups', groupRoutes);

// Mount authentication routes under /api/auth
app.use('/api/auth', authRoutes);

// Mount impact-related routes under /api
app.use('/api', impactRoutes);

// Mount token-related routes under /api
app.use('/api', tokenRoutes);

// Mount proposal-related routes under /api/proposals
app.use('/api/proposals', proposalRoutes);

// Mount vote-related routes under /api/votes
app.use('/api/votes', voteRoutes);

// Mount project-related routes under /api/projects
app.use('/api/projects', projectRoutes);

// Mount milestone-related routes under /api/milestones
app.use('/api/milestones', milestoneRoutes);

// Mount user privacy-related routes under /api/user-privacy
app.use('/api/user-privacy', userPrivacyRoutes);

// Mount user audit-related routes under /api/user-audit
app.use('/api/user-audit', userAuditRoutes);

// Basic health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

/**
 * Metrics and admin routes:
 * - We export initRoles() below which will mount /metrics and /admin/roles (if enabled)
 * - We do NOT call loadDynamicRoles() automatically during import to keep tests and CI safe.
 */

// Optional: 404 Not Found handler for unmatched routes (kept)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Global error handler caught an error', {
    error: err,
  });

  let status = 500;
  let message = 'Internal Server Error';

  if (err && typeof err === 'object' && 'statusCode' in err && 'message' in err) {
    status = (err as any).statusCode ?? 500;
    message = (err as any).message ?? message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  res.status(status).json({ error: message });
});

export default app;

/**
 * initRoles
 *
 * Call this once during application startup (before app.listen).
 * - Loads dynamic roles from DB into the allowlist.
 * - Adds EXTRA_ALLOWED_ROLES from env.
 * - Mounts /metrics and /admin/roles if configured.
 *
 * We accept a prisma client so tests can pass a mock if needed.
 */
export async function initRoles(prismaClient: any, expressApp = app) {
  // Load roles from DB. Default: fail-fast (throw) so startup fails if DB unreachable.
  // If you prefer fallback behavior at startup, catch and handle here.
  await loadDynamicRoles(prismaClient);

  // Add any extras from env
  const extras = process.env.EXTRA_ALLOWED_ROLES?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (extras.length) addExtraAllowedRoles(extras);

  // Mount /metrics endpoint (public)
  expressApp.get('/metrics', metricsHandler);

  // Mount admin roles reload endpoint (requires Auth + attachUserRoles to have run on the request)
  if ((process.env.ROLE_ALLOWLIST_RELOAD_ENABLED ?? 'true') === 'true') {
    expressApp.use('/admin/roles', adminRolesRouter);
  }
}
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
import userPrivacyRoutes from './routes/userPrivacy.routes.js'; // Import user privacy routes
import userAuditRoutes from './routes/userAudit.routes.js'; // Import user audit routes
import notificationRoutes from './routes/notification.routes.js'; // Import notification routes
import userConsentRoutes from './routes/userConsent.routes.js'; // Import user consent routes
import userActivityRoutes from './routes/userActivity.routes.js'; // Import user activity routes
import WalletRoutes from './routes/wallet.routes.js'; // Import wallet routes

import logger from './utils/logger.js';  

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
app.use('/api/wallet', WalletRoutes); // Add this line to mount wallet routes

// Mount notification-related routes under /api/notifications
app.use('/api/notifications', notificationRoutes); // Add this line to mount notification routes

// Mount user consent-related routes under /api/user-consent
app.use('/api/user-consent', userConsentRoutes); // Add this line to mount user consent routes

// Mount user activity-related routes under /api/user-activity
app.use('/api/user-activity', userActivityRoutes); // Add this line to mount user activity routes

// Mount group-related routes under /api/groups
app.use('/api/groups', groupRoutes);

// Mount authentication routes under /api/auth
app.use('/api/auth', authRoutes);

// Mount impact-related routes under /api/impact
app.use('/api', impactRoutes);

// Mount token-related routes under /api/token
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
app.use('/api/user-privacy', userPrivacyRoutes); // Add this line to mount user privacy routes

// Mount user audit-related routes under /api/user-audit
app.use('/api/user-audit', userAuditRoutes); // Add this line to mount user audit routes


// Basic health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

// Optional: 404 Not Found handler for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});



// Global error handler middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Use your structured logger here
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
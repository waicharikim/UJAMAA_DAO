/**
 * @file app.ts
 *
 * @description
 * Main Express app setup for UjamaaDAO backend.
 * Configures security, middleware, routing, and error handling.
 */

import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import userRoutes from './routes/user.routes.js';
import authRoutes from './routes/auth.routes.js';
import groupRoutes from './routes/group.routes.js';

import logger from './utils/logger.js';  // <-- Import your logger

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

// Mount user-related routes under /api/users
app.use('/api/users', userRoutes);

// Mount group-related routes under /api/groups
app.use('/api/groups', groupRoutes);

// Mount authentication routes under /api/auth
app.use('/api/auth', authRoutes);

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
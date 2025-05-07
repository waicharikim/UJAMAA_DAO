/**
 * Entry point for UjamaaDAO backend API.
 * A simple Express server setup as a placeholder.
 * This will evolve to handle authentication, API routes, blockchain integration, etc.
 */

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 4000;

// Middleware for JSON parsing
app.use(express.json());

// Basic health check route
app.get('/health', (_req, res) => {
  res.status(200).send({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start listening on the configured port
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`UjamaaDAO backend server listening on port ${PORT}`);
});
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import userRoutes from './routes/user.routes.js';
import authRoutes from './routes/auth.routes.js';

dotenv.config();

const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Set security headers
app.use(helmet());

// Log HTTP requests
app.use(morgan('combined'));

// Parse JSON body requests
app.use(express.json());

// Mount user APIs under /api/users
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

// Mount auth APIs under /api/auth
app.use('/api/auth', authRoutes);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err); // You might want more advanced logging here

  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
});

export default app;
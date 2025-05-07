import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/user'; // Importing user routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware to parse JSON bodies
app.use(express.json());

// Register User routes under /api/users
app.use('/api/users', userRoutes);

/**
 * Health Check endpoint to verify server status.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`UjamaaDAO backend listening on port ${PORT}`);
});
import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/user.js'; // Importing user routes
import groupRoutes from './routes/group.js'; // Importing group routes
import proposalRoutes from './routes/proposal.js'; // Importing proposal routes
import voteRoutes from './routes/vote.js'; // Importing vote routes
import projectRoutes from './routes/project.js'; // Importing project routes


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware to parse JSON bodies
app.use(express.json());

// Register User routes under /api/users
app.use('/api/users', userRoutes);

// Register Group routes under /api/groups
app.use('/api/groups', groupRoutes);

// Register Proposal routes under /api/proposals
app.use('/api/proposals', proposalRoutes);

// Register Vote routes under /api/votes
app.use('/api/votes', voteRoutes);

// Register Project routes under /api/projects
app.use('/api/projects', projectRoutes);

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

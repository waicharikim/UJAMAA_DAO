import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createMilestoneHandler,
  submitMilestoneHandler,
  reviewMilestoneHandler,
} from '../controllers/milestone.controller.js';

const router = Router();

// Route: Create Milestone
router.post('/', authMiddleware, createMilestoneHandler);

// Route: Submit Milestone for Review
router.post('/submit', authMiddleware, submitMilestoneHandler);

// Route: Review Milestone (Approve/Reject)
router.post('/review', authMiddleware, reviewMilestoneHandler);

export default router;
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  createProposalHandler,
  updateProposalHandler,
  getProposalHandler,
} from '../controllers/proposal.controller.js';

const router = Router();

router.post('/', authMiddleware, createProposalHandler);
router.patch('/:id', authMiddleware, updateProposalHandler);
router.get('/:id', authMiddleware, getProposalHandler);

export default router;
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  castIndividualVoteHandler,
  castGroupVoteHandler,
  getVoteTallyHandler,
} from '../controllers/vote.controller.js';

const router = Router();

router.post('/individual', authMiddleware, castIndividualVoteHandler);
router.post('/group', authMiddleware, castGroupVoteHandler);
router.get('/:proposalId/tally', authMiddleware, getVoteTallyHandler);

export default router;
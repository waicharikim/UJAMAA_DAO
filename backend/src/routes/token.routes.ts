import express from 'express';
import * as impactController from '../controllers/tokenBalance.controller.js'; // You can rename the controller or split later
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Token balance endpoints
router.post('/token-balance', impactController.updateTokenBalanceHandler);
router.get('/token-balance', impactController.getTokenBalanceHandler);

export default router;
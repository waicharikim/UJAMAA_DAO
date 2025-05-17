import express from 'express';
import * as impactController from '../controllers/impactPoint.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Impact points endpoints
router.post('/impact-points', impactController.addImpactPointsHandler);
router.get('/impact-points', impactController.getImpactPointsHandler);

export default router;
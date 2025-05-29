/**
 * @file userConsent.routes.ts
 *
 * @description
 * Routes for managing user consents.
 * - All routes require authentication.
 */

import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import * as userConsentController from '../controllers/userConsent.controller.js';

const router = express.Router();

router.use(authMiddleware);

// Endpoint to record user consent
router.post('/consent', userConsentController.recordConsentHandler);

// Endpoint to retrieve all consents for the authenticated user
router.get('/consents', userConsentController.getUserConsentsHandler);

export default router;
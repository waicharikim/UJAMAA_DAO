/**
 * @file auth.routes.ts
 *
 * @description
 * Defines authentication-related API routes:
 * - Nonce retrieval for wallet-based login
 * - Signature verification to issue JWTs
 * - Routes for sending and verifying email verification tokens
 */

import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as emailVerificationController from '../controllers/emailVerification.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/auth/nonce
 * Retrieve or create a nonce for the given wallet address.
 */
router.get('/nonce', authController.getNonceHandler);

/**
 * POST /api/auth/verify
 * Verify wallet signature and authenticate user.
 */
router.post('/verify', authController.verifySignatureHandler);

/**
 * POST /api/auth/send-email-verification
 * Sends email verification link; requires authenticated user.
 */
router.post('/send-email-verification', authMiddleware, emailVerificationController.sendEmailVerificationHandler);

/**
 * POST /api/auth/verify-email
 * Verify user's email using provided token.
 */
router.post('/verify-email', emailVerificationController.verifyEmailHandler);

export default router;
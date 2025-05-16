import express from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = express.Router();

/**
 * GET /api/auth/nonce?walletAddress=0x...
 * Returns the current nonce for the wallet or creates a new user with a nonce.
 */
router.get('/nonce', authController.getNonceHandler);

/**
 * POST /api/auth/verify
 * Body: { walletAddress, signature }
 * Verifies the signed nonce and returns a JWT token on success.
 */
router.post('/verify', authController.verifySignatureHandler);

export default router;
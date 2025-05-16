/**
 * @file auth.routes.ts
 *
 * @description
 * Defines Express routes for authentication-related endpoints:
 * - GET /api/auth/nonce: Retrieve or create a nonce for wallet-based auth challenge
 * - POST /api/auth/verify: Verify signed nonce and issue JWT token
 */

import express from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = express.Router();

/**
 * GET /api/auth/nonce
 * Query Params:
 *  - walletAddress (string): the wallet address for which to get or create a nonce
 * Description:
 *  Returns the current nonce associated with the wallet address,
 *  creating a new user and nonce if none exists.
 */
router.get('/nonce', authController.getNonceHandler);

/**
 * POST /api/auth/verify
 * Body:
 *  - walletAddress (string): the wallet address of the user
 *  - signature (string): signature of the nonce by the wallet's private key
 * Description:
 *  Verifies the signed nonce to authenticate the user,
 *  returning a JWT token and the user info on success.
 */
router.post('/verify', authController.verifySignatureHandler);

export default router;
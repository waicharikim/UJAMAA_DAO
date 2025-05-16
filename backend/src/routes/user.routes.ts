/**
 * @file user.routes.ts
 * 
 * @description
 * Express router defining user-related API endpoints.
 * Includes:
 * - Public registration and wallet-based user lookup without authentication.
 * - Protected endpoints for fetching and updating the current user's profile.
 * 
 * Authentication middleware is applied to secure the protected routes.
 */

import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * POST /api/users
 * Public route to register a new user.
 */
router.post('/', userController.createUserHandler);

/**
 * GET /api/users/wallet/:walletAddress
 * Public route to fetch user details by their wallet address.
 */
router.get('/wallet/:walletAddress', userController.getUserByWalletHandler);

/**
 * The following routes require authentication.
 */
router.use(authMiddleware);

/**
 * GET /api/users/me
 * Get the profile of the currently authenticated user.
 */
router.get('/me', userController.getCurrentUserHandler);

/**
 * PATCH /api/users/me
 * Update the profile of the currently authenticated user.
 */
router.patch('/me', userController.updateUserHandler);

export default router;
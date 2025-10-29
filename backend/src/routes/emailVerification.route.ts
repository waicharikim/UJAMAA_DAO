/**
 * @file emailVerification.routes.ts
 * @description UJAMAADAO Email Verification Routes
 * * Defines the API endpoints for the progressive email verification process.
 * These routes link the controller logic to the public-facing API.
 */

import { Router } from 'express';
import * as emailVerificationController from '../controllers/emailVerification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js'; // Assuming this is your standard auth middleware
import { validate } from '../middlewares/validation.middleware.js'; // Assuming you have a validation utility
import * as emailVerificationValidation from '../validation/emailVerification.validation.js'; // We will define this validation later

const router = Router();

// --- UJAMAADAO Email Verification Routes ---

/**
 * @route POST /api/users/initiate-email-verification
 * @description Requires authentication. Generates a secure token, sends it to the user's registered email, 
 * and invalidates any previous unverified tokens.
 * @access Private (Authenticated User)
 */
router.post(
  '/initiate-email-verification',
  authenticate, // User must be logged in to request a token for their account
  emailVerificationController.initiateEmailVerificationHandler
);

/**
 * @route POST /api/users/verify-email
 * @description Publicly accessible. Validates the token, marks the user's email as verified, 
 * awards Impact Points, and updates their verification level.
 * @access Public
 */
router.post(
  '/verify-email',
  // Validation for the incoming token (e.g., ensuring it's a string)
  // NOTE: Assuming emailVerificationValidation.verifyTokenSchema exists
  // validate(emailVerificationValidation.verifyTokenSchema), 
  emailVerificationController.verifyEmailTokenHandler
);

export default router;
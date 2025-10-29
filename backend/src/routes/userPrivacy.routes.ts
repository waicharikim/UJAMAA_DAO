/**
 * @file userPrivacy.routes.ts
 * @description Defines API routes for user privacy settings and data management.
 * Enforces authentication, validation, and role-based access control (RBAC).
 */

import { Router } from 'express';
// FIX: Importing 'authenticate' from the specific wrapper file where it is exported.
import { authenticate } from '../middlewares/authenticate.js'; 
import { authorize } from '../middlewares/rbac.middleware.js'; // Assuming this utility exists
import { validateRequest } from '../middlewares/validateRequest.js'; // Assuming this utility exists
import * as privacyController from '../controllers/userPrivacy.controller.js';
import * as privacyValidation from '../validation/privacy.validation.js';

const router = Router();

// Requires authentication for all privacy routes
router.use(authenticate);

// --- My Privacy Settings (Ownership enforced by controller using req.user.userId) ---

/**
 * GET /api/privacy/me
 * Retrieve the authenticated user's own privacy settings.
 */
router.get(
    '/me',
    privacyController.getMyPrivacySettingsHandler
);

/**
 * PUT /api/privacy/me
 * Update the authenticated user's own privacy settings.
 * Input is validated via Zod schema.
 */
router.put(
    '/me',
    validateRequest(privacyValidation.updatePrivacySettingsSchema),
    privacyController.updateMyPrivacySettingsHandler
);


// --- Admin/Auditor Functions ---

/**
 * GET /api/privacy/:userId
 * Retrieve another user's privacy settings.
 * Requires: The ability to view any user's sensitive data (e.g., admin, auditor).
 */
router.get(
    '/:userId',
    validateRequest(privacyValidation.getUserSettingsSchema),
    // Allows Super Admin, General Admin, or a specific Auditor role to view settings
    authorize({ allowedRoles: ['system:super_admin', 'user:admin', 'audit:viewer'] }), 
    privacyController.getUserPrivacySettingsHandler
);

/**
 * POST /api/privacy/:userId/anonymize
 * Permanently anonymize a user's sensitive PII (Right to Erasure).
 * CRITICAL: Requires the highest level of administrative access.
 */
router.post(
    '/:userId/anonymize',
    validateRequest(privacyValidation.anonymizeUserSchema),
    // Hard requirement for this destructive, compliance-driven action
    authorize({ allowedRoles: ['system:super_admin'] }), 
    privacyController.anonymizeUserSensitiveDataHandler
);

export default router;

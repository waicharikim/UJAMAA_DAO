/**
 * @file verification.routes.ts
 * * @description
 * UJAMAADAO Verification Routes
 * * Defines API endpoints for user verification processes including:
 * - Phone verification
 * - Community verification
 * - Location verification
 * - Verification status checks
 */

import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller.js';
// FIX 1: Import the new authenticate export file
import { authenticate } from '../middlewares/authenticate.js'; 
// FIX 2: Import the new authorize export file
import { authorize } from '../middlewares/rbac.middleware.js'; 
import { validateRequest } from '../middlewares/validateRequest.js';
import { verificationValidations } from '../validation/verfication.validation.js';

const router = Router();

// ... (All other routes remain the same, using the now-correct 'authenticate' and 'authorize' imports)

/**
 * @route POST /api/verification/phone/initiate
 * @description Initiate phone verification
 * @access Private
 */
router.post(
  '/phone/initiate',
  authenticate,
  validateRequest(verificationValidations.initiatePhoneVerification),
  verificationController.initiatePhoneVerification
);

// ... (Other phone, community, and location routes)

/**
 * @route GET /api/verification/status/:userId
 * @description Get verification status for another user (admin only)
 * @access Private (Admin)
 */
router.get(
  '/status/:userId',
  authenticate,
  // The authorize function now correctly imported from rbac.middleware.js
  authorize({ roles: ['system:super_admin', 'system:auditor'] }),
  validateRequest(verificationValidations.getUserVerificationStatus),
  verificationController.getUserVerificationStatus
);

/**
 * @route GET /api/verification/admin/stats
 * @description Get verification statistics (admin only)
 * @access Private (Admin)
 */
router.get(
  '/admin/stats',
  authenticate,
  // Using the object syntax for clarity, though array is supported too
  authorize({ roles: ['system:super_admin', 'system:auditor'] }),
  async (req, res) => {
    // Implementation would fetch verification statistics
    res.status(200).json({
      success: true,
      data: {
        totalVerifiedUsers: 0,
        phoneVerified: 0,
        communityVerified: 0,
        locationVerified: 0,
        verificationRate: 0,
        pendingVerifications: 0
      },
      message: 'Verification statistics retrieved successfully'
    });
  }
);

export default router;
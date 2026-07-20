/**
 * @file src/modules/audit/routes/audit.routes.ts
 * @description
 * Audit Routes
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { asyncHandler } from '../../../core/utils/response.js';
import { SystemRoles } from '../../../core/rbac/roles.js';

const router = Router();

router.use(authenticate);

// Only admins can view audit logs
router.use(
  authorize({
    allowedRoles: [
      SystemRoles.SUPER_ADMIN,
      SystemRoles.WARD_ADMIN,
      SystemRoles.COUNTY_ADMIN,
      SystemRoles.CONSTITUENCY_ADMIN,
    ],
  })
);

router.get('/search', asyncHandler(AuditController.searchLogs));

export default router;

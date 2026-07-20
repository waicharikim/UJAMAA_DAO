/**
 * @file src/modules/admin/routes/platform-config.routes.ts
 *
 * Public-read endpoint for platform configuration (costs, dues tiers, etc.).
 * Mounted at /api/v1/platform-config — requires authentication but NO admin role.
 * Mutation endpoint is in admin.routes.ts (SUPER_ADMIN only).
 */

import { Router } from 'express';
import { asyncHandler, sendSuccess } from '../../../core/utils/response.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { adminService } from '../services/admin.service.js';

const router = Router();

// GET /api/v1/platform-config — any authenticated member can read
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req, res) => {
    const configs = await adminService.getAllPlatformConfig();
    sendSuccess(res, configs);
  })
);

export default router;

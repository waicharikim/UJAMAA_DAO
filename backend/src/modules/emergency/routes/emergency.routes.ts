/**
 * @file src/modules/emergency/routes/emergency.routes.ts
 * @description Emergency Routes
 * Version: 3.0 — March 2026
 */

import { Router } from 'express';
import { EmergencyController } from '../controllers/emergency.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import { roleService } from '../../../core/services/role.service.js';
import { SystemRoles } from '../../../core/rbac/roles.js';
import { prisma } from '../../../core/database/client.js';
import {
  reportEmergencySchema,
  respondToEmergencySchema,
  alertIdParamSchema,
  listAlertsSchema,
} from '../validators/emergency.validators.js';

const router = Router();

// GET /emergency — list alerts (public)
router.get(
  '/',
  validateRequest({ schema: listAlertsSchema, target: 'query' }),
  asyncHandler(EmergencyController.listAlerts)
);

// GET /emergency/:alertId — get single alert (public)
router.get(
  '/:alertId',
  validateRequest({ schema: alertIdParamSchema, target: 'params' }),
  asyncHandler(EmergencyController.getAlert)
);

// POST /emergency/report — any authenticated user
router.post(
  '/report',
  authenticate,
  validateRequest({ schema: reportEmergencySchema, target: 'body' }),
  asyncHandler(EmergencyController.reportEmergency)
);

// POST /emergency/:alertId/respond — ward admin or verifier only
router.post(
  '/:alertId/respond',
  authenticate,
  validateRequest({ schema: alertIdParamSchema, target: 'params' }),
  validateRequest({ schema: respondToEmergencySchema, target: 'body' }),
  authorize({
    scopeCheck: async (req) => {
      const { alertId } = req.params;
      const alert = await prisma.emergencyAlert.findUnique({
        where: { id: alertId },
        select: { location: true },
      });

      if (!alert) return false;

      const userId = (req as any).user!.userId;

      const isWardAdmin = await roleService.hasLocationRole(
        userId,
        alert.location,
        SystemRoles.WARD_ADMIN
      );

      const isVerifier = await roleService.isVerifier(userId, alert.location);

      return isWardAdmin || isVerifier;
    },
  }),
  asyncHandler(EmergencyController.respondToEmergency)
);

export default router;

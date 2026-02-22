/**
 * @file src/modules/emergency/routes/emergency.routes.ts
 * @description
 * Emergency Routes
 * Version: 2.0 — December 2025
 */

import { Router } from "express";
import { EmergencyController } from "../controllers/emergency.controller.js";
import { authenticate } from "../../../core/middleware/auth.middleware.js";
import { authorize } from "../../../core/middleware/authorize.js";
import { validateRequest } from "../../../core/middleware/validateRequest.js";
import { z } from "zod";
import { asyncHandler } from "../../../core/utils/response.js";
import { roleService } from "../../../core/services/role.service.js";
import { prisma } from "../../../core/database/client.js";

const router = Router();

router.use(authenticate);

// Report emergency — any authenticated user (low PR cost handled in service)
router.post(
  "/report",
  validateRequest({
    schema: z.object({
      type: z.enum(["FIRE", "FLOOD", "MEDICAL", "SECURITY", "ACCIDENT", "OTHER"]),
      description: z.string().min(10),
      locationWardId: z.string().uuid(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      photoUrl: z.string().url().optional(),
    }),
    target: "body",
  }),
  asyncHandler(EmergencyController.reportEmergency)
);

// Respond to emergency — only ward_admin of the ward OR verifier
router.post(
  "/:alertId/respond",
  validateRequest({
    schema: z.object({
      message: z.string().min(5),
    }),
    target: "body",
  }),
  authorize({
    scopeCheck: async (req) => {
      const { alertId } = req.params;
      const alert = await prisma.emergencyAlert.findUnique({
        where: { id: alertId },
        select: { locationWardId: true },
      });

      if (!alert) return false;

      const isWardAdmin = await roleService.hasLocationRole(
        req.user!.userId,
        "WARD",
        alert.locationWardId,
        "WARD_ADMIN"
      );

      const isVerifier = await roleService.isVerifier(req.user!.userId, alert.locationWardId);

      return isWardAdmin || isVerifier;
    },
  }),
  asyncHandler(EmergencyController.respondToEmergency)
);

export default router;
/**
 * @file src/modules/community/routes/group.routes.ts
 * @description
 * Group Routes — Voluntary Group Management
 * Version: 2.0 — December 2025
 */

import { Router } from "express";
import { GroupController } from "../controllers/group.controller.js";
import { authenticate } from "../../../core/middleware/auth.middleware.js";
import { authorize } from "../../../core/middleware/authorize.js";
import { validateRequest } from "../../../core/middleware/validateRequest.js";
import { z } from "zod";
import { asyncHandler } from "../../../core/utils/response.js";
import { roleService } from "../../../core/services/role.service.js";

const router = Router();

router.use(authenticate);

router.post(
  "/voluntary/create",
  validateRequest({
    schema: z.object({
      name: z.string().min(3),
      voluntaryType: z.string(),
      description: z.string().optional(),
      avatarUrl: z.string().url().optional(),
    }),
    target: "body",
  }),
  asyncHandler(GroupController.createVoluntaryGroup)
);

router.post(
  "/join",
  validateRequest({
    schema: z.object({
      groupId: z.string().uuid(),
    }),
    target: "body",
  }),
  asyncHandler(GroupController.joinGroup)
);

router.post(
  "/leave",
  validateRequest({
    schema: z.object({
      groupId: z.string().uuid(),
    }),
    target: "body",
  }),
  asyncHandler(GroupController.leaveGroup)
);

// FUTURE: Group admin actions — only LEADER of the group
// Example:
// router.post(
//   "/:groupId/start-voting",
//   authorize({
//     scopeCheck: async (req) => {
//       const groupId = req.params.groupId;
//       return roleService.hasGroupRole(req.user!.userId, groupId, "LEADER");
//     },
//   }),
//   asyncHandler(GroupController.startProposalVoting)
// );

// router.patch(
//   "/:groupId/settings",
//   authorize({
//     scopeCheck: async (req) => {
//       const groupId = req.params.groupId;
//       return roleService.hasGroupRole(req.user!.userId, groupId, "LEADER");
//     },
//   }),
//   asyncHandler(GroupController.updateGroupSettings)
// );

export default router;
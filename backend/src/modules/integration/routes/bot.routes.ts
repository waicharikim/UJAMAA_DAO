/**
 * @file src/modules/integration/routes/bot.routes.ts
 * @description
 * Integration module routes — bot webhooks and baraza group management.
 *
 * Mounted at: /api/v1/integration
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { SystemRoles } from '../../../core/rbac/roles.js';
import {
  handleTelegramWebhook,
  handleDiscordWebhook,
  registerBarazaGroup,
  getBarazaGroups,
  recordAttendance,
  deactivateBarazaGroup,
} from '../controllers/bot.controller.js';

const router = Router();

// ─────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────

const registerBarazaGroupSchema = z.object({
  groupId: z.string().uuid(),
  platform: z.enum(['TELEGRAM', 'WHATSAPP', 'DISCORD']),
  externalId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  inviteLink: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const attendanceSchema = z.object({
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'sessionDate must be YYYY-MM-DD'),
  attendeeExternalIds: z.array(z.string().min(1)).min(1).max(500),
  facilitatorExternalId: z.string().optional(),
  reportedBy: z.string().max(100).optional(),
});

// ─────────────────────────────────────────────
// Bot webhook endpoints (no JWT auth — platform-level auth only)
// ─────────────────────────────────────────────

router.post('/telegram/webhook', handleTelegramWebhook);
router.post('/discord/webhook', handleDiscordWebhook);

// ─────────────────────────────────────────────
// Baraza group management (JWT required)
// ─────────────────────────────────────────────

router.post(
  '/baraza-groups',
  authenticate,
  authorize({ allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN] }),
  validateRequest({ schema: registerBarazaGroupSchema, target: 'body' }),
  registerBarazaGroup
);

router.get('/baraza-groups', authenticate, getBarazaGroups);

router.post(
  '/baraza-groups/:id/attendance',
  authenticate,
  authorize({ allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN] }),
  validateRequest({ schema: attendanceSchema, target: 'body' }),
  recordAttendance
);

router.post(
  '/baraza-groups/:id/deactivate',
  authenticate,
  authorize({ allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN] }),
  deactivateBarazaGroup
);

export default router;

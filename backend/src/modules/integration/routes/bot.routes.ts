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
  getAllBarazaGroups,
  getBarazaDemand,
  recordAttendance,
  deactivateBarazaGroup,
  refreshInviteLink,
  listSessions,
  scheduleSessionHttp,
  openSessionHttp,
  closeSessionHttp,
  askBaraza,
} from '../controllers/bot.controller.js';
import { aiChatRateLimit } from '../../../core/middleware/rateLimiter.js';

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
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  validateRequest({ schema: registerBarazaGroupSchema, target: 'body' }),
  registerBarazaGroup
);

router.get('/baraza-groups', authenticate, getBarazaGroups);

// ─────────────────────────────────────────────
// In-app Baraza assistant (web chat) — signed-in users only
// ─────────────────────────────────────────────

const askBarazaSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

router.post(
  '/baraza/ask',
  authenticate,
  aiChatRateLimit(),
  validateRequest({ schema: askBarazaSchema, target: 'body' }),
  askBaraza
);

router.get(
  '/baraza-groups/all',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  getAllBarazaGroups
);

// Worklist: communities past the member threshold with no Telegram baraza.
router.get(
  '/baraza-groups/demand',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  getBarazaDemand
);

router.post(
  '/baraza-groups/:id/attendance',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  validateRequest({ schema: attendanceSchema, target: 'body' }),
  recordAttendance
);

router.post(
  '/baraza-groups/:id/deactivate',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  deactivateBarazaGroup
);

// Refresh invite link for a Telegram baraza group (admin or the linked group leader)
router.post(
  '/baraza-groups/:id/refresh-invite',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  refreshInviteLink
);

// ─────────────────────────────────────────────
// Session management
// ─────────────────────────────────────────────

const scheduleSessionSchema = z.object({
  scheduledAt: z.string().min(1),
});

router.get('/baraza-groups/:id/sessions', authenticate, listSessions);

router.post(
  '/baraza-groups/:id/sessions/schedule',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  validateRequest({ schema: scheduleSessionSchema, target: 'body' }),
  scheduleSessionHttp
);

router.post(
  '/baraza-groups/:id/sessions/open',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  openSessionHttp
);

router.post(
  '/baraza-groups/:id/sessions/close',
  authenticate,
  authorize({
    allowedRoles: [SystemRoles.WARD_ADMIN, SystemRoles.SUPER_ADMIN],
  }),
  closeSessionHttp
);

export default router;

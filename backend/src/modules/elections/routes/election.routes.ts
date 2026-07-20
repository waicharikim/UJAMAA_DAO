/**
 * @file src/modules/elections/routes/election.routes.ts
 * @description
 * Elections Module Routes
 *
 * Endpoints:
 *   GET    /elections              → list (filterable)
 *   GET    /elections/mine         → my active elections (can nominate/vote)
 *   GET    /elections/:electionId  → full detail + candidates
 *   POST   /elections/:electionId/nominate        → self-nominate (spends PR)
 *   DELETE /elections/:electionId/nomination      → withdraw nomination
 *   POST   /elections/:electionId/vote            → cast weighted vote (free)
 *   POST   /elections/admin/schedule              → SUPER_ADMIN: trigger scan
 *   POST   /elections/admin/:electionId/tally     → SUPER_ADMIN: force tally
 *
 * Version: 1.0 — March 2026
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/utils/response.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { authorize } from '../../../core/middleware/authorize.js';
import { toMiddleware, requireAdmin } from '../../../core/rbac/authorize.js';
import { buildRateLimiter } from '../../../core/middleware/rateLimiter.js';
import {
  nominateSchema,
  castVoteSchema,
  listElectionsSchema,
  electionIdSchema,
} from '../validators/election.validators.js';
import { ElectionController } from '../controllers/election.controller.js';

const router = Router();

// ── Public list ─────────────────────────────────────────────────────────────

router.get(
  '/',
  validateRequest({ schema: listElectionsSchema, target: 'query' }),
  asyncHandler(ElectionController.listElections)
);

// ── Authenticated ────────────────────────────────────────────────────────────

router.get(
  '/mine',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  asyncHandler(ElectionController.getMyElections)
);

router.get(
  '/:electionId',
  validateRequest({ schema: electionIdSchema, target: 'params' }),
  asyncHandler(ElectionController.getElection)
);

router.post(
  '/:electionId/nominate',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  validateRequest({ schema: electionIdSchema, target: 'params' }),
  validateRequest({ schema: nominateSchema, target: 'body' }),
  asyncHandler(ElectionController.nominate)
);

router.delete(
  '/:electionId/nomination',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  validateRequest({ schema: electionIdSchema, target: 'params' }),
  asyncHandler(ElectionController.withdrawNomination)
);

router.post(
  '/:electionId/vote',
  authenticate,
  authorize({ verificationLevel: 'COMMUNITY_VERIFIED' }),
  buildRateLimiter({ windowMs: 60 * 1000, max: 5 }),
  buildRateLimiter({
    windowMs: 60 * 1000,
    max: 1,
    keyGenerator: (req: any) => `${req.user?.userId}:${req.params.electionId}`,
  }),
  validateRequest({ schema: electionIdSchema, target: 'params' }),
  validateRequest({ schema: castVoteSchema, target: 'body' }),
  asyncHandler(ElectionController.castVote)
);

// ── Admin only ───────────────────────────────────────────────────────────────

router.post(
  '/admin/schedule',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  toMiddleware(requireAdmin()),
  asyncHandler(ElectionController.triggerSchedule)
);

router.post(
  '/admin/:electionId/tally',
  authenticate,
  authorize({ verificationLevel: 'FULL_VERIFIED' }),
  toMiddleware(requireAdmin()),
  validateRequest({ schema: electionIdSchema, target: 'params' }),
  asyncHandler(ElectionController.triggerTally)
);

export default router;

/**
 * @file src/modules/marketplace/routes/marketplace.routes.ts
 * @description
 * Marketplace Routes — Discovery Platform
 * Rule 1: No payment, escrow, or transaction endpoints.
 * Version: 2.1 — March 2026
 *
 * Route order matters: /search and /my-listings must precede /:listingId
 * to avoid the parameterised route swallowing them.
 */

import { Router } from 'express';
import { MarketplaceController } from '../controllers/marketplace.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { asyncHandler } from '../../../core/utils/response.js';
import {
  createListingSchema,
  listingIdParamSchema,
  myListingsSchema,
  searchListingsSchema,
} from '../validators/marketplace.validators.js';

const router = Router();

// ── Public routes ────────────────────────────────────────────────────────────

router.get(
  '/search',
  validateRequest({ schema: searchListingsSchema, target: 'query' }),
  asyncHandler(MarketplaceController.searchListings)
);

// ── Authenticated routes (registered before /:listingId to avoid shadowing) ──

router.get(
  '/my-listings',
  authenticate,
  validateRequest({ schema: myListingsSchema, target: 'query' }),
  asyncHandler(MarketplaceController.getMyListings)
);

router.post(
  '/create',
  authenticate,
  validateRequest({ schema: createListingSchema, target: 'body' }),
  asyncHandler(MarketplaceController.createListing)
);

router.patch(
  '/:listingId/deactivate',
  authenticate,
  validateRequest({ schema: listingIdParamSchema, target: 'params' }),
  asyncHandler(MarketplaceController.deactivateListing)
);

// ── Public parameterised route (must be last) ────────────────────────────────

router.get(
  '/:listingId',
  validateRequest({ schema: listingIdParamSchema, target: 'params' }),
  asyncHandler(MarketplaceController.getListing)
);

export default router;

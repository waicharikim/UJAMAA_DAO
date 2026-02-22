/**
 * @file src/modules/marketplace/routes/marketplace.routes.ts
 * @description
 * Marketplace Routes — Discovery Platform
 * Version: 2.0 — December 2025
 */

import { Router } from 'express';
import { MarketplaceController } from '../controllers/marketplace.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validateRequest.js';
import { z } from 'zod';
import { asyncHandler } from '../../../core/utils/response.js';

const router = Router();

// Public browsing
router.get('/search', asyncHandler(MarketplaceController.searchListings));
router.get('/:listingId', asyncHandler(MarketplaceController.getListing));

// Authenticated actions
router.use(authenticate);

router.post(
  '/create',
  validateRequest({
    schema: z.object({
      goodsServiceId: z.string().uuid(),
      title: z.string().min(5),
      description: z.string().min(20),
      priceGuideKes: z.number().positive().optional(),
      quantity: z.number().int().positive().optional(),
      type: z.enum(['OFFER', 'REQUEST']),
    }),
    target: 'body',
  }),
  asyncHandler(MarketplaceController.createListing)
);

export default router;

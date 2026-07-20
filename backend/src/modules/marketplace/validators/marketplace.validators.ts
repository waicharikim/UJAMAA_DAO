/**
 * @file src/modules/marketplace/validators/marketplace.validators.ts
 * @description Zod validators for marketplace endpoints.
 */

import { z } from 'zod';

export const createListingSchema = z.object({
  goodsServiceId: z.string().uuid().optional(),
  title: z.string().min(5),
  description: z.string().min(20),
  priceGuideKes: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
  type: z.enum(['OFFER', 'REQUEST']),
});

export const searchListingsSchema = z.object({
  goodsServiceId: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
  type: z.enum(['OFFER', 'REQUEST']).optional(),
  wardId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const myListingsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listingIdParamSchema = z.object({
  listingId: z.string().uuid(),
});

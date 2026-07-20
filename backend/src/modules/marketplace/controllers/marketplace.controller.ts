/**
 * @file src/modules/marketplace/controllers/marketplace.controller.ts
 * @description
 * Marketplace Controller — Discovery Platform
 * Version: 2.1 — March 2026
 */

import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { marketplaceService } from '../services/marketplace.service.js';

export class MarketplaceController {
  static async createListing(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const listing = await marketplaceService.createListing(userId, req.body);
    sendSuccess(res, listing, 'Listing created', 201);
  }

  static async searchListings(req: AuthRequest, res: Response) {
    const result = await marketplaceService.searchListings(req.query as any);
    sendSuccess(res, result, 'Listings retrieved');
  }

  static async getListing(req: AuthRequest, res: Response) {
    const { listingId } = req.params;
    const listing = await marketplaceService.getListing(listingId);
    sendSuccess(res, listing, 'Listing details');
  }

  static async getMyListings(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await marketplaceService.getMyListings(
      userId,
      req.query as any
    );
    sendSuccess(res, result, 'My listings retrieved');
  }

  static async deactivateListing(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { listingId } = req.params;
    const listing = await marketplaceService.deactivateListing(
      userId,
      listingId
    );
    sendSuccess(res, listing, 'Listing deactivated');
  }
}

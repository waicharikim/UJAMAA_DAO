/**
 * @file src/modules/marketplace/controllers/marketplace.controller.ts
 * @description
 * Marketplace Controller — Discovery Platform
 * Version: 2.0 — December 2025
 */

import { Request, Response } from "express";
import { sendSuccess } from "../../../core/utils/response.js";
import { marketplaceService } from "../services/marketplace.service.js";

export class MarketplaceController {
  static async createListing(req: Request, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const listing = await marketplaceService.createListing(userId, dto);
    sendSuccess(res, listing, "Listing created");
  }

  static async searchListings(req: Request, res: Response) {
    const dto = req.query as any;
    const result = await marketplaceService.searchListings(dto);
    sendSuccess(res, result, "Listings retrieved");
  }

  static async getListing(req: Request, res: Response) {
    const { listingId } = req.params;
    const listing = await marketplaceService.getListing(listingId);
    sendSuccess(res, listing, "Listing details");
  }
}
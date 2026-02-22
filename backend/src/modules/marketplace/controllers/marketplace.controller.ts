/**
 * @file src/modules/marketplace/controllers/marketplace.controller.ts
 * @description
 * Marketplace Controller — Discovery Platform
 * Version: 2.0 — December 2025
 */

import { Response } from "express";
import { AuthRequest } from "../../../core/types/Ujamaadao.types.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { marketplaceService } from "../services/marketplace.service.js";

export class MarketplaceController {
  static async createListing(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const dto = req.body;
    const listing = await marketplaceService.createListing(userId, dto);
    sendSuccess(res, listing, "Listing created");
  }

  static async searchListings(req: AuthRequest, res: Response) {
    const dto = req.query as any;
    const result = await marketplaceService.searchListings(dto);
    sendSuccess(res, result, "Listings retrieved");
  }

  static async getListing(req: AuthRequest, res: Response) {
    const { listingId } = req.params;
    const listing = await marketplaceService.getListing(listingId);
    sendSuccess(res, listing, "Listing details");
  }
}
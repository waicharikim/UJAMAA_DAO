/**
 * @file src/modules/marketplace/services/marketplace.service.ts
 * @description
 * Marketplace Service — Discovery Platform (No Transactions)
 *
 * Users list what they offer/request
 * Others browse and contact directly
 * No payment processing, no liability
 *
 * Version: 2.0 — December 2025
 */

import { prisma } from "../../../core/database/client.js";
import { ApiError } from "../../../core/errors/ApiError.js";
import { logger } from "../../../core/logger/logger.js";
import { CreateListingDto, SearchListingsDto } from "../types.js";

class MarketplaceService {
  /**
   * Create listing (offer or request)
   */
  async createListing(userId: string, dto: CreateListingDto) {
    const goodsService = await prisma.goodsService.findUnique({
      where: { id: dto.goodsServiceId },
    });

    if (!goodsService) throw ApiError.notFound("Goods/Service");

    // Check user has this in UserGoodsService
    const userGoods = await prisma.userGoodsService.findFirst({
      where: {
        userId,
        goodsServiceId: dto.goodsServiceId,
        [dto.type === "OFFER" ? "canProvide" : "canRequest"]: true,
      },
    });

    if (!userGoods) throw ApiError.forbidden(`You cannot ${dto.type.toLowerCase()} this`);

    const listing = await prisma.marketplaceListing.create({
      data: {
        userId,
        goodsServiceId: dto.goodsServiceId,
        title: dto.title,
        description: dto.description,
        priceGuideKes: dto.priceGuideKes,
        quantity: dto.quantity,
        type: dto.type,
        isActive: true,
      },
    });

    logger.info({ userId, listingId: listing.id, type: dto.type }, "Marketplace listing created");

    return listing;
  }

  /**
   * Search/browse listings
   */
  async searchListings(dto: SearchListingsDto) {
    const skip = ((dto.page || 1) - 1) * (dto.limit || 20);

    const where: any = { isActive: true };

    if (dto.goodsServiceId) where.goodsServiceId = dto.goodsServiceId;
    if (dto.type) where.type = dto.type;
    if (dto.wardId) {
      where.user = { primaryWardId: dto.wardId };
    }

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              primaryWard: { select: { name: true } },
            },
          },
          goodsService: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: dto.limit || 20,
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    return {
      listings,
      pagination: {
        page: dto.page || 1,
        limit: dto.limit || 20,
        total,
        totalPages: Math.ceil(total / (dto.limit || 20)),
      },
    };
  }

  /**
   * Get single listing with seller contact
   */
  async getListing(listingId: string) {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            primaryWard: { select: { name: true } },
          },
        },
        goodsService: true,
      },
    });

    if (!listing || !listing.isActive) throw ApiError.notFound("Listing");

    return listing;
  }
}

export const marketplaceService = new MarketplaceService();
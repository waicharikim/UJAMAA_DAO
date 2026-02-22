/**
 * @file src/modules/marketplace/services/marketplace.service.ts
 * @description
 * Marketplace Service — Discovery Platform (No Transactions)
 *
 * Version: 2.1 — February 2026
 * Updated: Align with actual Prisma schema field names
 */

import { HolderType, ListingStatus } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { CreateListingDto, SearchListingsDto } from '../types.js';

class MarketplaceService {
  /**
   * Create listing (offer or request)
   */
  async createListing(userId: string, dto: CreateListingDto) {
    const listing = await prisma.marketplaceListing.create({
      data: {
        sellerUserId: userId,
        sellerType: HolderType.USER,
        title: dto.title,
        description: dto.description,
        price: dto.priceGuideKes ?? 0,
        quantity: dto.quantity ?? 1,
        listingType: dto.type ?? 'OFFER',
        status: ListingStatus.ACTIVE,
      },
    });

    logger.info(
      { userId, listingId: listing.id, type: dto.type },
      'Marketplace listing created'
    );

    return listing;
  }

  /**
   * Search/browse listings
   */
  async searchListings(dto: SearchListingsDto) {
    const skip = ((dto.page || 1) - 1) * (dto.limit || 20);

    const where: any = { status: ListingStatus.ACTIVE };

    if (dto.wardId) where.wardId = dto.wardId;

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        include: {
          sellerUser: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
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
   * Get single listing
   */
  async getListing(listingId: string) {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        sellerUser: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE)
      throw ApiError.notFound('Listing');

    return listing;
  }
}

export const marketplaceService = new MarketplaceService();

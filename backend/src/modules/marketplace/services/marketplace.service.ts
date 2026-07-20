/**
 * @file src/modules/marketplace/services/marketplace.service.ts
 * @description
 * Marketplace Service — Discovery Platform (No Transactions)
 *
 * Rule 1: Discovery only. No payments, no escrow, no transaction processing.
 *
 * Version: 2.2 — March 2026
 */

import { HolderType, ListingStatus } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { auditService } from '../../audit/services/audit.service.js';
import { AuditAction } from '../../audit/types.js';
import {
  CreateListingDto,
  MyListingsDto,
  SearchListingsDto,
} from '../types.js';

export class MarketplaceService {
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

    await auditService.log(
      userId,
      AuditAction.LISTING_CREATED,
      'marketplace_listing',
      listing.id,
      { type: dto.type, title: dto.title }
    );

    return listing;
  }

  /**
   * Search/browse active listings
   */
  async searchListings(dto: SearchListingsDto) {
    const limit = parseInt(String(dto.limit || 20), 10);
    const page = parseInt(String(dto.page || 1), 10);
    const skip = (page - 1) * limit;

    const where: any = { status: ListingStatus.ACTIVE };

    if (dto.wardId) where.wardId = dto.wardId;
    if (dto.type) where.listingType = dto.type;
    if (dto.q) {
      const term = dto.q.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        include: {
          sellerUser: {
            select: { id: true, name: true, phoneNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    return {
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single active listing
   */
  async getListing(listingId: string) {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        sellerUser: {
          select: { id: true, name: true, phoneNumber: true, email: true },
        },
      },
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE)
      throw ApiError.notFound('Listing');

    return listing;
  }

  /**
   * Get current user's own listings (any status)
   */
  async getMyListings(userId: string, dto: MyListingsDto) {
    const limit = parseInt(String(dto.limit || 20), 10);
    const page = parseInt(String(dto.page || 1), 10);
    const skip = (page - 1) * limit;

    const where = { sellerUserId: userId };

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    return {
      listings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Deactivate a listing — owner only
   */
  async deactivateListing(userId: string, listingId: string) {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) throw ApiError.notFound('Listing');
    if (listing.sellerUserId !== userId)
      throw ApiError.forbidden('You do not own this listing');
    if (listing.status !== ListingStatus.ACTIVE)
      throw ApiError.badRequest('Listing is not active');

    const updated = await prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { status: ListingStatus.INACTIVE },
    });

    logger.info({ userId, listingId }, 'Marketplace listing deactivated');

    await auditService.log(
      userId,
      AuditAction.LISTING_DEACTIVATED,
      'marketplace_listing',
      listingId
    );

    return updated;
  }
}

export const marketplaceService = new MarketplaceService();

/**
 * @file tests/marketplace/helpers.ts
 * @description Shared seeders and helpers for marketplace module tests.
 *
 * NOT a test file — imported by marketplace test files.
 * No location/ward seeding required — wardId is optional on listings.
 */

import { ListingStatus } from '@prisma/client';
import { prisma } from '../../src/core/database/client.js';
import { signJwtToken, JwtPayload } from '../../src/core/utils/jwt.service.js';

// ─────────────────────────────────────────────
// User helpers
// ─────────────────────────────────────────────

export async function createMarketplaceUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: 'Marketplace Test User',
      verificationLevel: 'EMAIL_VERIFIED',
      emailVerified: true,
      phoneVerified: false,
      communityVerified: false,
      locationVerified: false,
    },
  });
}

// ─────────────────────────────────────────────
// Listing helpers
// ─────────────────────────────────────────────

export async function seedListing(
  sellerUserId: string,
  overrides: {
    title?: string;
    description?: string;
    listingType?: string;
    status?: ListingStatus;
    price?: number;
  } = {}
) {
  return prisma.marketplaceListing.create({
    data: {
      sellerUserId,
      sellerType: 'USER',
      title: overrides.title ?? 'Test Listing',
      description: overrides.description ?? 'A listing for unit testing purposes',
      price: overrides.price ?? 0,
      quantity: 1,
      listingType: overrides.listingType ?? 'OFFER',
      status: overrides.status ?? ListingStatus.ACTIVE,
    },
  });
}

// ─────────────────────────────────────────────
// JWT helper
// ─────────────────────────────────────────────

export function makeMarketplaceToken(
  userId: string,
  extra: Partial<JwtPayload> = {}
): string {
  return signJwtToken(
    {
      sub: userId,
      verificationLevel: 'EMAIL_VERIFIED',
      roles: [],
      globalImpactPoints: 0,
      utilityTokens: 0,
      participationRights: 50,
      emailVerified: true,
      phoneVerified: false,
      communityVerified: false,
      type: 'permanent',
      ...extra,
    },
    '1h',
    0
  );
}

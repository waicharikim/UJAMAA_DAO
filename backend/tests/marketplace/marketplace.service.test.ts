/**
 * @file tests/marketplace/marketplace.service.test.ts
 * @description Unit tests for MarketplaceService.
 * Uses real Prisma + test DB. DB truncated before each test by testSetup.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ListingStatus } from '@prisma/client';
import { MarketplaceService } from '../../src/modules/marketplace/services/marketplace.service.js';
import { createMarketplaceUser, seedListing } from './helpers.js';

const service = new MarketplaceService();

// ─────────────────────────────────────────────
// createListing
// ─────────────────────────────────────────────

describe('MarketplaceService.createListing', () => {
  it('creates an ACTIVE listing with correct fields', async () => {
    const user = await createMarketplaceUser('seller@test.com');

    const listing = await service.createListing(user.id, {
      title: 'Solar Panel Installation',
      description: 'Professional solar panel setup for residential properties',
      type: 'OFFER' as any,
      priceGuideKes: 45000,
      quantity: 5,
    });

    expect(listing.id).toBeDefined();
    expect(listing.status).toBe(ListingStatus.ACTIVE);
    expect(listing.sellerUserId).toBe(user.id);
    expect(listing.title).toBe('Solar Panel Installation');
    expect(Number(listing.price)).toBe(45000);
    expect(listing.listingType).toBe('OFFER');
  });

  it('defaults price to 0 and quantity to 1 when omitted', async () => {
    const user = await createMarketplaceUser('seller2@test.com');

    const listing = await service.createListing(user.id, {
      title: 'Welding Services',
      description: 'General welding and metalwork services available in the ward',
      type: 'OFFER' as any,
    });

    expect(Number(listing.price)).toBe(0);
    expect(listing.quantity).toBe(1);
  });

  it('creates a REQUEST type listing', async () => {
    const user = await createMarketplaceUser('buyer@test.com');

    const listing = await service.createListing(user.id, {
      title: 'Looking for Carpenter',
      description: 'Need a skilled carpenter to build custom furniture for my home',
      type: 'REQUEST' as any,
    });

    expect(listing.listingType).toBe('REQUEST');
  });
});

// ─────────────────────────────────────────────
// searchListings
// ─────────────────────────────────────────────

describe('MarketplaceService.searchListings', () => {
  it('returns empty list when no listings exist', async () => {
    const result = await service.searchListings({});
    expect(result.listings).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('returns only ACTIVE listings', async () => {
    const user = await createMarketplaceUser('mixed@test.com');
    await seedListing(user.id, { title: 'Active One' });
    await seedListing(user.id, {
      title: 'Inactive One',
      status: ListingStatus.INACTIVE,
    });

    const result = await service.searchListings({});
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].title).toBe('Active One');
  });

  it('filters by type', async () => {
    const user = await createMarketplaceUser('typeduser@test.com');
    await seedListing(user.id, { listingType: 'OFFER' });
    await seedListing(user.id, { listingType: 'REQUEST' });

    const result = await service.searchListings({ type: 'OFFER' as any });
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].listingType).toBe('OFFER');
  });

  it('paginates correctly', async () => {
    const user = await createMarketplaceUser('paginator@test.com');
    for (let i = 0; i < 5; i++) {
      await seedListing(user.id, { title: `Listing ${i}` });
    }

    const page1 = await service.searchListings({ limit: 2, page: 1 });
    expect(page1.listings).toHaveLength(2);
    expect(page1.pagination.total).toBe(5);
    expect(page1.pagination.totalPages).toBe(3);
  });
});

// ─────────────────────────────────────────────
// getListing
// ─────────────────────────────────────────────

describe('MarketplaceService.getListing', () => {
  it('returns a single active listing with seller info', async () => {
    const user = await createMarketplaceUser('getlisting@test.com');
    const seeded = await seedListing(user.id, { title: 'Find Me' });

    const listing = await service.getListing(seeded.id);
    expect(listing.id).toBe(seeded.id);
    expect(listing.sellerUser).toBeDefined();
    expect(listing.sellerUser?.id).toBe(user.id);
  });

  it('throws 404 for unknown id', async () => {
    await expect(
      service.getListing('00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 for inactive listing', async () => {
    const user = await createMarketplaceUser('inactive@test.com');
    const seeded = await seedListing(user.id, {
      status: ListingStatus.INACTIVE,
    });

    await expect(service.getListing(seeded.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ─────────────────────────────────────────────
// getMyListings
// ─────────────────────────────────────────────

describe('MarketplaceService.getMyListings', () => {
  it('returns all listings owned by the user regardless of status', async () => {
    const user = await createMarketplaceUser('mylistings@test.com');
    const other = await createMarketplaceUser('other@test.com');

    await seedListing(user.id, { title: 'My Active' });
    await seedListing(user.id, {
      title: 'My Inactive',
      status: ListingStatus.INACTIVE,
    });
    await seedListing(other.id, { title: 'Not Mine' });

    const result = await service.getMyListings(user.id, {});
    expect(result.listings).toHaveLength(2);
    expect(result.listings.every((l) => l.sellerUserId === user.id)).toBe(true);
  });

  it('returns empty list for user with no listings', async () => {
    const user = await createMarketplaceUser('empty@test.com');
    const result = await service.getMyListings(user.id, {});
    expect(result.listings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// deactivateListing
// ─────────────────────────────────────────────

describe('MarketplaceService.deactivateListing', () => {
  it('sets listing status to INACTIVE', async () => {
    const user = await createMarketplaceUser('deactivate@test.com');
    const listing = await seedListing(user.id);

    const result = await service.deactivateListing(user.id, listing.id);
    expect(result.status).toBe(ListingStatus.INACTIVE);
  });

  it('throws 404 for unknown listing', async () => {
    const user = await createMarketplaceUser('notfound@test.com');
    await expect(
      service.deactivateListing(user.id, '00000000-0000-0000-0000-000000000000')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when user does not own the listing', async () => {
    const owner = await createMarketplaceUser('owner@test.com');
    const intruder = await createMarketplaceUser('intruder@test.com');
    const listing = await seedListing(owner.id);

    await expect(
      service.deactivateListing(intruder.id, listing.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when listing is already inactive', async () => {
    const user = await createMarketplaceUser('already@test.com');
    const listing = await seedListing(user.id, {
      status: ListingStatus.INACTIVE,
    });

    await expect(
      service.deactivateListing(user.id, listing.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

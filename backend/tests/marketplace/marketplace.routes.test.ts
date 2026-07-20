/**
 * @file tests/marketplace/marketplace.routes.test.ts
 * @description Supertest integration tests for marketplace routes.
 *
 * Routes under test:
 *   GET    /marketplace/search
 *   GET    /marketplace/my-listings
 *   GET    /marketplace/:listingId
 *   POST   /marketplace/create
 *   PATCH  /marketplace/:listingId/deactivate
 *
 * DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
  })),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
    updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
    getUserGroups: vi.fn().mockResolvedValue([]),
    getGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupById: vi.fn().mockResolvedValue(null),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  createMarketplaceUser,
  makeMarketplaceToken,
  seedListing,
} from './helpers.js';
import { ListingStatus } from '@prisma/client';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────
// GET /marketplace/search
// ─────────────────────────────────────────────

describe('GET /marketplace/search', () => {
  it('200 with empty list when no listings exist', async () => {
    const res = await request(app).get('/api/v1/marketplace/search');
    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(0);
  });

  it('200 returns active listings', async () => {
    const user = await createMarketplaceUser('search1@test.com');
    await seedListing(user.id, { title: 'Borehole Drilling Services' });

    const res = await request(app).get('/api/v1/marketplace/search');
    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(1);
  });

  it('400 for invalid wardId format', async () => {
    const res = await request(app).get(
      '/api/v1/marketplace/search?wardId=not-a-uuid'
    );
    expect(res.status).toBe(400);
  });

  it('200 filters by type', async () => {
    const user = await createMarketplaceUser('typefilter@test.com');
    await seedListing(user.id, { listingType: 'OFFER' });
    await seedListing(user.id, { listingType: 'REQUEST' });

    const res = await request(app).get(
      '/api/v1/marketplace/search?type=REQUEST'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.listings[0].listingType).toBe('REQUEST');
  });
});

// ─────────────────────────────────────────────
// GET /marketplace/my-listings
// ─────────────────────────────────────────────

describe('GET /marketplace/my-listings', () => {
  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/marketplace/my-listings');
    expect(res.status).toBe(401);
  });

  it('200 returns only the authenticated user listings', async () => {
    const user = await createMarketplaceUser('mylistings1@test.com');
    const other = await createMarketplaceUser('otheruser@test.com');
    const token = makeMarketplaceToken(user.id);

    await seedListing(user.id, { title: 'My Listing' });
    await seedListing(other.id, { title: 'Other Listing' });

    const res = await request(app)
      .get('/api/v1/marketplace/my-listings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.listings[0].title).toBe('My Listing');
  });

  it('200 includes inactive listings in own view', async () => {
    const user = await createMarketplaceUser('myinactive@test.com');
    const token = makeMarketplaceToken(user.id);

    await seedListing(user.id, { title: 'Active' });
    await seedListing(user.id, {
      title: 'Inactive',
      status: ListingStatus.INACTIVE,
    });

    const res = await request(app)
      .get('/api/v1/marketplace/my-listings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────
// GET /marketplace/:listingId
// ─────────────────────────────────────────────

describe('GET /marketplace/:listingId', () => {
  it('200 returns listing details', async () => {
    const user = await createMarketplaceUser('getone@test.com');
    const listing = await seedListing(user.id, { title: 'Specific Listing' });

    const res = await request(app).get(
      `/api/v1/marketplace/${listing.id}`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Specific Listing');
    expect(res.body.data.sellerUser).toBeDefined();
  });

  it('404 for unknown listing id', async () => {
    const res = await request(app).get(
      '/api/v1/marketplace/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
  });

  it('400 for non-UUID listing id', async () => {
    const res = await request(app).get('/api/v1/marketplace/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /marketplace/create
// ─────────────────────────────────────────────

describe('POST /marketplace/create', () => {
  it('401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/create')
      .send({ title: 'Test', description: 'Test description longer', type: 'OFFER' });
    expect(res.status).toBe(401);
  });

  it('201 creates listing for authenticated user', async () => {
    const user = await createMarketplaceUser('creator@test.com');
    const token = makeMarketplaceToken(user.id);

    const res = await request(app)
      .post('/api/v1/marketplace/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Plumbing Services',
        description: 'Professional plumbing repair and installation services',
        type: 'OFFER',
        priceGuideKes: 3000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Plumbing Services');
    expect(res.body.data.sellerUserId).toBe(user.id);
  });

  it('400 when title is too short', async () => {
    const user = await createMarketplaceUser('shortitle@test.com');
    const token = makeMarketplaceToken(user.id);

    const res = await request(app)
      .post('/api/v1/marketplace/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hi', description: 'Description long enough to pass', type: 'OFFER' });

    expect(res.status).toBe(400);
  });

  it('400 when type is invalid', async () => {
    const user = await createMarketplaceUser('badtype@test.com');
    const token = makeMarketplaceToken(user.id);

    const res = await request(app)
      .post('/api/v1/marketplace/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Valid title here',
        description: 'Valid description that is long enough for the validator',
        type: 'SALE',
      });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// PATCH /marketplace/:listingId/deactivate
// ─────────────────────────────────────────────

describe('PATCH /marketplace/:listingId/deactivate', () => {
  it('401 without token', async () => {
    const user = await createMarketplaceUser('deact401@test.com');
    const listing = await seedListing(user.id);

    const res = await request(app).patch(
      `/api/v1/marketplace/${listing.id}/deactivate`
    );
    expect(res.status).toBe(401);
  });

  it('200 owner can deactivate their own listing', async () => {
    const user = await createMarketplaceUser('deactowner@test.com');
    const token = makeMarketplaceToken(user.id);
    const listing = await seedListing(user.id);

    const res = await request(app)
      .patch(`/api/v1/marketplace/${listing.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');
  });

  it('403 non-owner cannot deactivate', async () => {
    const owner = await createMarketplaceUser('deactowner2@test.com');
    const intruder = await createMarketplaceUser('deactintruder@test.com');
    const token = makeMarketplaceToken(intruder.id);
    const listing = await seedListing(owner.id);

    const res = await request(app)
      .patch(`/api/v1/marketplace/${listing.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('404 for unknown listing id', async () => {
    const user = await createMarketplaceUser('deact404@test.com');
    const token = makeMarketplaceToken(user.id);

    const res = await request(app)
      .patch('/api/v1/marketplace/00000000-0000-0000-0000-000000000000/deactivate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('400 for non-UUID listing id', async () => {
    const user = await createMarketplaceUser('deactbad@test.com');
    const token = makeMarketplaceToken(user.id);

    const res = await request(app)
      .patch('/api/v1/marketplace/not-a-uuid/deactivate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

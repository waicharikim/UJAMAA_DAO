/**
 * @file tests/posts/post.routes.test.ts
 * @description Supertest integration tests for posts routes.
 *
 * Routes under test:
 *   GET  /api/v1/posts          — requires authenticate only
 *   POST /api/v1/posts          — requires authenticate + COMMUNITY_VERIFIED
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
    SMS: {
      send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
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

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  seedLocation,
  seedSecondWard,
  createPostUser,
  makePostToken,
  seedPost,
  TEST_WARD_ID,
  TEST_WARD_ID_B,
} from './helpers.js';

beforeAll(async () => {
  await servicesReady;
});

beforeEach(async () => {
  await seedLocation();
  await seedSecondWard();
});

// ─────────────────────────────────────────────
// GET /api/v1/posts
// ─────────────────────────────────────────────

describe('GET /api/v1/posts', () => {
  it('401 without auth token', async () => {
    const res = await request(app).get('/api/v1/posts');
    expect(res.status).toBe(401);
  });

  it('200 with EMAIL_VERIFIED user (GET only requires authenticate)', async () => {
    const user = await createPostUser('get1@test.com', {
      verificationLevel: 'EMAIL_VERIFIED',
    });
    const token = makePostToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .get('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('nextCursor');
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('200 returns empty feed when no posts exist', async () => {
    const user = await createPostUser('get2@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .get('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it('200 returns seeded posts in response shape', async () => {
    const user = await createPostUser('get3@test.com');
    const token = makePostToken(user.id);
    await seedPost(user.id, TEST_WARD_ID, { content: 'Hello community' });

    const res = await request(app)
      .get('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const item = res.body.data.items[0];
    expect(item).toMatchObject({
      content: 'Hello community',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: user.id,
      communityName: 'Test Ward',
    });
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('createdAt');
    expect(item).toHaveProperty('authorName');
    expect(item).toHaveProperty('authorInitials');
    expect(item).not.toHaveProperty('wardName');
  });

  it('scope filter: ?scope=NATIONAL only returns national posts', async () => {
    const user = await createPostUser('get4@test.com');
    const token = makePostToken(user.id);
    await seedPost(user.id, TEST_WARD_ID, { content: 'Ward post', scope: 'WARD' });
    await seedPost(user.id, TEST_WARD_ID, {
      content: 'National post',
      scope: 'NATIONAL',
    });

    const res = await request(app)
      .get('/api/v1/posts?scope=NATIONAL')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('type filter: ?type=ANNOUNCEMENT filters correctly', async () => {
    const user = await createPostUser('get5@test.com');
    const token = makePostToken(user.id);
    await seedPost(user.id, TEST_WARD_ID, { content: 'Notice', type: 'NOTICE' });
    await seedPost(user.id, TEST_WARD_ID, {
      content: 'Announcement',
      type: 'ANNOUNCEMENT',
      scope: 'NATIONAL',
    });

    const res = await request(app)
      .get('/api/v1/posts?type=ANNOUNCEMENT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(
      res.body.data.items.every((p: { type: string }) => p.type === 'ANNOUNCEMENT')
    ).toBe(true);
  });

  it('400 for invalid scope value', async () => {
    const user = await createPostUser('get6@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .get('/api/v1/posts?scope=INVALID')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('pagination: ?limit=1 returns nextCursor when more posts exist', async () => {
    const user = await createPostUser('get7@test.com');
    const token = makePostToken(user.id);
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await seedPost(user.id, TEST_WARD_ID, {
        content: `Paged post ${i}`,
        scope: 'NATIONAL',
        createdAt: new Date(now - i * 1000),
      });
    }

    const res = await request(app)
      .get('/api/v1/posts?scope=NATIONAL&limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.nextCursor).not.toBeNull();
  });

  it('dual-ward: user sees posts from both wards', async () => {
    const user = await createPostUser('get8@test.com', {
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID_B,
    });
    const other = await createPostUser('get8b@test.com', {
      primaryWardId: TEST_WARD_ID_B,
    });
    const token = makePostToken(user.id);

    await seedPost(user.id, TEST_WARD_ID, { content: 'From ward A', scope: 'WARD' });
    await seedPost(other.id, TEST_WARD_ID_B, { content: 'From ward B', scope: 'WARD' });

    const res = await request(app)
      .get('/api/v1/posts?scope=WARD')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const contents = res.body.data.items.map((p: { content: string }) => p.content);
    expect(contents).toContain('From ward A');
    expect(contents).toContain('From ward B');
  });
});

// ─────────────────────────────────────────────
// POST /api/v1/posts
// ─────────────────────────────────────────────

describe('POST /api/v1/posts', () => {
  it('401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .send({ content: 'Hello', scope: 'WARD' });

    expect(res.status).toBe(401);
  });

  it('403 when user is EMAIL_VERIFIED (not COMMUNITY_VERIFIED)', async () => {
    const user = await createPostUser('post1@test.com', {
      verificationLevel: 'EMAIL_VERIFIED',
    });
    const token = makePostToken(user.id, 'EMAIL_VERIFIED');

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello', scope: 'WARD' });

    expect(res.status).toBe(403);
  });

  it('201 with COMMUNITY_VERIFIED user — creates post', async () => {
    const user = await createPostUser('post2@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello community!', scope: 'WARD', type: 'NOTICE' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      content: 'Hello community!',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: user.id,
      communityName: 'Test Ward',
    });
    expect(res.body.data).not.toHaveProperty('wardName');
  });

  it('201 defaults scope to WARD and type to NOTICE when omitted', async () => {
    const user = await createPostUser('post3@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Defaults test' });

    expect(res.status).toBe(201);
    expect(res.body.data.scope).toBe('WARD');
    expect(res.body.data.type).toBe('NOTICE');
  });

  it('400 for empty content', async () => {
    const user = await createPostUser('post4@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '', scope: 'WARD' });

    expect(res.status).toBe(400);
  });

  it('400 for content exceeding 500 characters', async () => {
    const user = await createPostUser('post5@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'x'.repeat(501), scope: 'WARD' });

    expect(res.status).toBe(400);
  });

  it('400 for invalid scope value', async () => {
    const user = await createPostUser('post6@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello', scope: 'VILLAGE' });

    expect(res.status).toBe(400);
  });

  it('400 for invalid type value', async () => {
    const user = await createPostUser('post7@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello', scope: 'WARD', type: 'SPAM' });

    expect(res.status).toBe(400);
  });

  it('201 accepts ANNOUNCEMENT type with resourceUrl and resourceTitle', async () => {
    const user = await createPostUser('post8@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Resource post',
        scope: 'WARD',
        type: 'RESOURCE',
        resourceUrl: 'https://example.com/doc.pdf',
        resourceTitle: 'Important Document',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.resourceUrl).toBe('https://example.com/doc.pdf');
    expect(res.body.data.resourceTitle).toBe('Important Document');
  });

  it('201 posts into secondary ward when wardId is provided', async () => {
    const user = await createPostUser('post9@test.com', {
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID_B,
    });
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'From secondary ward',
        scope: 'WARD',
        wardId: TEST_WARD_ID_B,
      });

    expect(res.status).toBe(201);
    // communityName should reflect Ward B
    expect(res.body.data.communityName).toBe('Test Ward B');
  });

  it('400 for invalid wardId format (not a UUID)', async () => {
    const user = await createPostUser('post10@test.com');
    const token = makePostToken(user.id);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Bad ward', scope: 'WARD', wardId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });
});

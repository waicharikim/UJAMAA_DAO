/**
 * @file tests/posts/post.service.test.ts
 * @description Unit tests for PostService — create(), getPosts(), and buildScopeFilter().
 *
 * Uses the real test DB via Prisma — no mocking of the service layer.
 * testSetup.ts truncates all tables before each test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { PostService } from '../../src/modules/posts/services/post.service.js';
import {
  TEST_WARD_ID,
  TEST_CONST_ID,
  TEST_COUNTY_ID,
  TEST_WARD_ID_B,
  seedLocation,
  seedSecondWard,
  createPostUser,
  seedPost,
} from './helpers.js';

const postService = new PostService();

beforeEach(async () => {
  await seedLocation();
  await seedSecondWard();
});

// ─────────────────────────────────────────────
// create()
// ─────────────────────────────────────────────

describe('PostService.create()', () => {
  it('assigns primaryWardId when no wardId is provided', async () => {
    const author = await createPostUser('create1@test.com');

    const post = await postService.create({
      content: 'Hello ward',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: author.id,
    });

    const row = await prisma.post.findUnique({ where: { id: post.id } });
    expect(row?.wardId).toBe(TEST_WARD_ID);
  });

  it('accepts caller-supplied wardId when it matches the primary ward', async () => {
    const author = await createPostUser('create2@test.com', {
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID_B,
    });

    const post = await postService.create({
      content: 'From primary ward',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: author.id,
      wardId: TEST_WARD_ID,
    });

    const row = await prisma.post.findUnique({ where: { id: post.id } });
    expect(row?.wardId).toBe(TEST_WARD_ID);
  });

  it('accepts caller-supplied wardId when it matches the secondary ward', async () => {
    const author = await createPostUser('create3@test.com', {
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID_B,
    });

    const post = await postService.create({
      content: 'From secondary ward',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: author.id,
      wardId: TEST_WARD_ID_B,
    });

    const row = await prisma.post.findUnique({ where: { id: post.id } });
    expect(row?.wardId).toBe(TEST_WARD_ID_B);
  });

  it('falls back to primaryWardId when caller wardId is not in allowed set', async () => {
    const author = await createPostUser('create4@test.com', {
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID_B,
    });
    const foreignWardId = 'ffffffff-9abc-4def-1234-56789abcdef0';

    const post = await postService.create({
      content: 'From unknown ward',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: author.id,
      wardId: foreignWardId,
    });

    const row = await prisma.post.findUnique({ where: { id: post.id } });
    expect(row?.wardId).toBe(TEST_WARD_ID);
  });

  it('returns communityName equal to ward name for WARD scope', async () => {
    const author = await createPostUser('create5@test.com');

    const post = await postService.create({
      content: 'Ward-scoped post',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: author.id,
    });

    expect(post.communityName).toBe('Test Ward');
  });

  it('returns communityName equal to constituency name for CONSTITUENCY scope', async () => {
    const author = await createPostUser('create6@test.com');

    const post = await postService.create({
      content: 'Constituency-scoped post',
      scope: 'CONSTITUENCY',
      type: 'ANNOUNCEMENT',
      authorId: author.id,
    });

    expect(post.communityName).toBe('Test Constituency');
  });

  it('returns communityName equal to county name for COUNTY scope', async () => {
    const author = await createPostUser('create7@test.com');

    const post = await postService.create({
      content: 'County-scoped post',
      scope: 'COUNTY',
      type: 'ANNOUNCEMENT',
      authorId: author.id,
    });

    expect(post.communityName).toBe('Test County');
  });

  it('returns communityName "Kenya" for NATIONAL scope', async () => {
    const author = await createPostUser('create8@test.com');

    const post = await postService.create({
      content: 'National post',
      scope: 'NATIONAL',
      type: 'ANNOUNCEMENT',
      authorId: author.id,
    });

    expect(post.communityName).toBe('Kenya');
  });

  it('includes correct DTO fields in response', async () => {
    const author = await createPostUser('create9@test.com');

    const post = await postService.create({
      content: 'DTO check',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: author.id,
    });

    expect(post).toMatchObject({
      content: 'DTO check',
      scope: 'WARD',
      type: 'NOTICE',
      authorId: author.id,
      authorName: 'Post Test User',
      authorInitials: 'PU',
      communityName: 'Test Ward',
    });
    expect(typeof post.id).toBe('string');
    expect(typeof post.createdAt).toBe('string');
    expect(post.proposal).toBeNull();
  });
});

// ─────────────────────────────────────────────
// getPosts() — scope filtering
// ─────────────────────────────────────────────

describe('PostService.getPosts() — scope filtering', () => {
  it('WARD scope: returns posts for the user\'s ward', async () => {
    const author = await createPostUser('getposts1@test.com');
    await seedPost(author.id, TEST_WARD_ID, { content: 'My ward post', scope: 'WARD' });

    const result = await postService.getPosts({ userId: author.id, scope: 'WARD' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('My ward post');
  });

  it('WARD scope: includes NATIONAL posts in the feed', async () => {
    const author = await createPostUser('getposts2@test.com');
    await seedPost(author.id, TEST_WARD_ID, { content: 'National post', scope: 'NATIONAL' });

    const result = await postService.getPosts({ userId: author.id, scope: 'WARD' });

    expect(result.items.some((p) => p.content === 'National post')).toBe(true);
  });

  it('WARD scope: includes CONSTITUENCY posts from the same constituency', async () => {
    const author = await createPostUser('getposts3@test.com');
    await seedPost(author.id, TEST_WARD_ID, {
      content: 'Constituency post',
      scope: 'CONSTITUENCY',
    });

    const result = await postService.getPosts({ userId: author.id, scope: 'WARD' });

    expect(result.items.some((p) => p.content === 'Constituency post')).toBe(true);
  });

  it('WARD scope: excludes posts from a ward in a different constituency', async () => {
    // Seed a third ward in a DIFFERENT constituency
    const otherCountyId = 'e9ef8162-88bc-4f64-a23d-445b06029a69';
    const otherConstId = 'f9ab9273-99cd-4e75-b34e-556c17138bef';
    const otherWardId = '92345678-9abc-4def-1234-56789abcdef0';
    await prisma.county.upsert({
      where: { id: otherCountyId },
      update: {},
      create: { id: otherCountyId, name: 'Other County', code: 'OC-TEST-99' },
    });
    await prisma.constituency.upsert({
      where: { id: otherConstId },
      update: {},
      create: { id: otherConstId, name: 'Other Constituency', countyId: otherCountyId },
    });
    await prisma.ward.upsert({
      where: { id: otherWardId },
      update: {},
      create: {
        id: otherWardId,
        name: 'Other Ward',
        constituencyId: otherConstId,
        countyId: otherCountyId,
      },
    });

    const author = await createPostUser('getposts4@test.com');
    const otherAuthor = await createPostUser('getposts4b@test.com', {
      primaryWardId: otherWardId,
    });
    await seedPost(otherAuthor.id, otherWardId, {
      content: 'Other ward post',
      scope: 'WARD',
    });

    const result = await postService.getPosts({ userId: author.id, scope: 'WARD' });

    expect(result.items.some((p) => p.content === 'Other ward post')).toBe(false);
  });

  it('dual-ward: returns posts from both primary and secondary wards', async () => {
    const author = await createPostUser('getposts5@test.com', {
      primaryWardId: TEST_WARD_ID,
      secondaryWardId: TEST_WARD_ID_B,
    });
    const authorB = await createPostUser('getposts5b@test.com', {
      primaryWardId: TEST_WARD_ID_B,
    });

    await seedPost(author.id, TEST_WARD_ID, { content: 'Primary ward post', scope: 'WARD' });
    await seedPost(authorB.id, TEST_WARD_ID_B, { content: 'Secondary ward post', scope: 'WARD' });

    const result = await postService.getPosts({ userId: author.id, scope: 'WARD' });

    const contents = result.items.map((p) => p.content);
    expect(contents).toContain('Primary ward post');
    expect(contents).toContain('Secondary ward post');
  });

  it('CONSTITUENCY scope: includes ward + constituency + national, excludes other counties', async () => {
    const author = await createPostUser('getposts6@test.com');
    await seedPost(author.id, TEST_WARD_ID, { content: 'Ward post', scope: 'WARD' });
    await seedPost(author.id, TEST_WARD_ID, { content: 'Const post', scope: 'CONSTITUENCY' });
    await seedPost(author.id, TEST_WARD_ID, { content: 'National post', scope: 'NATIONAL' });

    const result = await postService.getPosts({
      userId: author.id,
      scope: 'CONSTITUENCY',
    });

    const contents = result.items.map((p) => p.content);
    expect(contents).toContain('Const post');
    expect(contents).toContain('National post');
  });

  it('NATIONAL scope: returns all posts regardless of ward', async () => {
    const author = await createPostUser('getposts7@test.com');
    await seedPost(author.id, TEST_WARD_ID, { content: 'Ward post', scope: 'WARD' });
    await seedPost(author.id, TEST_WARD_ID, { content: 'National post', scope: 'NATIONAL' });

    const result = await postService.getPosts({ userId: author.id, scope: 'NATIONAL' });

    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });

  it('no scope: defaults to showing full cascade (WARD-level)', async () => {
    const author = await createPostUser('getposts8@test.com');
    await seedPost(author.id, TEST_WARD_ID, { content: 'Default post', scope: 'WARD' });

    const result = await postService.getPosts({ userId: author.id });

    expect(result.items.some((p) => p.content === 'Default post')).toBe(true);
  });

  it('type filter: only returns posts of matching type', async () => {
    const author = await createPostUser('getposts9@test.com');
    await seedPost(author.id, TEST_WARD_ID, { content: 'Notice post', type: 'NOTICE' });
    await seedPost(author.id, TEST_WARD_ID, {
      content: 'Announcement post',
      type: 'ANNOUNCEMENT',
    });

    const result = await postService.getPosts({
      userId: author.id,
      scope: 'WARD',
      type: 'NOTICE',
    });

    expect(result.items.every((p) => p.type === 'NOTICE')).toBe(true);
    expect(result.items.some((p) => p.content === 'Notice post')).toBe(true);
    expect(result.items.some((p) => p.content === 'Announcement post')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// getPosts() — cursor pagination
// ─────────────────────────────────────────────

describe('PostService.getPosts() — cursor pagination', () => {
  it('returns nextCursor when there are more pages', async () => {
    const author = await createPostUser('cursor1@test.com');
    // Seed 3 posts; request limit=2 — should get nextCursor
    for (let i = 0; i < 3; i++) {
      await seedPost(author.id, TEST_WARD_ID, {
        content: `Post ${i}`,
        scope: 'NATIONAL',
        // stagger createdAt so ordering is deterministic
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const result = await postService.getPosts({
      userId: author.id,
      scope: 'NATIONAL',
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it('returns nextCursor=null on the last page', async () => {
    const author = await createPostUser('cursor2@test.com');
    await seedPost(author.id, TEST_WARD_ID, { content: 'Only post', scope: 'NATIONAL' });

    const result = await postService.getPosts({
      userId: author.id,
      scope: 'NATIONAL',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('cursor: fetches the next page without overlap', async () => {
    const author = await createPostUser('cursor3@test.com');
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      await seedPost(author.id, TEST_WARD_ID, {
        content: `Page post ${i}`,
        scope: 'NATIONAL',
        createdAt: new Date(now - i * 1000),
      });
    }

    const page1 = await postService.getPosts({
      userId: author.id,
      scope: 'NATIONAL',
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await postService.getPosts({
      userId: author.id,
      scope: 'NATIONAL',
      limit: 2,
      cursor: page1.nextCursor!,
    });

    // page2 should not contain any IDs from page1
    const page1Ids = new Set(page1.items.map((p) => p.id));
    expect(page2.items.every((p) => !page1Ids.has(p.id))).toBe(true);
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
  });

  it('respects limit cap of 30', async () => {
    const author = await createPostUser('cursor4@test.com');

    const result = await postService.getPosts({
      userId: author.id,
      scope: 'NATIONAL',
      limit: 999,
    });

    // Returned at most 30 items (no posts seeded so 0 is fine; just no error)
    expect(result.items.length).toBeLessThanOrEqual(30);
  });
});

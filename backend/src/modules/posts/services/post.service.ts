import { Prisma } from '@prisma/client';
import { prisma } from '../../../core/database/client.js';

export type PostScope = 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL';

interface CreatePostInput {
  content: string;
  scope: PostScope;
  authorId: string;
}

interface GetPostsInput {
  userId: string;
  scope?: PostScope;
  cursor?: string;
  limit?: number;
}

type PostWithRelations = {
  id: string;
  content: string;
  scope: string;
  createdAt: Date;
  author: { id: string; name: string | null };
  ward: { name: string } | null;
};

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toDto(post: PostWithRelations) {
  return {
    id: post.id,
    content: post.content,
    scope: post.scope,
    authorId: post.author.id,
    authorName: post.author.name ?? 'Community Member',
    authorInitials: initials(post.author.name),
    wardName: post.ward?.name ?? null,
    createdAt: post.createdAt.toISOString(),
  };
}

export class PostService {
  async create(input: CreatePostInput) {
    const user = await prisma.user.findUnique({
      where: { id: input.authorId },
      select: { primaryWardId: true },
    });

    const post = await prisma.post.create({
      data: {
        content: input.content,
        scope: input.scope,
        authorId: input.authorId,
        wardId: user?.primaryWardId ?? null,
      },
      include: {
        author: { select: { id: true, name: true } },
        ward: { select: { name: true } },
      },
    });

    return toDto(post);
  }

  async getPosts(input: GetPostsInput) {
    const limit = Math.min(input.limit ?? 20, 30);

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        primaryWardId: true,
        primaryWard: { select: { constituencyId: true, countyId: true } },
      },
    });

    const wardId = user?.primaryWardId ?? null;
    const constituencyId = user?.primaryWard?.constituencyId ?? null;
    const countyId = user?.primaryWard?.countyId ?? null;

    const scopeFilter = buildScopeFilter(input.scope, wardId, constituencyId, countyId);

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          scopeFilter,
          ...(input.cursor ? [{ createdAt: { lt: new Date(input.cursor) } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        author: { select: { id: true, name: true } },
        ward: { select: { name: true } },
      },
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? page[page.length - 1].createdAt.toISOString()
      : null;

    return { items: page.map(toDto), nextCursor };
  }
}

function buildScopeFilter(
  scope: PostScope | undefined,
  wardId: string | null,
  constituencyId: string | null,
  countyId: string | null
): Prisma.PostWhereInput {
  if (scope === 'NATIONAL' || (!scope && !wardId)) return {};

  if (scope === 'COUNTY') {
    if (!countyId) return {};
    return { OR: [{ scope: 'NATIONAL' }, { ward: { countyId } }] };
  }

  if (scope === 'CONSTITUENCY') {
    if (!constituencyId) return {};
    return {
      OR: [
        { scope: 'NATIONAL' },
        { scope: 'COUNTY', ward: { countyId: countyId ?? undefined } },
        { ward: { constituencyId } },
      ],
    };
  }

  // WARD default
  return {
    OR: [
      { scope: 'NATIONAL' },
      { scope: 'COUNTY', ward: { countyId: countyId ?? undefined } },
      { scope: 'CONSTITUENCY', ward: { constituencyId: constituencyId ?? undefined } },
      { wardId: wardId ?? undefined },
    ],
  };
}

export const postService = new PostService();

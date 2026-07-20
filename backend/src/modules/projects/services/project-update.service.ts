import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/index.js';

interface CreateUpdateInput {
  projectId: string;
  authorId: string;
  content: string;
}

interface ListUpdatesInput {
  projectId: string;
  cursor?: string;
  limit?: number;
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
} as const;

type UpdateWithAuthor = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string | null; avatarUrl: string | null };
};

function toDto(u: UpdateWithAuthor) {
  return {
    id: u.id,
    content: u.content,
    authorId: u.author.id,
    authorName: u.author.name ?? 'Community Member',
    authorInitials: initials(u.author.name),
    authorAvatarUrl: u.author.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  };
}

export class ProjectUpdateService {
  async create(input: CreateUpdateInput) {
    // Verify author is a project member
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.authorId,
        },
      },
    });
    if (!membership) {
      throw new ApiError('Only project members can post updates', 403);
    }

    const update = await prisma.projectUpdate.create({
      data: {
        projectId: input.projectId,
        authorId: input.authorId,
        content: input.content.trim(),
      },
      include: INCLUDE,
    });

    return toDto(update);
  }

  async list(input: ListUpdatesInput) {
    const limit = Math.min(input.limit ?? 20, 30);

    const updates = await prisma.projectUpdate.findMany({
      where: {
        projectId: input.projectId,
        ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: INCLUDE,
    });

    const hasMore = updates.length > limit;
    const page = hasMore ? updates.slice(0, limit) : updates;
    return {
      items: page.map(toDto),
      nextCursor: hasMore
        ? page[page.length - 1].createdAt.toISOString()
        : null,
    };
  }
}

export const projectUpdateService = new ProjectUpdateService();

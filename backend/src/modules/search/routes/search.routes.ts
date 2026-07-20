import { Router } from 'express';
import { optionalAuthenticate } from '../../../core/middleware/auth.middleware.js';
import { asyncHandler, sendSuccess } from '../../../core/utils/response.js';
import { prisma } from '../../../core/database/client.js';

const router = Router();

router.use(optionalAuthenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();

    if (q.length < 2) {
      sendSuccess(res, { users: [], proposals: [], modules: [], groups: [] });
      return;
    }

    const limit = 5;
    const search = { contains: q, mode: 'insensitive' as const };

    const [users, proposals, modules, groups] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ name: search }, { email: search }] },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          verificationLevel: true,
        },
        take: limit,
      }),

      prisma.proposal.findMany({
        where: {
          OR: [{ title: search }, { description: search }],
          status: { not: 'DRAFT' },
        },
        select: {
          id: true,
          title: true,
          status: true,
          proposalType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),

      prisma.educationalModule.findMany({
        where: {
          OR: [{ title: search }, { description: search }],
          verified: true,
        },
        select: { id: true, title: true, category: true, difficulty: true },
        take: limit,
      }),

      prisma.group.findMany({
        where: {
          OR: [{ name: search }, { description: search }],
          status: { not: 'DISSOLVED' },
        },
        select: {
          id: true,
          name: true,
          memberCount: true,
          locationScope: true,
        },
        take: limit,
      }),
    ]);

    sendSuccess(res, { users, proposals, modules, groups });
  })
);

export default router;

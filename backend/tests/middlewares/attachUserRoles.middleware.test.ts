import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { attachUserRoles } from '../../src/middlewares/attachUserRoles.middleware.js';
import prisma from '../../src/prismaClient.js';

vi.mock('../../src/prismaClient.js');

describe('attachUserRoles Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { user: { userId: 'test-user-id' }, userRoles: undefined };
    res = {};
    next = vi.fn();
    prisma.groupMember = { findMany: vi.fn() } as any;
    prisma.projectParticipant = { findMany: vi.fn() } as any;
    prisma.userRole = { findMany: vi.fn() } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sets empty array if no userId', async () => {
    req.user = undefined;
    await attachUserRoles(req as Request, res as Response, next);
    expect(req.userRoles).toEqual([]);
    expect(next).toHaveBeenCalled();
  });

  it('attaches roles from DB', async () => {
    prisma.groupMember.findMany = vi.fn().mockResolvedValue([
      { groupId: 'grp1', role: 'ADMIN' },
      { groupId: 'grp2', role: 'MEMBER' },
    ]);
    prisma.projectParticipant.findMany = vi.fn().mockResolvedValue([
      { projectId: 'prj1', role: 'ADMIN' },
      { projectId: 'prj2', role: 'MEMBER' },
    ]);
    prisma.userRole.findMany = vi.fn().mockResolvedValue([
      { role: 'SUPER_ADMIN', scope: null },
      { role: 'COMPLIANCE_OFFICER', scope: 'county123' },
    ]);

    await attachUserRoles(req as Request, res as Response, next);

    expect(req.userRoles).toEqual([
      { role: 'group:admin', scope: 'grp1' },
      { role: 'group:member', scope: 'grp2' },
      { role: 'project:admin', scope: 'prj1' },
      { role: 'project:member', scope: 'prj2' },
      { role: 'system:super_admin', scope: undefined },
      { role: 'system:compliance_officer', scope: 'county123' },
    ]);

    expect(next).toHaveBeenCalled();
  });

  it('calls next with error if DB call fails', async () => {
    const error = new Error('DB error');
    prisma.groupMember.findMany = vi.fn().mockRejectedValue(error);

    await attachUserRoles(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
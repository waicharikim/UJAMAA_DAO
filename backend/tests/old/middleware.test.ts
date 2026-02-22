import { describe, it, expect, beforeEach, vi } from 'vitest';

// Prepare mocks BEFORE importing the middleware module
const mockPrisma = {
  groupMember: { findMany: vi.fn() },
  projectParticipant: { findMany: vi.fn() },
  userRole: { findMany: vi.fn() },
};

// IMPORTANT: mock the exact specifier the middleware uses.
// The middleware imports: import prisma from '../prismaClient.js'
// From tests/middlewares folder -> relative path is '../../src/prismaClient.js'
vi.mock('../../src/prismaClient.js', () => ({ default: mockPrisma }));

// Mock logger (match import specifier used in middleware)
vi.mock('../../src/utils/logger.js', () => ({ default: { error: () => {} } }));

// Dynamically import the middleware after mocks are configured
let attachUserRoles: any;

beforeEach(async () => {
  mockPrisma.groupMember.findMany.mockReset();
  mockPrisma.projectParticipant.findMany.mockReset();
  mockPrisma.userRole.findMany.mockReset();

  const mod = await import('../../src/middlewares/attachUserRoles.middleware');
  attachUserRoles = mod.attachUserRoles;
});

describe('attachUserRoles middleware', () => {
  it('merges DB roles (authoritative) with JWT roles', async () => {
    // Use string userId to match Prisma schema expecting string/uuid
    mockPrisma.groupMember.findMany.mockResolvedValue([{ groupId: 42, role: 'ADMIN' }]);
    mockPrisma.projectParticipant.findMany.mockResolvedValue([]);
    mockPrisma.userRole.findMany.mockResolvedValue([{ role: 'system:super_admin', scope: null }]);

    const req: any = {
      user: { userId: '123' }, // string territory
      userRoles: ['group:member:42', 'system:super_admin'], // JWT claims
      path: '/test',
    };

    let nextCalled = false;
    const next = (err?: any) => {
      if (err) throw err;
      nextCalled = true;
    };

    await attachUserRoles(req, {} as any, next);

    expect(nextCalled).toBe(true);
    const roles = req.userRoles.map((r: any) => `${r.role}::${r.scope ?? ''}`);
    expect(roles).toContain('group:admin::42');
    expect(roles).toContain('system:super_admin::');
  });
});
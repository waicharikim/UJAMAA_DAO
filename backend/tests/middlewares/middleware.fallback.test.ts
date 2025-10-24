// tests/middlewares/middleware.fallback.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = {
  groupMember: { findMany: vi.fn() },
  projectParticipant: { findMany: vi.fn() },
  userRole: { findMany: vi.fn() },
};
vi.mock('../../src/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../../src/utils/logger.js', () => ({ default: { error: () => {} } }));
vi.mock('../../src/utils/metrics.js', () => ({
  attachUserRolesDbErrors: { inc: vi.fn() },
  attachUserRolesJwtRejected: { inc: vi.fn() },
  attachUserRolesDuration: { startTimer: () => () => {} },
}));

let attachUserRoles: any;

beforeEach(async () => {
  process.env.ROLE_FALLBACK_TO_JWT = 'true';
  mockPrisma.groupMember.findMany.mockReset();
  mockPrisma.projectParticipant.findMany.mockReset();
  mockPrisma.userRole.findMany.mockReset();

  const mod = await import('../../src/middlewares/attachUserRoles.middleware');
  attachUserRoles = mod.attachUserRoles;
});

describe('attachUserRoles fallback', () => {
  it('falls back to validated JWT roles when DB fails and env set', async () => {
    mockPrisma.groupMember.findMany.mockRejectedValue(new Error('db down'));

    const req: any = {
      user: { userId: 'u-1' },
      userRoles: ['system:super_admin', 'custom:unknown'],
      path: '/test',
    };

    let nextCalled = false;
    let nextErr: any;
    const next = (err?: any) => {
      nextErr = err;
      nextCalled = true;
    };

    await attachUserRoles(req, {} as any, next);

    expect(nextCalled).toBe(true);
    expect(nextErr).toBeUndefined();
    // system:super_admin should be kept; custom:unknown rejected by allowlist
    const roles = req.userRoles.map((r: any) => `${r.role}::${r.scope ?? ''}`);
    expect(roles).toContain('system:super_admin::');
    expect(roles).not.toContain('custom:unknown::');
  });
});
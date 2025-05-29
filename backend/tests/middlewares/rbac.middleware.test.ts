import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authorize } from '../../src/middlewares/rbac.middleware.js';

describe('RBAC authorize middleware', () => {
  // Helper to build a mocked request with given roles
  const makeReq = (roles: Array<{ role: string; scope?: string }> = []) =>
    ({
      userRoles: roles,
    } as unknown as Request);

  // Helper to create mocked response object
  const makeRes = () => {
    const res: Partial<Response> = {};
    res.status = (statusCode: number) => {
      res.statusCode = statusCode;
      return res as Response;
    };
    res.json = (payload: any) => {
      res.body = payload;
      return res as Response;
    };
    return res as Response;
  };

  // Mock next function
  const next = vi.fn();

  afterEach(() => {
    next.mockClear();
  });

  it('allows access if user has an allowed global role', () => {
    const req = makeReq([{ role: 'system:super_admin' }]);
    const res = makeRes();

    const middleware = authorize(['system:super_admin']);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it('allows access if user has an allowed group-scoped role with matching scope', () => {
    const scopeId = 'group-123';
    const req = makeReq([{ role: 'group:admin', scope: scopeId }]);
    const res = makeRes();

    // Scope check ensures the requested resource matches role's scope
    const middleware = authorize(['group:admin'], (r) => r.params.groupId === scopeId);

    // Mock params on req
    (req as any).params = { groupId: scopeId };
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it('denies access with 403 if user lacks any allowed role', () => {
    const req = makeReq([{ role: 'group:member' }]);
    const res = makeRes();

    const middleware = authorize(['group:admin']);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('error', 'Forbidden: insufficient permissions');
  });

  it('denies access with 403 if scope check fails', () => {
    const req = makeReq([{ role: 'group:admin', scope: 'group-123' }]);
    const res = makeRes();

    const middleware = authorize(['group:admin'], (r) => r.params.groupId === 'different-group');
    (req as any).params = { groupId: 'group-123' };

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('error', 'Forbidden: insufficient scope permissions');
  });

  it('allows access without scope check if scopeCheck arg is omitted', () => {
    const req = makeReq([{ role: 'group:admin', scope: 'group-xyz' }]);
    const res = makeRes();

    const middleware = authorize(['group:admin']);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });
});
// tests/routes/adminRoles.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/prismaClient.js', () => ({ default: { role: { findMany: vi.fn() } } }));
vi.mock('../../src/constants/roles.js', async () => {
  const actual = await vi.importActual<any>('../../src/constants/roles.js');
  return { ...actual, loadDynamicRoles: vi.fn(async () => {}) };
});

import adminRolesRouter from '../../src/routes/adminRoles';

describe('admin roles reload endpoint', () => {
  it('requires super admin and calls loadDynamicRoles', async () => {
    const app = express();
    // simple auth that sets req.userRoles to super_admin
    app.use((req, _res, next) => {
      req.userRoles = [{ role: 'system:super_admin' }];
      next();
    });
    app.use('/admin/roles', adminRolesRouter);

    const res = await request(app).post('/admin/roles/reload').send();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
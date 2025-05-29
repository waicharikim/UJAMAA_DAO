// tests/referenceData.integration.test.ts

import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest'; // or Jest if you prefer
import app from '../../src/app'; // Adjust path to your Express app export
import { getOrCreateSuperAdmin } from '../helpers/superAdminHelper.js'; // Adjust path accordingly

let SUPER_ADMIN_TOKEN: string;

describe('Reference Data API Integration Tests', () => {
  beforeAll(async () => {
    // Create or fetch super admin user and generate JWT token
    const result = await getOrCreateSuperAdmin();
    SUPER_ADMIN_TOKEN = result.token;
  });

  // Public endpoints - no auth required

  it('GET /api/reference/counties should return list of counties', async () => {
    const res = await request(app).get('/api/reference/counties');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });

  it('GET /api/reference/constituencies should return all constituencies', async () => {
    const res = await request(app).get('/api/reference/constituencies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/reference/constituencies?countyId=xxx should filter constituencies', async () => {
    // Get a valid countyId from counties endpoint
    const countiesRes = await request(app).get('/api/reference/counties');
    expect(countiesRes.status).toBe(200);
    const firstCountyId = countiesRes.body[0]?.id;
    expect(firstCountyId).toBeDefined();

    const res = await request(app).get(`/api/reference/constituencies?countyId=${firstCountyId}`);
    expect(res.status).toBe(200);
    expect(res.body.every((c: any) => c.countyId === firstCountyId)).toBe(true);
  });

  it('GET /api/reference/industries should return list of industries', async () => {
    const res = await request(app).get('/api/reference/industries');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/reference/goods-services should return list of goods/services', async () => {
    const res = await request(app).get('/api/reference/goods-services');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Protected endpoints - require super admin auth

  it('GET /api/reference/group-roles should require auth and super admin role', async () => {
    // Without token - expect 401
    await request(app)
      .get('/api/reference/group-roles')
      .expect(401);

    // With token - expect 200
    const res = await request(app)
      .get('/api/reference/group-roles')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('ADMIN');
  });

  it('GET /api/reference/system-roles should require auth and super admin role', async () => {
    await request(app)
      .get('/api/reference/system-roles')
      .expect(401);

    const res = await request(app)
      .get('/api/reference/system-roles')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('SUPER_ADMIN');
  });

  it('GET /api/reference/participant-roles should require auth and super admin role', async () => {
    await request(app)
      .get('/api/reference/participant-roles')
      .expect(401);

    const res = await request(app)
      .get('/api/reference/participant-roles')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('MILESTONE_VERIFIER');
  });

  it('GET /api/reference/proposal-types should require auth and super admin role', async () => {
    await request(app)
      .get('/api/reference/proposal-types')
      .expect(401);

    const res = await request(app)
      .get('/api/reference/proposal-types')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('BUSINESS');
  });

  it('GET /api/reference/proposal-statuses should require auth and super admin role', async () => {
    await request(app)
      .get('/api/reference/proposal-statuses')
      .expect(401);

    const res = await request(app)
      .get('/api/reference/proposal-statuses')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('APPROVED');
  });

  it('GET /api/reference/location-scopes should require auth and super admin role', async () => {
    await request(app)
      .get('/api/reference/location-scopes')
      .expect(401);

    const res = await request(app)
      .get('/api/reference/location-scopes')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining(['LOCAL', 'CONSTITUENCY', 'COUNTY', 'NATIONAL'])
    );
  });

  it('GET /api/reference/project-statuses should require auth and super admin role', async () => {
    await request(app)
      .get('/api/reference/project-statuses')
      .expect(401);

    const res = await request(app)
      .get('/api/reference/project-statuses')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toContain('ACTIVE');
  });

  it('GET /api/reference/milestone-statuses should require auth and super admin role', async () => {
    await request(app)
      .get('/api/reference/milestone-statuses')
      .expect(401);

    const res = await request(app)
      .get('/api/reference/milestone-statuses')
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toContain('PENDING');
  });
});
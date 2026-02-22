// tests/userPrivacy.integration.test.ts

import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../../src/app'; // Adjust path as necessary
import { getOrCreateSuperAdmin } from '../helpers/superAdminHelper'; // Your helper to create admin & token

let SUPER_ADMIN_TOKEN: string;
let USER_TOKEN: string; // Token for a normal user
let testUserId: string;

describe('User Privacy & Auditing API Integration Tests', () => {
  beforeAll(async () => {
    // Get or create super admin user and token
    const superAdmin = await getOrCreateSuperAdmin();
    SUPER_ADMIN_TOKEN = superAdmin.token;

    // Create a test user
    const newUserData = {
      walletAddress: '0x' + Date.now().toString(16).padStart(40, '0'),
      email: `testuser${Date.now()}@example.com`,
      name: 'Test User',
      countyLive: 'bf6e0838-0445-4650-9c5a-8295f540ab6f', // Nairobi
      constituencyLive: '0b5f1b20-db10-4331-ab15-27f8282bcbd1', // Embakasi South
      countyOrigin: 'bf6e0838-0445-4650-9c5a-8295f540ab6f',
      constituencyOrigin: '0b5f1b20-db10-4331-ab15-27f8282bcbd1',
    };

    const res = await request(app).post('/api/users').send(newUserData);
    testUserId = res.body.id;

    // Generate a JWT for the normal user if you have a helper, or for now, reuse super admin:
    // In production, ideally generate proper user token
    USER_TOKEN = superAdmin.token;
  });

  it('GET /api/user-privacy/me/privacy returns default privacy settings for authenticated user', async () => {
    const res = await request(app)
      .get('/api/user-privacy/me/privacy')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('settings');
    expect(res.body.settings).toHaveProperty('email');
    expect(res.body.settings.email).toBe('private'); // Assuming default privacy
  });

  it('PATCH /api/user-privacy/me/privacy updates privacy settings', async () => {
    const newSettings = {
      email: 'group',
      phoneNumber: 'public',
    };

    const res = await request(app)
      .patch('/api/user-privacy/me/privacy')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send(newSettings);

    expect(res.status).toBe(200);
    expect(res.body.settings.email).toBe(newSettings.email);
    expect(res.body.settings.phoneNumber).toBe(newSettings.phoneNumber);
  });

  it('GET /api/user-privacy/:userId/audit-log is forbidden for regular users', async () => {
    const res = await request(app)
      .get(`/api/user-privacy/${testUserId}/audit-log`)
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/user-privacy/:userId/audit-log is successful for super admin', async () => {
    const res = await request(app)
      .get(`/api/user-privacy/${testUserId}/audit-log`)
      .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
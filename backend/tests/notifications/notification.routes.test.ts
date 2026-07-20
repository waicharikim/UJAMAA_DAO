/**
 * @file tests/notifications/notification.routes.test.ts
 * @description Supertest integration tests for notifications module routes.
 *
 * Routes under test:
 *   GET    /notifications
 *   GET    /notifications/unread-count
 *   POST   /notifications/mark-read
 *   POST   /notifications/mark-all-read
 *   GET    /notifications/preferences
 *   PUT    /notifications/preferences
 *
 * DB truncated before each test by testSetup.ts.
 */

// ─────────────────────────────────────────────
// Mocks — must be before all imports
// ─────────────────────────────────────────────

vi.mock('../../src/core/services/token-blacklist.service.js', () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
    revoke: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/utils/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendLoginEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: {
      send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }),
    },
  })),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: {
    enrollInSystemGroups: vi.fn().mockResolvedValue(undefined),
    updateResidenceGroups: vi.fn().mockResolvedValue(undefined),
    getUserGroups: vi.fn().mockResolvedValue([]),
    getGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupById: vi.fn().mockResolvedValue(null),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import { prisma } from '../../src/core/database/client.js';
import {
  createNotificationUser,
  seedNotification,
  makeNotificationToken,
} from './helpers.js';

const BASE = '/api/v1/notifications';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /notifications', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty array when no notifications', async () => {
    const user = await createNotificationUser('get-empty@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns notifications with isRead field (not read)', async () => {
    const user = await createNotificationUser('get-isread@test.com');
    const token = makeNotificationToken(user.id);
    await seedNotification(user.id, 'Hello', false);

    const res = await request(app).get(BASE).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('isRead', false);
    expect(res.body.data[0]).not.toHaveProperty('read');
  });

  it('filters to unread only with ?unread=true', async () => {
    const user = await createNotificationUser('get-unread@test.com');
    const token = makeNotificationToken(user.id);
    await seedNotification(user.id, 'Unread', false);
    await seedNotification(user.id, 'Read', true);

    const res = await request(app)
      .get(`${BASE}?unread=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isRead).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications/unread-count
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /notifications/unread-count', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`${BASE}/unread-count`);
    expect(res.status).toBe(401);
  });

  it('returns count: 0 when no unread notifications', async () => {
    const user = await createNotificationUser('count-zero@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .get(`${BASE}/unread-count`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it('returns correct unread count', async () => {
    const user = await createNotificationUser('count-two@test.com');
    const token = makeNotificationToken(user.id);
    await seedNotification(user.id, 'N1', false);
    await seedNotification(user.id, 'N2', false);
    await seedNotification(user.id, 'N3', true);

    const res = await request(app)
      .get(`${BASE}/unread-count`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/mark-read
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /notifications/mark-read', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`${BASE}/mark-read`)
      .send({ notificationId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing notificationId', async () => {
    const user = await createNotificationUser('mr-bad@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .post(`${BASE}/mark-read`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID notificationId', async () => {
    const user = await createNotificationUser('mr-bad2@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .post(`${BASE}/mark-read`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notificationId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('marks a notification as read', async () => {
    const user = await createNotificationUser('mr-ok@test.com');
    const token = makeNotificationToken(user.id);
    const notif = await seedNotification(user.id, 'Mark me', false);

    const res = await request(app)
      .post(`${BASE}/mark-read`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notificationId: notif.id });

    expect(res.status).toBe(200);

    // Verify in DB via unread count
    const countRes = await request(app)
      .get(`${BASE}/unread-count`)
      .set('Authorization', `Bearer ${token}`);
    expect(countRes.body.data.count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/mark-all-read
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /notifications/mark-all-read', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`${BASE}/mark-all-read`);
    expect(res.status).toBe(401);
  });

  it('marks all unread notifications as read', async () => {
    const user = await createNotificationUser('mar-ok@test.com');
    const token = makeNotificationToken(user.id);
    await seedNotification(user.id, 'N1', false);
    await seedNotification(user.id, 'N2', false);

    const res = await request(app)
      .post(`${BASE}/mark-all-read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const countRes = await request(app)
      .get(`${BASE}/unread-count`)
      .set('Authorization', `Bearer ${token}`);
    expect(countRes.body.data.count).toBe(0);
  });

  it('is a no-op when there are no unread notifications', async () => {
    const user = await createNotificationUser('mar-noop@test.com');
    const token = makeNotificationToken(user.id);
    await seedNotification(user.id, 'Already read', true);

    const res = await request(app)
      .post(`${BASE}/mark-all-read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications/preferences
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /notifications/preferences', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`${BASE}/preferences`);
    expect(res.status).toBe(401);
  });

  it('returns empty array when no preferences set', async () => {
    const user = await createNotificationUser('prefs-get-empty@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .get(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns preferences for the authenticated user', async () => {
    const user = await createNotificationUser('prefs-get-ok@test.com');
    const token = makeNotificationToken(user.id);
    await prisma.notificationPreference.create({
      data: { userId: user.id, channel: 'IN_APP', category: 'GOVERNANCE', enabled: true },
    });

    const res = await request(app)
      .get(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ channel: 'IN_APP', category: 'GOVERNANCE', enabled: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /notifications/preferences
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /notifications/preferences', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put(`${BASE}/preferences`)
      .send({ channel: 'IN_APP', category: 'GOVERNANCE', enabled: false });
    expect(res.status).toBe(401);
  });

  it('returns 400 when channel is missing', async () => {
    const user = await createNotificationUser('prefs-put-bad1@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .put(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'GOVERNANCE', enabled: false });

    expect(res.status).toBe(400);
  });

  it('returns 400 when category is missing', async () => {
    const user = await createNotificationUser('prefs-put-bad2@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .put(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'IN_APP', enabled: false });

    expect(res.status).toBe(400);
  });

  it('returns 400 when enabled is missing', async () => {
    const user = await createNotificationUser('prefs-put-bad3@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .put(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'IN_APP', category: 'GOVERNANCE' });

    expect(res.status).toBe(400);
  });

  it('creates a new preference and returns 200', async () => {
    const user = await createNotificationUser('prefs-put-ok@test.com');
    const token = makeNotificationToken(user.id);

    const res = await request(app)
      .put(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'IN_APP', category: 'GOVERNANCE', enabled: false });

    expect(res.status).toBe(200);

    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_channel_category: { userId: user.id, channel: 'IN_APP', category: 'GOVERNANCE' } },
    });
    expect(pref?.enabled).toBe(false);
  });

  it('updates an existing preference', async () => {
    const user = await createNotificationUser('prefs-put-update@test.com');
    const token = makeNotificationToken(user.id);
    await prisma.notificationPreference.create({
      data: { userId: user.id, channel: 'EMAIL', category: 'ECONOMIC', enabled: true },
    });

    const res = await request(app)
      .put(`${BASE}/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'EMAIL', category: 'ECONOMIC', enabled: false });

    expect(res.status).toBe(200);

    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_channel_category: { userId: user.id, channel: 'EMAIL', category: 'ECONOMIC' } },
    });
    expect(pref?.enabled).toBe(false);
  });
});

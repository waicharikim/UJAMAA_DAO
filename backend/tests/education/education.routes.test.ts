/**
 * @file tests/education/education.routes.test.ts
 * @description Supertest integration tests for education routes.
 *
 * Routes under test:
 *   GET  /education
 *   GET  /education/:moduleId
 *   POST /education/:moduleId/start
 *   POST /education/:moduleId/complete
 *   POST /education/:moduleId/review
 *
 * DB truncated before each test by testSetup.ts.
 */

// ─── Mocks — before all imports ───────────────────────────────────────────────

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
    SMS: { send: vi.fn().mockResolvedValue({ SMSMessageData: { Recipients: [] } }) },
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

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: {
    award: vi.fn().mockResolvedValue({ balance: 75 }),
    spend: vi.fn().mockResolvedValue({ balance: 25 }),
    getBalance: vi.fn().mockResolvedValue(50),
    hasSufficient: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/modules/notifications/services/notification.service.js', () => ({
  notificationService: {
    send: vi.fn().mockResolvedValue(undefined),
    getNotifications: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/modules/audit/services/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  createEducationUser,
  makeEducationToken,
  seedModule,
  seedProgress,
} from './helpers.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────
// GET /education
// ─────────────────────────────────────────────

describe('GET /education', () => {
  it('200 with empty list when no modules exist', async () => {
    const res = await request(app).get('/api/v1/education');
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('200 returns verified modules', async () => {
    const creator = await createEducationUser('route-list-c@test.com');
    await seedModule(creator.id, { verified: true });
    await seedModule(creator.id, { verified: false });

    const res = await request(app).get('/api/v1/education');
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(1);
  });

  it('200 filters by category', async () => {
    const creator = await createEducationUser('route-cat@test.com');
    await seedModule(creator.id, { category: 'governance' });
    await seedModule(creator.id, { category: 'economy' });

    const res = await request(app).get('/api/v1/education?category=economy');
    expect(res.status).toBe(200);
    expect(res.body.data.modules).toHaveLength(1);
    expect(res.body.data.modules[0].category).toBe('economy');
  });

  it('400 for invalid difficulty value', async () => {
    const res = await request(app).get('/api/v1/education?difficulty=ULTRA');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// GET /education/:moduleId
// ─────────────────────────────────────────────

describe('GET /education/:moduleId', () => {
  it('200 returns module without auth', async () => {
    const creator = await createEducationUser('route-getmod-c@test.com');
    const mod = await seedModule(creator.id);

    const res = await request(app).get(`/api/v1/education/${mod.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mod.id);
    expect(res.body.data.creator).toBeDefined();
    expect(res.body.data.userProgress).toBeNull();
  });

  it('200 returns userProgress when authenticated and started', async () => {
    const creator = await createEducationUser('route-getprog-c@test.com');
    const user = await createEducationUser('route-getprog-u@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .get(`/api/v1/education/${mod.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.userProgress).not.toBeNull();
    expect(res.body.data.userProgress.status).toBe('IN_PROGRESS');
  });

  it('404 for unknown moduleId', async () => {
    const res = await request(app).get(
      '/api/v1/education/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
  });

  it('400 for non-UUID moduleId', async () => {
    const res = await request(app).get('/api/v1/education/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /education/:moduleId/start
// ─────────────────────────────────────────────

describe('POST /education/:moduleId/start', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/education/00000000-0000-0000-0000-000000000001/start'
    );
    expect(res.status).toBe(401);
  });

  it('201 creates progress record', async () => {
    const creator = await createEducationUser('route-start-c@test.com');
    const user = await createEducationUser('route-start-u@test.com');
    const mod = await seedModule(creator.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.userId).toBe(user.id);
  });

  it('404 for unknown module', async () => {
    const user = await createEducationUser('route-start-404@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000000/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('400 for non-UUID moduleId', async () => {
    const user = await createEducationUser('route-start-bad@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/not-a-uuid/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /education/:moduleId/complete
// ─────────────────────────────────────────────

describe('POST /education/:moduleId/complete', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/education/00000000-0000-0000-0000-000000000001/complete'
    );
    expect(res.status).toBe(401);
  });

  it('200 marks module completed', async () => {
    const creator = await createEducationUser('route-complete-c@test.com');
    const user = await createEducationUser('route-complete-u@test.com');
    const mod = await seedModule(creator.id, { completionIP: 10 });
    await seedProgress(user.id, mod.id, 'IN_PROGRESS');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 90 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.score).toBe(90);
    expect(res.body.data.ipAwarded).toBe(10);
  });

  it('400 if module not started', async () => {
    const creator = await createEducationUser('route-cmplt-ns-c@test.com');
    const user = await createEducationUser('route-cmplt-ns-u@test.com');
    const mod = await seedModule(creator.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 for invalid score value', async () => {
    const user = await createEducationUser('route-score-bad@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000001/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 150 });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /education/:moduleId/review
// ─────────────────────────────────────────────

describe('POST /education/:moduleId/review', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/education/00000000-0000-0000-0000-000000000001/review'
    );
    expect(res.status).toBe(401);
  });

  it('201 submits review for completed module', async () => {
    const creator = await createEducationUser('route-review-c@test.com');
    const user = await createEducationUser('route-review-u@test.com');
    const mod = await seedModule(creator.id);
    await seedProgress(user.id, mod.id, 'COMPLETED');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Very helpful!' });
    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.comment).toBe('Very helpful!');
  });

  it('400 for missing rating', async () => {
    const user = await createEducationUser('route-rev-norat@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000001/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'No rating given' });
    expect(res.status).toBe(400);
  });

  it('400 for rating out of range', async () => {
    const user = await createEducationUser('route-rev-range@test.com');
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post('/api/v1/education/00000000-0000-0000-0000-000000000001/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 6 });
    expect(res.status).toBe(400);
  });

  it('400 if module not completed', async () => {
    const creator = await createEducationUser('route-rev-nc-c@test.com');
    const user = await createEducationUser('route-rev-nc-u@test.com');
    const mod = await seedModule(creator.id);
    const token = makeEducationToken(user.id);

    const res = await request(app)
      .post(`/api/v1/education/${mod.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4 });
    expect(res.status).toBe(400);
  });
});

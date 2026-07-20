/**
 * @file tests/onboarding/onboarding.routes.test.ts
 * @description Supertest integration tests for onboarding routes.
 *
 * Routes under test:
 *   GET   /onboarding/progress
 *   POST  /onboarding/tutorial/:tutorialKey/complete
 *   POST  /onboarding/milestone
 */

// ─────────────────────────────────────────────
// Mocks
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
    award: vi.fn().mockResolvedValue(undefined),
    spend: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { servicesReady } from '../../src/app.js';
import {
  createOnboardingUser,
  seedTutorial,
  makeOnboardingToken,
} from './helpers.js';

beforeAll(async () => {
  await servicesReady;
});

// ─────────────────────────────────────────────
// GET /onboarding/progress
// ─────────────────────────────────────────────

describe('GET /onboarding/progress', () => {
  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/onboarding/progress');
    expect(res.status).toBe(401);
  });

  it('200 returns empty progress for new user', async () => {
    const user = await createOnboardingUser('proguser@test.com');
    const token = makeOnboardingToken(user.id);

    const res = await request(app)
      .get('/api/v1/onboarding/progress')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.progress).toBeNull();
    expect(res.body.data.tutorials).toEqual([]);
    expect(res.body.data.completions).toEqual([]);
  });

  it('200 includes tutorials when they exist', async () => {
    const user = await createOnboardingUser('progwithdata@test.com');
    const token = makeOnboardingToken(user.id);
    await seedTutorial('platform_intro');

    const res = await request(app)
      .get('/api/v1/onboarding/progress')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tutorials).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
// POST /onboarding/tutorial/:tutorialKey/complete
// ─────────────────────────────────────────────

describe('POST /onboarding/tutorial/:tutorialKey/complete', () => {
  it('401 without token', async () => {
    const res = await request(app).post(
      '/api/v1/onboarding/tutorial/platform_intro/complete'
    );
    expect(res.status).toBe(401);
  });

  it('200 completes a tutorial', async () => {
    const user = await createOnboardingUser('tut_complete@test.com');
    const token = makeOnboardingToken(user.id);
    await seedTutorial('marketplace_intro');

    const res = await request(app)
      .post('/api/v1/onboarding/tutorial/marketplace_intro/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.completed).toBe(true);
  });

  it('404 for unknown tutorial key', async () => {
    const user = await createOnboardingUser('unknown_key@test.com');
    const token = makeOnboardingToken(user.id);

    const res = await request(app)
      .post('/api/v1/onboarding/tutorial/does_not_exist/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('400 for invalid tutorialKey format', async () => {
    const user = await createOnboardingUser('bad_key@test.com');
    const token = makeOnboardingToken(user.id);

    const res = await request(app)
      .post('/api/v1/onboarding/tutorial/INVALID-KEY!/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /onboarding/milestone
// ─────────────────────────────────────────────

describe('POST /onboarding/milestone', () => {
  it('401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/milestone')
      .send({ milestoneKey: 'first_vote' });
    expect(res.status).toBe(401);
  });

  it('200 marks a milestone', async () => {
    const user = await createOnboardingUser('milestone_route@test.com');
    const token = makeOnboardingToken(user.id);

    const res = await request(app)
      .post('/api/v1/onboarding/milestone')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneKey: 'first_vote' });

    expect(res.status).toBe(200);
    expect(res.body.data.milestoneKey).toBe('first_vote');
  });

  it('400 when milestoneKey is missing', async () => {
    const user = await createOnboardingUser('no_key@test.com');
    const token = makeOnboardingToken(user.id);

    const res = await request(app)
      .post('/api/v1/onboarding/milestone')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('400 when milestoneKey has invalid format', async () => {
    const user = await createOnboardingUser('bad_milestone@test.com');
    const token = makeOnboardingToken(user.id);

    const res = await request(app)
      .post('/api/v1/onboarding/milestone')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestoneKey: 'INVALID-KEY!' });

    expect(res.status).toBe(400);
  });
});
